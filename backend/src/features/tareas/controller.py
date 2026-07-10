import msgspec
from litestar import Controller, get, post, put, delete
from litestar.exceptions import NotFoundException
from sqlalchemy.ext.asyncio import AsyncSession

from src.features.tareas.schemas import TareaCrear, TareaActualizar, TareaRespuesta
from src.features.tareas.services import (
    obtener_tareas,
    obtener_tarea,
    crear_tarea,
    actualizar_tarea,
    eliminar_tarea,
)


class TareaController(Controller):
    path = "/tareas"
    tags = ["Tareas"]

    @get()
    async def listar(self, db_session: AsyncSession, proyecto_id: int | None = None) -> list[TareaRespuesta]:
        tareas = await obtener_tareas(db_session, proyecto_id)
        return [msgspec.convert(t, TareaRespuesta, from_attributes=True) for t in tareas]

    @get("/{tarea_id:int}")
    async def obtener(self, db_session: AsyncSession, tarea_id: int) -> TareaRespuesta:
        tarea = await obtener_tarea(db_session, tarea_id)
        if not tarea:
            raise NotFoundException(detail="Tarea no encontrada")
        return msgspec.convert(tarea, TareaRespuesta, from_attributes=True)

    @post()
    async def crear(self, db_session: AsyncSession, data: TareaCrear) -> TareaRespuesta:
        tarea = await crear_tarea(db_session, data)
        return msgspec.convert(tarea, TareaRespuesta, from_attributes=True)

    @put("/{tarea_id:int}")
    async def actualizar(self, db_session: AsyncSession, tarea_id: int, data: TareaActualizar) -> TareaRespuesta:
        tarea = await actualizar_tarea(db_session, tarea_id, data)
        if not tarea:
            raise NotFoundException(detail="Tarea no encontrada")
        return msgspec.convert(tarea, TareaRespuesta, from_attributes=True)

    @delete("/{tarea_id:int}")
    async def eliminar(self, db_session: AsyncSession, tarea_id: int) -> None:
        eliminado = await eliminar_tarea(db_session, tarea_id)
        if not eliminado:
            raise NotFoundException(detail="Tarea no encontrada")