from datetime import date

import msgspec
from litestar import Controller, Request, get
from litestar.exceptions import ValidationException
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.permisos import id_usuario, requerir_seccion, secciones_de
from src.features.calendario import services
from src.features.calendario.schemas import EventoCalendario
from src.features.espacios.services import proyectos_sin_acceso

MAX_DIAS = 100  # un mes visible con sus semanas de borde cabe de sobra


class CalendarioController(Controller):
    path = "/calendario"
    tags = ["Calendario"]

    @get()
    async def listar(
        self, request: Request, db_session: AsyncSession, desde: date, hasta: date, solo_mias: bool = True
    ) -> list[EventoCalendario]:
        """Tareas que vencen y entregas de proyectos entre desde y hasta (incluidos).

        Las tareas de todo el equipo solo se ven con la seccion «tareas»; sin ella, solo las propias.
        """
        await requerir_seccion(db_session, request, "calendario")
        if hasta < desde or (hasta - desde).days > MAX_DIAS:
            raise ValidationException(detail=f"El rango debe ir de menor a mayor y tener máximo {MAX_DIAS} días")
        if not solo_mias and "tareas" not in await secciones_de(db_session, id_usuario(request)):
            solo_mias = True
        datos = await services.eventos(db_session, desde, hasta, id_usuario(request), solo_mias)
        sin_acceso = await proyectos_sin_acceso(db_session, request)
        return [msgspec.convert(e, EventoCalendario) for e in datos if e["proyecto_id"] not in sin_acceso]
