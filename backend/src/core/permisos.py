from litestar import Request
from litestar.exceptions import PermissionDeniedException
from sqlalchemy.ext.asyncio import AsyncSession


async def requerir_admin(db_session: AsyncSession, request: Request) -> None:
    """Lanza 403 si el rol del usuario autenticado no es de administrador."""
    from src.features.roles.services import obtener_rol_por_nombre

    if not request.user:
        raise PermissionDeniedException(detail="No autenticado")
    rol = await obtener_rol_por_nombre(db_session, request.user.get("rol") or "")
    if not rol or not rol.es_administrador:
        raise PermissionDeniedException(detail="Solo un administrador puede realizar esta accion")


async def requerir_seccion(db_session: AsyncSession, request: Request, seccion: str) -> None:
    """Lanza 403 si el rol del usuario no tiene acceso a la seccion indicada."""
    from src.features.roles.services import usuario_tiene_seccion

    if not request.user:
        raise PermissionDeniedException(detail="No autenticado")
    rol_nombre = request.user.get("rol")
    if not rol_nombre:
        raise PermissionDeniedException(detail="Usuario sin rol asignado")
    tiene_acceso = await usuario_tiene_seccion(db_session, rol_nombre, seccion)
    if not tiene_acceso:
        raise PermissionDeniedException(detail=f"Tu rol no tiene acceso a la seccion '{seccion}'")
