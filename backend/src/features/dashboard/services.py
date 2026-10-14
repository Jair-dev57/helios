from datetime import datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo

from sqlalchemy import and_, func, not_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.features.dashboard.schemas import DashboardRespuesta, DiaActividad, ProyectoAvance
from src.features.historial.models import HistorialCambioModel
from src.features.proyectos.models import ProyectoModel
from src.features.tareas.models import TareaColumnaModel, TareaModel

# Tareas que no estan en la columna de terminadas de su proyecto
ABIERTA = TareaModel.columna_id.in_(select(TareaColumnaModel.id).where(TareaColumnaModel.es_final.is_(False)))
# La fecha limite es un dia (se guarda a medianoche UTC): vale hasta el final de ese dia
FIN_DEL_PLAZO = TareaModel.fecha_vencimiento + timedelta(days=1)
DIAS_CALOR = 365


async def obtener_dashboard(
    db: AsyncSession,
    desde: datetime,
    hasta: datetime,
    zona: ZoneInfo,
    usuario_id: int | None,
    documentos_ocultos: set[int],
) -> DashboardRespuesta:
    """Metricas del Inicio para el periodo [desde, hasta).

    usuario_id: solo lo de esa persona (sus tareas asignadas, sus proyectos y su actividad); None, todo el equipo.
    """
    mias = [TareaModel.usuario_asignado_id == usuario_id] if usuario_id is not None else []

    terminadas = (await db.execute(
        select(TareaModel.terminada_at)
        .where(TareaModel.terminada_at >= desde, TareaModel.terminada_at < hasta, *mias)
        .order_by(TareaModel.terminada_at)
    )).scalars().all()

    creadas = (await db.execute(
        select(TareaModel.created_at)
        .where(TareaModel.created_at >= desde, TareaModel.created_at < hasta, *mias)
        .order_by(TareaModel.created_at)
    )).scalars().all()

    anterior = (await db.execute(
        select(func.count(TareaModel.id))
        .where(TareaModel.terminada_at >= desde - (hasta - desde), TareaModel.terminada_at < desde, *mias)
    )).scalar_one()

    a_tiempo, con_fecha = (await db.execute(
        select(
            func.count(TareaModel.id).filter(TareaModel.terminada_at < FIN_DEL_PLAZO),
            func.count(TareaModel.id),
        ).where(
            TareaModel.terminada_at >= desde,
            TareaModel.terminada_at < hasta,
            TareaModel.fecha_vencimiento.is_not(None),
            *mias,
        )
    )).one()

    hoy = datetime.now(zona).date()
    fechas_vencidas = (await db.execute(
        select(TareaModel.fecha_vencimiento)
        .where(ABIERTA, TareaModel.fecha_vencimiento.is_not(None), FIN_DEL_PLAZO <= datetime.now(timezone.utc), *mias)
    )).scalars().all()
    vencidas = sorted(
        ((hoy - f.astimezone(timezone.utc).date()).days for f in fechas_vencidas),
        reverse=True,
    )

    return DashboardRespuesta(
        terminadas=list(terminadas),
        creadas=list(creadas),
        terminadas_periodo_anterior=anterior,
        a_tiempo=a_tiempo,
        con_fecha=con_fecha,
        vencidas=[d for d in vencidas if d > 0],
        proyectos=await _proyectos(db, desde, hasta, usuario_id),
        calor=await _calor(db, zona, usuario_id, documentos_ocultos),
    )


async def _proyectos(db: AsyncSession, desde: datetime, hasta: datetime, usuario_id: int | None) -> list[ProyectoAvance]:
    """Proyectos activos con fecha de entrega que ya existian al final del periodo.

    Con usuario_id, los que tiene a cargo o donde tiene tareas asignadas.
    """
    consulta = (
        select(
            ProyectoModel.id,
            ProyectoModel.nombre,
            ProyectoModel.created_at,
            ProyectoModel.fecha_vencimiento,
            func.count(TareaModel.id),
            func.count(TareaModel.id).filter(TareaModel.terminada_at < desde),
            func.count(TareaModel.id).filter(TareaModel.terminada_at < hasta),
        )
        .outerjoin(TareaModel, TareaModel.proyecto_id == ProyectoModel.id)
        .where(
            ProyectoModel.tipo == "proyecto",
            ProyectoModel.estado == "activo",
            ProyectoModel.fecha_vencimiento.is_not(None),
            ProyectoModel.created_at < hasta,
        )
        .group_by(ProyectoModel.id)
        .order_by(ProyectoModel.fecha_vencimiento)
    )
    if usuario_id is not None:
        consulta = consulta.where(or_(
            ProyectoModel.usuario_id == usuario_id,
            ProyectoModel.id.in_(select(TareaModel.proyecto_id).where(TareaModel.usuario_asignado_id == usuario_id)),
        ))
    return [
        ProyectoAvance(
            id=pid, nombre=nombre, inicio=inicio, entrega=entrega,
            tareas=total, hechas_al_inicio=al_inicio, hechas_al_final=al_final,
        )
        for pid, nombre, inicio, entrega, total, al_inicio, al_final in (await db.execute(consulta)).all()
    ]


async def _calor(db: AsyncSession, zona: ZoneInfo, usuario_id: int | None, documentos_ocultos: set[int]) -> list[DiaActividad]:
    """Acciones del historial por dia (en la zona horaria de quien consulta) del ultimo año."""
    primer_dia = datetime.now(zona).date() - timedelta(days=DIAS_CALOR - 1)
    dia = func.date(func.timezone(zona.key, HistorialCambioModel.created_at))
    consulta = (
        select(dia, func.count(HistorialCambioModel.id))
        .where(HistorialCambioModel.created_at >= datetime.combine(primer_dia, time.min, zona))
        .group_by(dia)
        .order_by(dia)
    )
    if usuario_id is not None:
        consulta = consulta.where(HistorialCambioModel.usuario_id == usuario_id)
    if documentos_ocultos:
        # Igual que la actividad: no cuenta lo de los documentos que no puede ver
        consulta = consulta.where(not_(and_(
            HistorialCambioModel.entidad_tipo == "documento",
            HistorialCambioModel.entidad_id.in_(documentos_ocultos),
        )))
    return [DiaActividad(dia=d, acciones=n) for d, n in (await db.execute(consulta)).all()]
