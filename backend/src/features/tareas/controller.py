import msgspec
from litestar import Controller, get, post, put, delete, Request
from litestar.exceptions import NotFoundException, PermissionDeniedException, ValidationException
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.permisos import es_admin, requerir_seccion, id_usuario
from src.features.documentos.services import documentos_ocultos
from src.features.espacios.services import proyectos_sin_acceso, puede_ver, requerir_acceso
from src.features.tareas.models import TareaModel
from src.features.tareas.schemas import (
    TareaCrear,
    TareaActualizar,
    TareaRespuesta,
    MiTarea,
    TareaTerminada,
    TareasOrden,
    TareaDocumentoAgregar,
    DocumentoDeTarea,
    ColumnaCrear,
    ColumnaActualizar,
    ColumnasOrden,
    ColumnaRespuesta,
)
from src.features.tareas.services import (
    obtener_tareas,
    obtener_tareas_asignadas,
    marcar_terminada,
    obtener_tarea,
    crear_tarea,
    actualizar_tarea,
    reordenar_tareas,
    eliminar_tarea,
    agregar_documento_a_tarea,
    quitar_documento_de_tarea,
    obtener_documentos_de_tarea,
    obtener_conteo_documentos_por_tareas,
    ids_columnas_finales,
    obtener_columna,
    obtener_columnas,
    listar_todas_columnas,
    crear_columna,
    actualizar_columna,
    reordenar_columnas,
    eliminar_columna,
)


async def _respuestas(db: AsyncSession, tareas: list[TareaModel]) -> list[TareaRespuesta]:
    """Convierte tareas agregando el conteo de documentos y si estan terminadas (columna final)."""
    finales = await ids_columnas_finales(db, {t.columna_id for t in tareas})
    conteos = await obtener_conteo_documentos_por_tareas(db, [t.id for t in tareas])
    respuestas = []
    for t in tareas:
        r = msgspec.convert(t, TareaRespuesta, from_attributes=True)
        r.documentos_count = conteos.get(r.id, 0)
        r.terminada = r.columna_id in finales
        respuestas.append(r)
    return respuestas


async def _tarea_visible(db: AsyncSession, request: Request, tarea_id: int) -> TareaModel:
    """La tarea, o 404 si no existe o es de un proyecto que el usuario no puede ver."""
    tarea = await obtener_tarea(db, tarea_id)
    if not tarea:
        raise NotFoundException(detail="Tarea no encontrada")
    await requerir_acceso(db, request, tarea.proyecto_id)
    return tarea


async def _columna_visible(db: AsyncSession, request: Request, columna_id: int):
    columna = await obtener_columna(db, columna_id)
    if not columna:
        raise NotFoundException(detail="Columna no encontrada")
    await requerir_acceso(db, request, columna.proyecto_id)
    return columna


async def _validar_asignado(db: AsyncSession, proyecto_id: int, usuario_id: int | None) -> None:
    """Solo se asigna a quien puede ver el proyecto; en uno de «solo yo», solo a quien lo creo."""
    from src.features.proyectos.services import obtener_proyecto

    if usuario_id is None or await puede_ver(db, proyecto_id, usuario_id):
        return
    proyecto = await obtener_proyecto(db, proyecto_id)
    if proyecto and proyecto.acceso == "solo":
        raise ValidationException(
            detail="Este proyecto es solo de quien lo creó: cambia quién puede verlo para asignar a otras personas"
        )
    raise ValidationException(detail="Esa persona no puede ver el proyecto: compártelo con ella para asignarle tareas")


