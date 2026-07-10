from datetime import datetime, timedelta, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from src.features.proyectos.models import ProyectoModel
from src.features.tareas.models import TareaModel
from src.features.documentos.models import DocumentoModel
from src.features.auth.models import UsuarioModel
from src.features.dashboard.schemas import (
    TareaResumen,
    CargaUsuario,
    ProyectoEnRiesgo,
    DashboardRespuesta,
)


async def obtener_dashboard(db: AsyncSession) -> DashboardRespuesta:
    ahora = datetime.now(timezone.utc)
    en_7_dias = ahora + timedelta(days=7)

    result = await db.execute(
        select(func.count(ProyectoModel.id)).where(ProyectoModel.estado == "activo")
    )
    proyectos_activos = result.scalar_one()

    result = await db.execute(
        select(func.count(TareaModel.id)).where(TareaModel.estado != "hecho")
    )
    tareas_abiertas = result.scalar_one()

    result = await db.execute(select(func.count(DocumentoModel.id)))
    total_documentos = result.scalar_one()

    result = await db.execute(
        select(TareaModel, ProyectoModel.nombre)
        .join(ProyectoModel, TareaModel.proyecto_id == ProyectoModel.id)
        .where(TareaModel.estado != "hecho")
        .where(TareaModel.fecha_vencimiento.isnot(None))
        .where(TareaModel.fecha_vencimiento < ahora)
        .order_by(TareaModel.fecha_vencimiento)
    )
    vencidas_raw = result.all()
    tareas_vencidas = [
        TareaResumen(
            id=t.id,
            titulo=t.titulo,
            proyecto_id=t.proyecto_id,
            proyecto_nombre=nombre_proyecto,
            fecha_vencimiento=t.fecha_vencimiento.isoformat() if t.fecha_vencimiento else None,
            prioridad=t.prioridad,
        )
        for t, nombre_proyecto in vencidas_raw
    ]

    result = await db.execute(
        select(TareaModel, ProyectoModel.nombre)
        .join(ProyectoModel, TareaModel.proyecto_id == ProyectoModel.id)
        .where(TareaModel.estado != "hecho")
        .where(TareaModel.fecha_vencimiento.isnot(None))
        .where(TareaModel.fecha_vencimiento >= ahora)
        .where(TareaModel.fecha_vencimiento <= en_7_dias)
        .order_by(TareaModel.fecha_vencimiento)
    )
    por_vencer_raw = result.all()
    tareas_por_vencer = [
        TareaResumen(
            id=t.id,
            titulo=t.titulo,
            proyecto_id=t.proyecto_id,
            proyecto_nombre=nombre_proyecto,
            fecha_vencimiento=t.fecha_vencimiento.isoformat() if t.fecha_vencimiento else None,
            prioridad=t.prioridad,
        )
        for t, nombre_proyecto in por_vencer_raw
    ]

    result = await db.execute(
        select(TareaModel.estado, func.count(TareaModel.id)).group_by(TareaModel.estado)
    )
    distribucion_estados = {estado: cantidad for estado, cantidad in result.all()}
    for estado in ("por_hacer", "en_progreso", "en_revision", "hecho"):
        distribucion_estados.setdefault(estado, 0)

    result = await db.execute(
        select(UsuarioModel.id, UsuarioModel.nombre, func.count(TareaModel.id))
        .join(TareaModel, TareaModel.usuario_asignado_id == UsuarioModel.id)
        .where(TareaModel.estado != "hecho")
        .group_by(UsuarioModel.id, UsuarioModel.nombre)
        .order_by(func.count(TareaModel.id).desc())
    )
    carga_por_usuario = [
        CargaUsuario(usuario_id=uid, nombre=nombre, total_tareas=total)
        for uid, nombre, total in result.all()
    ]

    conteo_por_proyecto: dict[int, dict] = {}
    for t, nombre_proyecto in vencidas_raw:
        if t.proyecto_id not in conteo_por_proyecto:
            conteo_por_proyecto[t.proyecto_id] = {"nombre": nombre_proyecto, "count": 0}
        conteo_por_proyecto[t.proyecto_id]["count"] += 1

    proyectos_en_riesgo = [
        ProyectoEnRiesgo(proyecto_id=pid, nombre=info["nombre"], tareas_vencidas=info["count"])
        for pid, info in conteo_por_proyecto.items()
    ]
    proyectos_en_riesgo.sort(key=lambda p: p.tareas_vencidas, reverse=True)

    return DashboardRespuesta(
        proyectos_activos=proyectos_activos,
        tareas_abiertas=tareas_abiertas,
        total_documentos=total_documentos,
        tareas_vencidas=tareas_vencidas,
        tareas_por_vencer=tareas_por_vencer,
        distribucion_estados=distribucion_estados,
        carga_por_usuario=carga_por_usuario,
        proyectos_en_riesgo=proyectos_en_riesgo,
    )