from litestar import Controller, Request, get
from sqlalchemy.ext.asyncio import AsyncSession
from src.features.historial.schemas import EventoActividad
from src.features.documentos.services import documentos_ocultos
from src.features.historial.services import obtener_historial_combinado


class HistorialController(Controller):
    path = "/historial"
    tags = ["Historial"]

    @get()
    async def listar(
        self, request: Request, db_session: AsyncSession, proyecto_id: int | None = None, limite: int = 50
    ) -> list[EventoActividad]:
        # Sin proyecto_id devuelve la actividad reciente de todos los proyectos (dashboard)
        ocultos = await documentos_ocultos(db_session, request)
        return await obtener_historial_combinado(db_session, proyecto_id, min(max(limite, 1), 100), ocultos)
