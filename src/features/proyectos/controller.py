from litestar import Controller, get, post, put, delete
from litestar.exceptions import NotFoundException
from sqlalchemy.ext.asyncio import AsyncSession
from src.features.proyectos.schemas import ProyectoCrear, ProyectoActualizar, ProyectoRespuesta
from src.features.proyectos import services

class ProyectoController(Controller):
    path = "/proyectos"

    @get()
    async def listar(self, db_session: AsyncSession) -> list[ProyectoRespuesta]:
        return await services.obtener_proyectos(db_session)

    @get("/{proyecto_id:int}")
    async def obtener(self, db_session: AsyncSession, proyecto_id: int) -> ProyectoRespuesta:
        proyecto = await services.obtener_proyecto(db_session, proyecto_id)
        if not proyecto:
            raise NotFoundException(detail="Proyecto no encontrado")
        return proyecto

    @post()
    async def crear(self, db_session: AsyncSession, data: ProyectoCrear) -> ProyectoRespuesta:
        return await services.crear_proyecto(db_session, data)

    @put("/{proyecto_id:int}")
    async def actualizar(self, db_session: AsyncSession, proyecto_id: int, data: ProyectoActualizar) -> ProyectoRespuesta:
        proyecto = await services.actualizar_proyecto(db_session, proyecto_id, data)
        if not proyecto:
            raise NotFoundException(detail="Proyecto no encontrado")
        return proyecto

    @delete("/{proyecto_id:int}")
    async def eliminar(self, db_session: AsyncSession, proyecto_id: int) -> None:
        eliminado = await services.eliminar_proyecto(db_session, proyecto_id)
        if not eliminado:
            raise NotFoundException(detail="Proyecto no encontrado")