class TareaController(Controller):
    path = "/tareas"
    tags = ["Tareas"]

    @get()
    async def listar(self, request: Request, db_session: AsyncSession, proyecto_id: int | None = None) -> list[TareaRespuesta]:
        await requerir_seccion(db_session, request, "tareas")
        await requerir_acceso(db_session, request, proyecto_id)
        sin_acceso = await proyectos_sin_acceso(db_session, request)
        tareas = [t for t in await obtener_tareas(db_session, proyecto_id) if t.proyecto_id not in sin_acceso]
        return await _respuestas(db_session, tareas)

    @get("/mias")
    async def mias(self, request: Request, db_session: AsyncSession) -> list[MiTarea]:
        """Las tareas asignadas al usuario, de todos los proyectos, la que vence primero arriba."""
        await requerir_seccion(db_session, request, "mis_tareas")
        sin_acceso = await proyectos_sin_acceso(db_session, request)
        filas = [f for f in await obtener_tareas_asignadas(db_session, id_usuario(request)) if f[0].proyecto_id not in sin_acceso]
        respuestas = await _respuestas(db_session, [t for t, *_ in filas])
        return [
            MiTarea(**msgspec.structs.asdict(r), proyecto_nombre=proyecto, columna_nombre=columna, columna_color=color)
            for r, (_, proyecto, columna, color) in zip(respuestas, filas)
        ]

    @put("/{tarea_id:int}/terminada")
    async def terminada(self, request: Request, db_session: AsyncSession, tarea_id: int, data: TareaTerminada) -> TareaRespuesta:
        """Marcar o desmarcar desde «Mis tareas»: solo quien la tiene asignada (o un administrador)."""
        await requerir_seccion(db_session, request, "mis_tareas")
        tarea = await _tarea_visible(db_session, request, tarea_id)
        if tarea.usuario_asignado_id != id_usuario(request) and not await es_admin(db_session, request):
            raise PermissionDeniedException(detail="Solo puedes marcar las tareas que tienes asignadas")
        tarea = await marcar_terminada(db_session, tarea, data.terminada, id_usuario(request))
        return (await _respuestas(db_session, [tarea]))[0]

    @get("/{tarea_id:int}")
    async def obtener(self, request: Request, db_session: AsyncSession, tarea_id: int) -> TareaRespuesta:
        await requerir_seccion(db_session, request, "tareas")
        tarea = await _tarea_visible(db_session, request, tarea_id)
        return (await _respuestas(db_session, [tarea]))[0]

    @post()
    async def crear(self, request: Request, db_session: AsyncSession, data: TareaCrear) -> TareaRespuesta:
        await requerir_seccion(db_session, request, "tareas")
        await requerir_acceso(db_session, request, data.proyecto_id)
        await _validar_asignado(db_session, data.proyecto_id, data.usuario_asignado_id)
        usuario_id = id_usuario(request)
        tarea = await crear_tarea(db_session, data, usuario_id)
        return (await _respuestas(db_session, [tarea]))[0]

    @put("/orden", status_code=204)
    async def ordenar(self, request: Request, db_session: AsyncSession, data: TareasOrden) -> None:
        """Guarda el orden de una columna despues de arrastrar una tarea (y la mueve si viene de otra)."""
        await requerir_seccion(db_session, request, "tareas")
        await _columna_visible(db_session, request, data.columna_id)
        usuario_id = id_usuario(request)
        await reordenar_tareas(db_session, data.columna_id, data.tarea_ids, usuario_id)

    @put("/{tarea_id:int}")
    async def actualizar(self, request: Request, db_session: AsyncSession, tarea_id: int, data: TareaActualizar) -> TareaRespuesta:
        await requerir_seccion(db_session, request, "tareas")
        actual = await _tarea_visible(db_session, request, tarea_id)
        if data.usuario_asignado_id is not None and data.usuario_asignado_id != actual.usuario_asignado_id:
            await _validar_asignado(db_session, actual.proyecto_id, data.usuario_asignado_id)
        usuario_id = id_usuario(request)
        tarea = await actualizar_tarea(db_session, tarea_id, data, usuario_id)
        if not tarea:
            raise NotFoundException(detail="Tarea no encontrada")
        return (await _respuestas(db_session, [tarea]))[0]

    @delete("/{tarea_id:int}")
    async def eliminar(self, request: Request, db_session: AsyncSession, tarea_id: int) -> None:
        await requerir_seccion(db_session, request, "tareas")
        await _tarea_visible(db_session, request, tarea_id)
        usuario_id = id_usuario(request)
        eliminado = await eliminar_tarea(db_session, tarea_id, usuario_id)
        if not eliminado:
            raise NotFoundException(detail="Tarea no encontrada")

    @get("/{tarea_id:int}/documentos")
    async def listar_documentos(self, request: Request, db_session: AsyncSession, tarea_id: int) -> list[DocumentoDeTarea]:
        await requerir_seccion(db_session, request, "tareas")
        await _tarea_visible(db_session, request, tarea_id)
        documentos = await obtener_documentos_de_tarea(db_session, tarea_id)
        ocultos = await documentos_ocultos(db_session, request)
        return [
            DocumentoDeTarea(
                documento_id=d.id,
                nombre=d.nombre,
                tipo=d.tipo,
                version_actual=d.version_actual,
            )
            for d in documentos
            if d.id not in ocultos
        ]

    @post("/{tarea_id:int}/documentos")
    async def agregar_documento(self, request: Request, db_session: AsyncSession, tarea_id: int, data: TareaDocumentoAgregar) -> None:
        await requerir_seccion(db_session, request, "tareas")
        await _tarea_visible(db_session, request, tarea_id)
        if data.documento_id in await documentos_ocultos(db_session, request):
            raise NotFoundException(detail="Documento no encontrado")
        await agregar_documento_a_tarea(db_session, tarea_id, data.documento_id)

    @delete("/{tarea_id:int}/documentos/{documento_id:int}")
    async def quitar_documento(self, request: Request, db_session: AsyncSession, tarea_id: int, documento_id: int) -> None:
        await requerir_seccion(db_session, request, "tareas")
        await _tarea_visible(db_session, request, tarea_id)
        await quitar_documento_de_tarea(db_session, tarea_id, documento_id)


