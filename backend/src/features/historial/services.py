from __future__ import annotations
from datetime import datetime
from sqlalchemy import and_, not_, select, tuple_
from sqlalchemy.ext.asyncio import AsyncSession
from src.features.historial.models import HistorialCambioModel
from src.features.historial.schemas import EventoActividad

ACCION_TEXTO = {
    "creado": "fue creado",
    "actualizado": "fue actualizado",
    "completado": "se completó",
    "eliminado": "fue eliminado",
    "restringido": "se restringió",
    "acceso_abierto": "volvió a ser visible para todo el equipo",
    "papelera": "se movió a la papelera",
    "restaurado": "se restauró de la papelera",
    "recibido": "se recibió por un enlace para solicitar archivos",
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
        # Cambios sin version nueva (renombrar, mover, eliminar) usan el texto de la accion
        if cambio.numero_version is None:
            return f'"{cambio.entidad_nombre}" {ACCION_TEXTO.get(cambio.accion, cambio.accion)}'
        if cambio.numero_version == 1:
            return f'"{cambio.entidad_nombre}" fue creado'
        return f'"{cambio.entidad_nombre}" se actualizó a v{cambio.numero_version}'
    prefijo = PREFIJO_TIPO.get(cambio.entidad_tipo, cambio.entidad_tipo)
    verbo = ACCION_TEXTO.get(cambio.accion, cambio.accion)
    return f'{prefijo} "{cambio.entidad_nombre}" {verbo}'


async def obtener_historial_combinado(
    db: AsyncSession,
    proyecto_id: int | None,
    limite: int = 50,
    documentos_ocultos: set[int] | None = None,
    *,
    tipo: str | None = None,
    usuario_id: int | None = None,
    antes_de: int | None = None,
    desde: datetime | None = None,
    hasta: datetime | None = None,
) -> list[EventoActividad]:
    """Devuelve el timeline unificado de proyecto, tareas y documentos; sin proyecto, el de todos.

    Los eventos de documentos_ocultos (restringidos para quien consulta) no se incluyen.
    tipo, usuario_id y el rango [desde, hasta) filtran; antes_de (id de un evento) pagina hacia atras.
    """
    from src.features.auth.models import UsuarioModel
    from src.features.proyectos.models import ProyectoModel

    consulta = (
        select(HistorialCambioModel, UsuarioModel.nombre, UsuarioModel.avatar_url, ProyectoModel.nombre)
        .outerjoin(UsuarioModel, HistorialCambioModel.usuario_id == UsuarioModel.id)
        .outerjoin(ProyectoModel, HistorialCambioModel.proyecto_id == ProyectoModel.id)
        .order_by(HistorialCambioModel.created_at.desc(), HistorialCambioModel.id.desc())
        .limit(limite)
    )
    if proyecto_id is not None:
        consulta = consulta.where(HistorialCambioModel.proyecto_id == proyecto_id)
    if tipo:
        consulta = consulta.where(HistorialCambioModel.entidad_tipo == tipo)
    if usuario_id is not None:
        consulta = consulta.where(HistorialCambioModel.usuario_id == usuario_id)
    if desde is not None:
        consulta = consulta.where(HistorialCambioModel.created_at >= desde)
    if hasta is not None:
        consulta = consulta.where(HistorialCambioModel.created_at < hasta)
    if antes_de is not None:
        # Mismo orden que el listado (fecha y luego id): sigue justo despues del ultimo evento mostrado
        fecha = (await db.execute(
            select(HistorialCambioModel.created_at).where(HistorialCambioModel.id == antes_de)
        )).scalar_one_or_none()
        if fecha is not None:
            consulta = consulta.where(
                tuple_(HistorialCambioModel.created_at, HistorialCambioModel.id) < tuple_(fecha, antes_de)
            )
    if documentos_ocultos:
        consulta = consulta.where(not_(and_(
            HistorialCambioModel.entidad_tipo == "documento",
            HistorialCambioModel.entidad_id.in_(documentos_ocultos),
        )))
    result = await db.execute(consulta)
    eventos = [
        EventoActividad(
            tipo=cambio.entidad_tipo,
            texto=_texto_evento(cambio),
            detalle=cambio.cambios,
            usuario_nombre=nombre_usuario,
            created_at=cambio.created_at,
            usuario_id=cambio.usuario_id,
            proyecto_id=cambio.proyecto_id,
            proyecto_nombre=nombre_proyecto,
            id=cambio.id,
            entidad_id=cambio.entidad_id,
            accion=cambio.accion,
            usuario_avatar_url=avatar,
            entidad_nombre=cambio.entidad_nombre,
            numero_version=cambio.numero_version,
        )
        for cambio, nombre_usuario, avatar, nombre_proyecto in result.all()
    ]
    return eventos
