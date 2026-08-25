from litestar import Controller, get
from sqlalchemy.ext.asyncio import AsyncSession
from src.features.historial.schemas import EventoActividad
from src.features.historial.services import obtener_historial_combinado


class HistorialController(Controller):
    path = "/historial"
    tags = ["Historial"]

    @get()
    async def listar(self, db_session: AsyncSession, proyecto_id: int) -> list[EventoActividad]:
        return await obtener_historial_combinado(db_session, proyecto_id)