class ColumnaController(Controller):
    path = "/columnas"
    tags = ["Tareas"]

    @get()
    async def listar(self, request: Request, db_session: AsyncSession, proyecto_id: int | None = None) -> list[ColumnaRespuesta]:
        await requerir_seccion(db_session, request, "tareas")
        # Sin proyecto_id devuelve las columnas de todos los proyectos que puede ver (listado de proyectos)
        await requerir_acceso(db_session, request, proyecto_id)
        sin_acceso = await proyectos_sin_acceso(db_session, request)
        columnas = await obtener_columnas(db_session, proyecto_id) if proyecto_id else await listar_todas_columnas(db_session)
        columnas = [c for c in columnas if c.proyecto_id not in sin_acceso]
        return [msgspec.convert(c, ColumnaRespuesta, from_attributes=True) for c in columnas]

    @post()
    async def crear(self, request: Request, db_session: AsyncSession, data: ColumnaCrear) -> ColumnaRespuesta:
        await requerir_seccion(db_session, request, "tareas")
        await requerir_acceso(db_session, request, data.proyecto_id)
        columna = await crear_columna(db_session, data)
        return msgspec.convert(columna, ColumnaRespuesta, from_attributes=True)

    @put("/orden")
    async def ordenar(self, request: Request, db_session: AsyncSession, data: ColumnasOrden) -> list[ColumnaRespuesta]:
        await requerir_seccion(db_session, request, "tareas")
        await requerir_acceso(db_session, request, data.proyecto_id)
        columnas = await reordenar_columnas(db_session, data.proyecto_id, data.columna_ids)
        return [msgspec.convert(c, ColumnaRespuesta, from_attributes=True) for c in columnas]

    @put("/{columna_id:int}")
    async def actualizar(self, request: Request, db_session: AsyncSession, columna_id: int, data: ColumnaActualizar) -> ColumnaRespuesta:
        await requerir_seccion(db_session, request, "tareas")
        await _columna_visible(db_session, request, columna_id)
        columna = await actualizar_columna(db_session, columna_id, data)
        if not columna:
            raise NotFoundException(detail="Columna no encontrada")
        return msgspec.convert(columna, ColumnaRespuesta, from_attributes=True)

    @delete("/{columna_id:int}")
    async def eliminar(self, request: Request, db_session: AsyncSession, columna_id: int, mover_a: int | None = None) -> None:
        """Elimina la columna; si tiene tareas, `mover_a` indica la columna que las recibe."""
        await requerir_seccion(db_session, request, "tareas")
        await _columna_visible(db_session, request, columna_id)
        if not await eliminar_columna(db_session, columna_id, mover_a):
            raise NotFoundException(detail="Columna no encontrada")
