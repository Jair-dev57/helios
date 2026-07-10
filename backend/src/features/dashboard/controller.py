from litestar import Controller, get
from sqlalchemy.ext.asyncio import AsyncSession

from src.features.dashboard.schemas import DashboardRespuesta
from src.features.dashboard.services import obtener_dashboard


class DashboardController(Controller):
    path = "/dashboard"
    tags = ["Dashboard"]

    @get()
    async def resumen(self, db_session: AsyncSession) -> DashboardRespuesta:
        return await obtener_dashboard(db_session)