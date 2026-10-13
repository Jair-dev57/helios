"""Calendario: vencimientos de tareas y entregas de proyectos en un rango de fechas.

Las fechas se guardan a medianoche UTC; se comparan como dia calendario (sin hora).
"""
from datetime import date, datetime, time, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.features.auth.models import UsuarioModel
from src.features.proyectos.models import ProyectoModel
from src.features.tareas.models import TareaColumnaModel, TareaModel


def _limites(desde: date, hasta: date) -> tuple[datetime, datetime]:
    inicio = datetime.combine(desde, time.min, tzinfo=timezone.utc)
    fin = datetime.combine(hasta + timedelta(days=1), time.min, tzinfo=timezone.utc)
    return inicio, fin


async def eventos(db: AsyncSession, desde: date, hasta: date, usuario_id: int, solo_mias: bool) -> list[dict]:
    inicio, fin = _limites(desde, hasta)

    consulta_tareas = (
        select(TareaModel, ProyectoModel.nombre, TareaColumnaModel.es_final, UsuarioModel.nombre)
        .join(ProyectoModel, ProyectoModel.id == TareaModel.proyecto_id)
        .join(TareaColumnaModel, TareaColumnaModel.id == TareaModel.columna_id)
        .outerjoin(UsuarioModel, UsuarioModel.id == TareaModel.usuario_asignado_id)
        .where(TareaModel.fecha_vencimiento >= inicio, TareaModel.fecha_vencimiento < fin)
    )
    if solo_mias:
        consulta_tareas = consulta_tareas.where(TareaModel.usuario_asignado_id == usuario_id)
    resultado = [
        {
            "tipo": "tarea", "id": t.id, "titulo": t.titulo, "fecha": t.fecha_vencimiento.astimezone(timezone.utc).date(),
            "proyecto_id": t.proyecto_id, "proyecto_nombre": proyecto, "terminada": bool(es_final),
            "prioridad": t.prioridad, "asignado": asignado, "asignado_a_mi": t.usuario_asignado_id == usuario_id,
        }
        for t, proyecto, es_final, asignado in (await db.execute(consulta_tareas)).all()
    ]

    proyectos = (await db.execute(
        select(ProyectoModel).where(ProyectoModel.fecha_vencimiento >= inicio, ProyectoModel.fecha_vencimiento < fin)
    )).scalars().all()
    resultado += [
        {
            "tipo": "entrega", "id": p.id, "titulo": p.nombre, "fecha": p.fecha_vencimiento.astimezone(timezone.utc).date(),
            "proyecto_id": p.id, "proyecto_nombre": p.nombre, "estado": p.estado,
        }
        for p in proyectos
    ]
    # Entregas primero en cada dia; luego tareas abiertas antes que terminadas
    return sorted(resultado, key=lambda e: (e["fecha"], e["tipo"] != "entrega", e.get("terminada", False), e["titulo"].lower()))
