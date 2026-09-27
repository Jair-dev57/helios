import msgspec
from litestar import Controller, get, post, put, delete, Request
from litestar.exceptions import NotFoundException
from sqlalchemy.ext.asyncio import AsyncSession
from src.core.permisos import requerir_admin
from src.core.secciones import SECCIONES_DISPONIBLES
from src.features.roles.schemas import (
    RolCrear,
    RolActualizar,
    RolRespuesta,
    SeccionesActualizar,
    SeccionesRespuesta,
)
from src.features.roles.services import (
    obtener_roles,
    obtener_rol,
    crear_rol,
    actualizar_rol,
    eliminar_rol,
    obtener_secciones_rol,
    reemplazar_secciones_rol,
)


class RolController(Controller):
    path = "/roles"
    tags = ["Roles"]

    @get()
    async def listar(self, db_session: AsyncSession) -> list[RolRespuesta]:
        roles = await obtener_roles(db_session)
        return [msgspec.convert(r, RolRespuesta, from_attributes=True) for r in roles]

    @get("/secciones-disponibles")
    async def secciones_disponibles(self) -> list[str]:
        return SECCIONES_DISPONIBLES

    @post()
    async def crear(self, request: Request, db_session: AsyncSession, data: RolCrear) -> RolRespuesta:
        await requerir_admin(db_session, request)
        rol = await crear_rol(db_session, data)
        return msgspec.convert(rol, RolRespuesta, from_attributes=True)

    @put("/{rol_id:int}")
    async def actualizar(self, request: Request, db_session: AsyncSession, rol_id: int, data: RolActualizar) -> RolRespuesta:
        await requerir_admin(db_session, request)
        rol = await actualizar_rol(db_session, rol_id, data)
        if not rol:
            raise NotFoundException(detail="Rol no encontrado")
        return msgspec.convert(rol, RolRespuesta, from_attributes=True)

    @delete("/{rol_id:int}")
    async def eliminar(self, request: Request, db_session: AsyncSession, rol_id: int) -> None:
        await requerir_admin(db_session, request)
        eliminado = await eliminar_rol(db_session, rol_id)
        if not eliminado:
            raise NotFoundException(detail="Rol no encontrado")

    @get("/{rol_id:int}/secciones")
    async def obtener_secciones(self, request: Request, db_session: AsyncSession, rol_id: int) -> SeccionesRespuesta:
        await requerir_admin(db_session, request)
        secciones = await obtener_secciones_rol(db_session, rol_id)
        return SeccionesRespuesta(rol_id=rol_id, secciones=secciones)

    @put("/{rol_id:int}/secciones")
    async def actualizar_secciones(
        self, request: Request, db_session: AsyncSession, rol_id: int, data: SeccionesActualizar
    ) -> SeccionesRespuesta:
        await requerir_admin(db_session, request)
        secciones = await reemplazar_secciones_rol(db_session, rol_id, data.secciones)
        return SeccionesRespuesta(rol_id=rol_id, secciones=secciones)
