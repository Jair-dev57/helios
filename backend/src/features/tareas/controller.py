import msgspec
from litestar import Controller, get, post, put, delete, Request
from litestar.exceptions import NotFoundException
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.permisos import requerir_seccion
from src.features.tareas.schemas import (
    TareaCrear,
    TareaActualizar,
    TareaRespuesta,
    TareaDocumentoAgregar,
    DocumentoDeTarea,
)
from src.features.tareas.services import (
    obtener_tareas,
    obtener_tarea,
    crear_tarea,
    actualizar_tarea,
    eliminar_tarea,
    agregar_documento_a_tarea,
    quitar_documento_de_tarea,
    obtener_documentos_de_tarea,
    obtener_conteo_documentos_por_tareas,
)


class TareaController(Controller):
    path = "/tareas"
    tags = ["Tareas"]

    @get()
    async def listar(self, request: Request, db_session: AsyncSession, proyecto_id: int | None = None) -> list[TareaRespuesta]:
        await requerir_seccion(db_session, request, "tareas")
        tareas = await obtener_tareas(db_session, proyecto_id)
        respuestas = [msgspec.convert(t, TareaRespuesta, from_attributes=True) for t in tareas]
        conteos = await obtener_conteo_documentos_por_tareas(db_session, [t.id for t in tareas])
        for r in respuestas:
            r.documentos_count = conteos.get(r.id, 0)
        return respuestas

    @get("/{tarea_id:int}")
    async def obtener(self, request: Request, db_session: AsyncSession, tarea_id: int) -> TareaRespuesta:
        await requerir_seccion(db_session, request, "tareas")
        tarea = await obtener_tarea(db_session, tarea_id)
        if not tarea:
            raise NotFoundException(detail="Tarea no encontrada")
        return msgspec.convert(tarea, TareaRespuesta, from_attributes=True)

    @post()
    async def crear(self, request: Request, db_session: AsyncSession, data: TareaCrear) -> TareaRespuesta:
        await requerir_seccion(db_session, request, "tareas")
        usuario_id = int(request.user["id"]) if request.user else None
        tarea = await crear_tarea(db_session, data, usuario_id)
        return msgspec.convert(tarea, TareaRespuesta, from_attributes=True)

    @put("/{tarea_id:int}")
    async def actualizar(self, request: Request, db_session: AsyncSession, tarea_id: int, data: TareaActualizar) -> TareaRespuesta:
        await requerir_seccion(db_session, request, "tareas")
        usuario_id = int(request.user["id"]) if request.user else None
        tarea = await actualizar_tarea(db_session, tarea_id, data, usuario_id)
        if not tarea:
            raise NotFoundException(detail="Tarea no encontrada")
        return msgspec.convert(tarea, TareaRespuesta, from_attributes=True)

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
