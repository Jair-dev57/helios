from datetime import datetime
from typing import Literal

from litestar import Controller, Request, get
from sqlalchemy.ext.asyncio import AsyncSession
from src.core.permisos import id_usuario, requerir_seccion
from src.features.historial.schemas import EventoActividad, ResumenActividad
from src.features.documentos.services import documentos_ocultos
from src.features.historial.services import obtener_historial_combinado, resumen_actividad


class HistorialController(Controller):
    path = "/historial"
    tags = ["Historial"]

    @get()
    async def listar(
        self, request: Request, db_session: AsyncSession, proyecto_id: int | None = None, limite: int = 50
    ) -> list[EventoActividad]:
        # Sin proyecto_id devuelve la actividad reciente de todos los proyectos (dashboard)
        # Lo de la papelera si aparece en la actividad (p. ej. quien lo borro); solo se ocultan los restringidos
        ocultos = await documentos_ocultos(db_session, request, incluir_papelera=False)
        return await obtener_historial_combinado(db_session, proyecto_id, min(max(limite, 1), 100), ocultos)

    @get("/actividad")
    async def actividad(
        self,
        request: Request,
        db_session: AsyncSession,
        tipo: Literal["proyecto", "tarea", "documento"] | None = None,
        solo_mias: bool = False,
        usuario_id: int | None = None,
        proyecto_id: int | None = None,
        buscar: str | None = None,
        antes_de: int | None = None,
        desde: datetime | None = None,
        hasta: datetime | None = None,
        limite: int = 40,
    ) -> list[EventoActividad]:
        """Pagina «Actividad» e Inicio: lo que pasa en Helios, filtrable por tipo, persona, proyecto, texto y fechas.

        Lo propio (solo_mias) lo ve cualquiera; lo de todo el equipo pide la seccion «actividad».
        """
        if not solo_mias:
            await requerir_seccion(db_session, request, "actividad")
        ocultos = await documentos_ocultos(db_session, request, incluir_papelera=False)
        return await obtener_historial_combinado(
            db_session, proyecto_id, min(max(limite, 1), 100), ocultos,
            tipo=tipo, usuario_id=id_usuario(request) if solo_mias else usuario_id, antes_de=antes_de,
            desde=desde, hasta=hasta, buscar=buscar,
        )

    @get("/actividad/resumen")
    async def resumen(
        self,
        request: Request,
        db_session: AsyncSession,
        zona: str = "UTC",
        tipo: Literal["proyecto", "tarea", "documento"] | None = None,
        solo_mias: bool = False,
        usuario_id: int | None = None,
        proyecto_id: int | None = None,
    ) -> ResumenActividad:
        """Columna lateral de la pagina Actividad, con los mismos filtros que el listado. zona: p. ej. America/Bogota."""
        if not solo_mias:
            await requerir_seccion(db_session, request, "actividad")
        ocultos = await documentos_ocultos(db_session, request, incluir_papelera=False)
        return await resumen_actividad(
            db_session, ocultos, zona=zona, tipo=tipo,
            usuario_id=id_usuario(request) if solo_mias else usuario_id, proyecto_id=proyecto_id, solo_mias=solo_mias,
        )
