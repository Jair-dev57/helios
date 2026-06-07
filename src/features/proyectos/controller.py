from litestar import Controller, post
from sqlalchemy.ext.asyncio import AsyncSession
from .schemas import ProyectoCreate, ProyectoResponse
from .services import ProyectoService

class ProyectoController(Controller):
    path = "/proyectos"

    @post()
    async def crear_proyecto(self, data: ProyectoCreate, db_session: AsyncSession) -> ProyectoResponse:
        # 1. Llamamos a la capa de servicio
        servicio = ProyectoService(db_session)
        proyecto_db = await servicio.guardar_proyecto(data)
        
        # 2. Retornamos mapeando al schema de salida
        return ProyectoResponse(
            id=proyecto_db.id,
            nombre=proyecto_db.nombre,
            estado=proyecto_db.estado
        )