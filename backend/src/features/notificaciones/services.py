from datetime import datetime, timezone

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from src.features.notificaciones.models import NotificacionModel

# El panel muestra las mas recientes; las viejas siguen guardadas
LIMITE = 30


async def usuarios_que_pueden_ver(db: AsyncSession, documento, candidatos: set[int]) -> set[int]:
    """De los candidatos, los usuarios activos que pueden ver el documento (restringido: admins y compartidos)."""
    from src.features.auth.models import UsuarioModel
    from src.features.documentos.models import DocumentoAccesoModel
    from src.features.roles.models import RolModel

    if not candidatos:
        return set()
    activos = set((await db.execute(
        select(UsuarioModel.id).where(UsuarioModel.id.in_(candidatos), UsuarioModel.activo.is_(True))
    )).scalars().all())
    if not documento.restringido:
        return activos
    admins = set((await db.execute(
        select(UsuarioModel.id)
        .join(RolModel, RolModel.nombre == UsuarioModel.rol)
        .where(UsuarioModel.id.in_(activos), RolModel.es_administrador.is_(True))
    )).scalars().all())
    compartidos = set((await db.execute(
        select(DocumentoAccesoModel.usuario_id).where(DocumentoAccesoModel.documento_id == documento.id)
    )).scalars().all())
    return activos & (admins | compartidos)


async def notificar(
    db: AsyncSession,
    usuario_ids: set[int],
    tipo: str,
    texto: str,
    *,
    documento_id: int | None = None,
    proyecto_id: int | None = None,
    actor_id: int | None = None,
) -> None:
    """Crea el aviso para cada usuario (nunca para quien hizo la accion)."""
    destinatarios = {u for u in usuario_ids if u and u != actor_id}
    for usuario_id in destinatarios:
        db.add(NotificacionModel(
            usuario_id=usuario_id, tipo=tipo, texto=texto[:500],
            documento_id=documento_id, proyecto_id=proyecto_id, actor_id=actor_id,
        ))
    if destinatarios:
        await db.commit()


async def listar(db: AsyncSession, usuario_id: int) -> tuple[list[dict], int]:
    """(las mas recientes, cuantas sin leer)."""
    from src.features.auth.models import UsuarioModel

    filas = (await db.execute(
        select(NotificacionModel, UsuarioModel.nombre, UsuarioModel.avatar_url)
        .outerjoin(UsuarioModel, NotificacionModel.actor_id == UsuarioModel.id)
        .where(NotificacionModel.usuario_id == usuario_id)
        .order_by(NotificacionModel.created_at.desc())
        .limit(LIMITE)
    )).all()
    no_leidas = (await db.execute(
        select(func.count()).select_from(NotificacionModel).where(
            NotificacionModel.usuario_id == usuario_id, NotificacionModel.leida_at.is_(None)
        )
    )).scalar_one()
    return [
        {
            "id": n.id, "tipo": n.tipo, "texto": n.texto, "documento_id": n.documento_id,
            "proyecto_id": n.proyecto_id, "actor": nombre, "actor_avatar_url": avatar,
            "leida": n.leida_at is not None, "created_at": n.created_at,
        }
        for n, nombre, avatar in filas
    ], no_leidas


async def marcar_leidas(db: AsyncSession, usuario_id: int, notificacion_id: int | None = None) -> None:
    """Marca una notificacion (o todas, sin id) del usuario como leida."""
    consulta = update(NotificacionModel).where(
        NotificacionModel.usuario_id == usuario_id, NotificacionModel.leida_at.is_(None)
    )
    if notificacion_id is not None:
        consulta = consulta.where(NotificacionModel.id == notificacion_id)
    await db.execute(consulta.values(leida_at=datetime.now(timezone.utc)))
    await db.commit()
