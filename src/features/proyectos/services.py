from sqlalchemy.ext.asyncio import AsyncSession
from .models import ProyectoModel
from .schemas import ProyectoCreate


class ProyectoService:
    def __init__(self, db_session: AsyncSession) -> None:
        self.db_session = db_session
    
    async def guardar_proyecto(self, data: ProyectoCreate) -> ProyectoModel:
        nuevo = ProyectoModel(nombre=data.nombre, estado=data.estado)
        self.db_session.add(nuevo)
        await self.db_session.commit()
        await self.db_session.refresh(nuevo)
        return nuevo
    
    