from litestar import Request
from litestar.exceptions import PermissionDeniedException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession


def id_usuario(request: Request) -> int | None:
    """Id del usuario autenticado, o None si la peticion no trae sesion."""
    return int(request.user["id"]) if request.user else None


async def usuario_es_admin(db_session: AsyncSession, usuario_id: int | None) -> bool:
    from src.features.auth.models import UsuarioModel

    if usuario_id is None:
        return False
    usuario = await db_session.get(UsuarioModel, usuario_id)
    return bool(usuario and usuario.activo and usuario.es_administrador)


async def es_admin(db_session: AsyncSession, request: Request) -> bool:
    """True si el usuario autenticado es administrador (acceso total)."""
    return await usuario_es_admin(db_session, id_usuario(request))


async def secciones_de(db_session: AsyncSession, usuario_id: int | None) -> list[str]:
    """Lo que puede usar una persona: todo si es administradora; si no, el Acceso basico mas lo que suman
    los equipos de los que es miembro."""
    from src.core.secciones import SECCIONES_DISPONIBLES
    from src.features.espacios.models import AccesoBasicoModel, EquipoSeccionModel, EspacioMiembroModel

    if usuario_id is None:
        return []
    if await usuario_es_admin(db_session, usuario_id):
        return list(SECCIONES_DISPONIBLES)
    basico = set((await db_session.execute(select(AccesoBasicoModel.seccion))).scalars().all())
    de_equipos = set((await db_session.execute(
        select(EquipoSeccionModel.seccion).where(EquipoSeccionModel.equipo_id.in_(
            select(EspacioMiembroModel.proyecto_id).where(EspacioMiembroModel.usuario_id == usuario_id)
        ))
    )).scalars().all())
    return [s for s in SECCIONES_DISPONIBLES if s in basico | de_equipos]


async def requerir_admin(db_session: AsyncSession, request: Request) -> None:
    """Lanza 403 si el usuario autenticado no es administrador."""
    if not request.user:
        raise PermissionDeniedException(detail="No autenticado")
    if not await es_admin(db_session, request):
        raise PermissionDeniedException(detail="Solo un administrador puede realizar esta accion")


async def requerir_seccion(db_session: AsyncSession, request: Request, seccion: str) -> None:
    """Lanza 403 si el usuario no tiene la seccion (ni por el Acceso basico ni por sus equipos)."""
    if not request.user:
        raise PermissionDeniedException(detail="No autenticado")
    if seccion not in await secciones_de(db_session, id_usuario(request)):
        raise PermissionDeniedException(detail=f"No tienes acceso a la seccion '{seccion}'")
