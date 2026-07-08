import msgspec
from litestar import Controller, get, post, put, delete
from litestar.exceptions import NotFoundException
from sqlalchemy.ext.asyncio import AsyncSession
from src.features.proyectos.schemas import ProyectoCrear, ProyectoActualizar, ProyectoRespuesta
from src.features.proyectos.services import (
    obtener_proyectos,
    obtener_proyecto,
    crear_proyecto,
    actualizar_proyecto,
    eliminar_proyecto
)


class ProyectoController(Controller):
    path = "/proyectos"
    tags = ["Proyectos"]

    @get()
    async def listar(self, db_session: AsyncSession) -> list[ProyectoRespuesta]:
        proyectos = await obtener_proyectos(db_session)
        return [msgspec.convert(p, ProyectoRespuesta, from_attributes=True) for p in proyectos]

    @get("/{proyecto_id:int}")
    async def obtener(self, db_session: AsyncSession, proyecto_id: int) -> ProyectoRespuesta:
        proyecto = await obtener_proyecto(db_session, proyecto_id)
        if not proyecto:
            raise NotFoundException(detail="Proyecto no encontrado")
        return msgspec.convert(proyecto, ProyectoRespuesta, from_attributes=True)

    @post()
    async def crear(self, db_session: AsyncSession, data: ProyectoCrear) -> ProyectoRespuesta:
        proyecto = await crear_proyecto(db_session, data)
        return msgspec.convert(proyecto, ProyectoRespuesta, from_attributes=True)

    @put("/{proyecto_id:int}")
    async def actualizar(self, db_session: AsyncSession, proyecto_id: int, data: ProyectoActualizar) -> ProyectoRespuesta:
        proyecto = await actualizar_proyecto(db_session, proyecto_id, data)
        if not proyecto:
            raise NotFoundException(detail="Proyecto no encontrado")
        return msgspec.convert(proyecto, ProyectoRespuesta, from_attributes=True)

    @delete("/{proyecto_id:int}")
    async def eliminar(self, db_session: AsyncSession, proyecto_id: int) -> None:
        eliminado = await eliminar_proyecto(db_session, proyecto_id)
        if not eliminado:
            raise NotFoundException(detail="Proyecto no encontrado")