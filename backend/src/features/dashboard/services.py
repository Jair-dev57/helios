from datetime import datetime, timedelta, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from src.features.proyectos.models import ProyectoModel
from src.features.tareas.models import TareaColumnaModel, TareaModel
from src.features.documentos.models import DocumentoModel
from src.features.auth.models import UsuarioModel
from src.features.dashboard.schemas import (
    TareaResumen,
    CargaUsuario,
    ProyectoEnRiesgo,
    DashboardRespuesta,
)


# Tareas que no estan en la columna de terminadas de su proyecto
ABIERTA = TareaModel.columna_id.in_(select(TareaColumnaModel.id).where(TareaColumnaModel.es_final.is_(False)))


async def obtener_dashboard(db: AsyncSession) -> DashboardRespuesta:
    ahora = datetime.now(timezone.utc)
    en_7_dias = ahora + timedelta(days=7)

    result = await db.execute(
        select(func.count(ProyectoModel.id)).where(ProyectoModel.estado == "activo")
    )
    proyectos_activos = result.scalar_one()

    result = await db.execute(
        select(func.count(TareaModel.id)).where(ABIERTA)
    )
    tareas_abiertas = result.scalar_one()

    result = await db.execute(select(func.count(DocumentoModel.id)).where(DocumentoModel.eliminado_at.is_(None)))
    total_documentos = result.scalar_one()

    result = await db.execute(
        select(TareaModel, ProyectoModel.nombre)
        .join(ProyectoModel, TareaModel.proyecto_id == ProyectoModel.id)
        .where(ABIERTA)
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
            usuario_asignado_id=t.usuario_asignado_id,
        )
        for t, nombre_proyecto in vencidas_raw
    ]

    result = await db.execute(
        select(TareaModel, ProyectoModel.nombre)
        .join(ProyectoModel, TareaModel.proyecto_id == ProyectoModel.id)
        .where(ABIERTA)
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
            usuario_asignado_id=t.usuario_asignado_id,
        )
        for t, nombre_proyecto in por_vencer_raw
    ]

    # Las columnas son por proyecto: se suman por nombre, en el orden en que suelen aparecer
    result = await db.execute(
        select(TareaColumnaModel.nombre, func.count(TareaModel.id))
        .join(TareaModel, TareaModel.columna_id == TareaColumnaModel.id)
        .group_by(TareaColumnaModel.nombre)
        .order_by(func.min(TareaColumnaModel.orden), TareaColumnaModel.nombre)
    )
    distribucion_estados = {nombre: cantidad for nombre, cantidad in result.all()}

    result = await db.execute(
        select(UsuarioModel.id, UsuarioModel.nombre, func.count(TareaModel.id))
        .join(TareaModel, TareaModel.usuario_asignado_id == UsuarioModel.id)
        .where(ABIERTA)
        .group_by(UsuarioModel.id, UsuarioModel.nombre)
        .order_by(func.count(TareaModel.id).desc())
    )
    vencidas_por_usuario: dict[int, int] = {}
    for t, _ in vencidas_raw:
        if t.usuario_asignado_id:
            vencidas_por_usuario[t.usuario_asignado_id] = vencidas_por_usuario.get(t.usuario_asignado_id, 0) + 1
    carga_por_usuario = [
        CargaUsuario(
            usuario_id=uid,
            nombre=nombre,
            total_tareas=total,
            tareas_vencidas=vencidas_por_usuario.get(uid, 0),
        )
        for uid, nombre, total in result.all()
    ]

    result = await db.execute(
        select(func.count(TareaModel.id)).where(ABIERTA).where(TareaModel.usuario_asignado_id.is_(None))
    )
    tareas_sin_asignar = result.scalar_one()

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
        tareas_sin_asignar=tareas_sin_asignar,
    )