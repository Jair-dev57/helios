from __future__ import annotations
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from src.features.historial.models import HistorialCambioModel
from src.features.historial.schemas import EventoActividad

ACCION_TEXTO = {
    "creado": "fue creado",
    "actualizado": "fue actualizado",
    "eliminado": "fue eliminado",
}

PREFIJO_TIPO = {
    "proyecto": "Proyecto",
    "tarea": "Tarea",
}


async def registrar_cambio(
    db: AsyncSession,
    entidad_tipo: str,
    entidad_id: int,
    entidad_nombre: str,
    accion: str,
    proyecto_id: int | None,
    usuario_id: int | None,
    cambios: str | None = None,
    ruta: str | None = None,
    numero_version: int | None = None,
) -> None:
    """Registra un evento de auditoria sobre cualquier entidad (proyecto, tarea, documento)."""
    db.add(
        HistorialCambioModel(
            entidad_tipo=entidad_tipo,
            entidad_id=entidad_id,
            entidad_nombre=entidad_nombre,
            accion=accion,
            cambios=cambios,
            ruta=ruta,
            numero_version=numero_version,
            proyecto_id=proyecto_id,
            usuario_id=usuario_id,
        )
    )
    await db.commit()


def _texto_evento(cambio: HistorialCambioModel) -> str:
    if cambio.entidad_tipo == "documento":
        if cambio.numero_version == 1:
            return f'"{cambio.entidad_nombre}" fue creado'
        return f'"{cambio.entidad_nombre}" se actualizó a v{cambio.numero_version}'
    prefijo = PREFIJO_TIPO.get(cambio.entidad_tipo, cambio.entidad_tipo)
    verbo = ACCION_TEXTO.get(cambio.accion, cambio.accion)
    return f'{prefijo} "{cambio.entidad_nombre}" {verbo}'


async def obtener_historial_combinado(db: AsyncSession, proyecto_id: int, limite: int = 50) -> list[EventoActividad]:
    """Devuelve el timeline unificado de proyecto, tareas y documentos."""
    from src.features.auth.models import UsuarioModel

    result = await db.execute(
        select(HistorialCambioModel, UsuarioModel.nombre)
        .outerjoin(UsuarioModel, HistorialCambioModel.usuario_id == UsuarioModel.id)
        .where(HistorialCambioModel.proyecto_id == proyecto_id)
        .order_by(HistorialCambioModel.created_at.desc())
        .limit(limite)
    )
    eventos = [
        EventoActividad(
            tipo=cambio.entidad_tipo,
            texto=_texto_evento(cambio),
            detalle=cambio.cambios,
            usuario_nombre=nombre_usuario,
            created_at=cambio.created_at,
        )
        for cambio, nombre_usuario in result.all()
    ]
    return eventos
