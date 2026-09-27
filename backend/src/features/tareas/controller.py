import msgspec
from litestar import Controller, get, post, put, delete, Request
from litestar.exceptions import NotFoundException
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.permisos import requerir_seccion
from src.features.tareas.models import TareaModel
from src.features.tareas.schemas import (
    TareaCrear,
    TareaActualizar,
    TareaRespuesta,
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
    obtener_columnas,
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


class TareaController(Controller):
    path = "/tareas"
    tags = ["Tareas"]

    @get()
    async def listar(self, request: Request, db_session: AsyncSession, proyecto_id: int | None = None) -> list[TareaRespuesta]:
        await requerir_seccion(db_session, request, "tareas")
        tareas = await obtener_tareas(db_session, proyecto_id)
        return await _respuestas(db_session, tareas)

    @get("/{tarea_id:int}")
    async def obtener(self, request: Request, db_session: AsyncSession, tarea_id: int) -> TareaRespuesta:
        await requerir_seccion(db_session, request, "tareas")
        tarea = await obtener_tarea(db_session, tarea_id)
        if not tarea:
            raise NotFoundException(detail="Tarea no encontrada")
        return (await _respuestas(db_session, [tarea]))[0]

    @post()
    async def crear(self, request: Request, db_session: AsyncSession, data: TareaCrear) -> TareaRespuesta:
        await requerir_seccion(db_session, request, "tareas")
        usuario_id = int(request.user["id"]) if request.user else None
        tarea = await crear_tarea(db_session, data, usuario_id)
        return (await _respuestas(db_session, [tarea]))[0]

    @put("/orden", status_code=204)
    async def ordenar(self, request: Request, db_session: AsyncSession, data: TareasOrden) -> None:
        """Guarda el orden de una columna despues de arrastrar una tarea (y la mueve si viene de otra)."""
        await requerir_seccion(db_session, request, "tareas")
        usuario_id = int(request.user["id"]) if request.user else None
        await reordenar_tareas(db_session, data.columna_id, data.tarea_ids, usuario_id)

    @put("/{tarea_id:int}")
    async def actualizar(self, request: Request, db_session: AsyncSession, tarea_id: int, data: TareaActualizar) -> TareaRespuesta:
        await requerir_seccion(db_session, request, "tareas")
        usuario_id = int(request.user["id"]) if request.user else None
        tarea = await actualizar_tarea(db_session, tarea_id, data, usuario_id)
        if not tarea:
            raise NotFoundException(detail="Tarea no encontrada")
        return (await _respuestas(db_session, [tarea]))[0]

    @delete("/{tarea_id:int}")
    async def eliminar(self, request: Request, db_session: AsyncSession, tarea_id: int) -> None:
        await requerir_seccion(db_session, request, "tareas")
        usuario_id = int(request.user["id"]) if request.user else None
        eliminado = await eliminar_tarea(db_session, tarea_id, usuario_id)
        if not eliminado:
            raise NotFoundException(detail="Tarea no encontrada")

    @get("/{tarea_id:int}/documentos")
    async def listar_documentos(self, request: Request, db_session: AsyncSession, tarea_id: int) -> list[DocumentoDeTarea]:
        await requerir_seccion(db_session, request, "tareas")
        documentos = await obtener_documentos_de_tarea(db_session, tarea_id)
        return [
            DocumentoDeTarea(
                documento_id=d.id,
                nombre=d.nombre,
                tipo=d.tipo,
                version_actual=d.version_actual,
            )
            for d in documentos
        ]

    @post("/{tarea_id:int}/documentos")
    async def agregar_documento(self, request: Request, db_session: AsyncSession, tarea_id: int, data: TareaDocumentoAgregar) -> None:
        await requerir_seccion(db_session, request, "tareas")
        await agregar_documento_a_tarea(db_session, tarea_id, data.documento_id)

    @delete("/{tarea_id:int}/documentos/{documento_id:int}")
    async def quitar_documento(self, request: Request, db_session: AsyncSession, tarea_id: int, documento_id: int) -> None:
        await requerir_seccion(db_session, request, "tareas")
        await quitar_documento_de_tarea(db_session, tarea_id, documento_id)


class ColumnaController(Controller):
    path = "/columnas"
    tags = ["Tareas"]

    @get()
    async def listar(self, request: Request, db_session: AsyncSession, proyecto_id: int) -> list[ColumnaRespuesta]:
        await requerir_seccion(db_session, request, "tareas")
        columnas = await obtener_columnas(db_session, proyecto_id)
        return [msgspec.convert(c, ColumnaRespuesta, from_attributes=True) for c in columnas]

    @post()
    async def crear(self, request: Request, db_session: AsyncSession, data: ColumnaCrear) -> ColumnaRespuesta:
        await requerir_seccion(db_session, request, "tareas")
        columna = await crear_columna(db_session, data)
        return msgspec.convert(columna, ColumnaRespuesta, from_attributes=True)

    @put("/orden")
    async def ordenar(self, request: Request, db_session: AsyncSession, data: ColumnasOrden) -> list[ColumnaRespuesta]:
        await requerir_seccion(db_session, request, "tareas")
        columnas = await reordenar_columnas(db_session, data.proyecto_id, data.columna_ids)
        return [msgspec.convert(c, ColumnaRespuesta, from_attributes=True) for c in columnas]

    @put("/{columna_id:int}")
    async def actualizar(self, request: Request, db_session: AsyncSession, columna_id: int, data: ColumnaActualizar) -> ColumnaRespuesta:
        await requerir_seccion(db_session, request, "tareas")
        columna = await actualizar_columna(db_session, columna_id, data)
        if not columna:
            raise NotFoundException(detail="Columna no encontrada")
        return msgspec.convert(columna, ColumnaRespuesta, from_attributes=True)

    @delete("/{columna_id:int}")
    async def eliminar(self, request: Request, db_session: AsyncSession, columna_id: int, mover_a: int | None = None) -> None:
        """Elimina la columna; si tiene tareas, `mover_a` indica la columna que las recibe."""
        await requerir_seccion(db_session, request, "tareas")
        if not await eliminar_columna(db_session, columna_id, mover_a):
            raise NotFoundException(detail="Columna no encontrada")
