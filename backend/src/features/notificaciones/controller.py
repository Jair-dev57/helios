from litestar import Controller, Request, get, post
from sqlalchemy.ext.asyncio import AsyncSession

from src.features.notificaciones.schemas import Notificacion, Notificaciones
from src.features.notificaciones.services import listar, marcar_leidas


class NotificacionController(Controller):
    """Avisos del usuario autenticado."""
    path = "/notificaciones"
    tags = ["Notificaciones"]

    @get()
    async def listar(self, request: Request, db_session: AsyncSession) -> Notificaciones:
        notificaciones, no_leidas = await listar(db_session, int(request.user["id"]))
        return Notificaciones(no_leidas=no_leidas, notificaciones=[Notificacion(**n) for n in notificaciones])

    @post("/{notificacion_id:int}/leer", status_code=204)
    async def leer(self, request: Request, db_session: AsyncSession, notificacion_id: int) -> None:
        await marcar_leidas(db_session, int(request.user["id"]), notificacion_id)

    @post("/leer-todas", status_code=204)
    async def leer_todas(self, request: Request, db_session: AsyncSession) -> None:
        await marcar_leidas(db_session, int(request.user["id"]))
