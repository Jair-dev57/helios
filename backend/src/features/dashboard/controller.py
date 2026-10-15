from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from litestar import Controller, Request, get
from litestar.exceptions import ValidationException
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.permisos import id_usuario, requerir_seccion
from src.features.dashboard.schemas import DashboardRespuesta
from src.features.dashboard.services import obtener_dashboard
from src.features.documentos.services import documentos_ocultos
from src.features.espacios.services import proyectos_sin_acceso

MAX_PERIODO = timedelta(days=366)


def _con_zona(fecha: datetime) -> datetime:
    return fecha if fecha.tzinfo else fecha.replace(tzinfo=timezone.utc)


class DashboardController(Controller):
    path = "/dashboard"
    tags = ["Dashboard"]

    @get()
    async def resumen(
        self,
        request: Request,
        db_session: AsyncSession,
        desde: datetime,
        hasta: datetime,
        zona: str = "UTC",
        solo_mias: bool = False,
    ) -> DashboardRespuesta:
        """Metricas del Inicio para [desde, hasta). zona: la del navegador, para agrupar la actividad por dia.

        Lo propio (solo_mias) lo ve cualquiera; lo de todo el equipo pide la seccion «actividad».
        """
        if not solo_mias:
            await requerir_seccion(db_session, request, "actividad")
        desde, hasta = _con_zona(desde), _con_zona(hasta)
        if not desde < hasta <= desde + MAX_PERIODO:
            raise ValidationException(detail="Periodo no válido")
        try:
            zona_horaria = ZoneInfo(zona)
        except (ZoneInfoNotFoundError, ValueError):
            raise ValidationException(detail="Zona horaria no válida")
        ocultos = await documentos_ocultos(db_session, request, incluir_papelera=False)
        return await obtener_dashboard(
            db_session, desde, hasta, zona_horaria, id_usuario(request) if solo_mias else None, ocultos,
            await proyectos_sin_acceso(db_session, request),
        )
