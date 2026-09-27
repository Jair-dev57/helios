from typing import Annotated

import msgspec
from litestar import Controller, get, post, put, delete, Request
from litestar.enums import RequestEncodingType
from litestar.exceptions import NotFoundException, NotAuthorizedException
from litestar.params import Body
from sqlalchemy.ext.asyncio import AsyncSession
from src.core.permisos import requerir_admin
from src.features.auth.models import UsuarioModel
from src.features.auth.schemas import (
    UsuarioCrear,
    UsuarioActualizar,
    UsuarioRespuesta,
    PerfilActualizar,
    CambioPassword,
    ImagenSubida,
    LoginRequest,
    LoginRespuesta,
)
from src.features.auth.services import (
    obtener_usuarios,
    obtener_usuario,
    autenticar_usuario,
    crear_usuario,
    actualizar_usuario,
    actualizar_perfil,
    cambiar_password,
    cambiar_avatar,
    quitar_avatar,
    eliminar_usuario,
)
from src.core.security import jwt_auth
from src.features.roles.services import obtener_rol_por_nombre, obtener_secciones_rol


def _respuesta(usuario: UsuarioModel) -> UsuarioRespuesta:
    return msgspec.convert(usuario, UsuarioRespuesta, from_attributes=True)


async def _usuario_actual(request: Request, db_session: AsyncSession) -> UsuarioModel:
    if not request.user:
        raise NotAuthorizedException("No autenticado")
    usuario = await obtener_usuario(db_session, int(request.user["id"]))
    if not usuario:
        raise NotFoundException(detail="Usuario no encontrado")
    return usuario


class AuthController(Controller):
    path = "/auth"
    tags = ["Autenticación"]

    @post("/login")
    async def login(self, db_session: AsyncSession, data: LoginRequest) -> LoginRespuesta:
        usuario = await autenticar_usuario(db_session, data)
        if not usuario:
            raise NotAuthorizedException("Credenciales inválidas")

        token = jwt_auth.create_token(
            identifier=str(usuario.id),
            token_extras={"email": usuario.email, "rol": usuario.rol, "nombre": usuario.nombre},
        )

        return LoginRespuesta(
            acceso=True,
            mensaje="Inicio de sesión exitoso",
            usuario_id=usuario.id,
            nombre=usuario.nombre,
            email=usuario.email,
            rol=usuario.rol,
            username=usuario.username,
            avatar_url=usuario.avatar_url,
            access_token=token,
        )

    @get("/me")
    async def me(self, request: Request, db_session: AsyncSession) -> UsuarioRespuesta:
        return _respuesta(await _usuario_actual(request, db_session))

    @put("/me")
    async def actualizar_me(self, request: Request, db_session: AsyncSession, data: PerfilActualizar) -> UsuarioRespuesta:
        usuario = await _usuario_actual(request, db_session)
        return _respuesta(await actualizar_perfil(db_session, usuario, data))

    @put("/me/password", status_code=204)
    async def cambiar_mi_password(self, request: Request, db_session: AsyncSession, data: CambioPassword) -> None:
        usuario = await _usuario_actual(request, db_session)
        await cambiar_password(db_session, usuario, data)

    @post("/me/avatar")
    async def subir_mi_avatar(
        self,
        request: Request,
        db_session: AsyncSession,
        data: Annotated[ImagenSubida, Body(media_type=RequestEncodingType.MULTI_PART)],
    ) -> UsuarioRespuesta:
        usuario = await _usuario_actual(request, db_session)
        return _respuesta(await cambiar_avatar(db_session, usuario, data.archivo))

    @delete("/me/avatar", status_code=200)
    async def quitar_mi_avatar(self, request: Request, db_session: AsyncSession) -> UsuarioRespuesta:
        usuario = await _usuario_actual(request, db_session)
        return _respuesta(await quitar_avatar(db_session, usuario))

    @get("/me/secciones")
    async def mis_secciones(self, request: Request, db_session: AsyncSession) -> list[str]:
        if not request.user:
            raise NotAuthorizedException("No autenticado")
        rol = await obtener_rol_por_nombre(db_session, request.user.get("rol", ""))
        if not rol:
            return []
        if rol.es_administrador:
            from src.core.secciones import SECCIONES_DISPONIBLES
            return SECCIONES_DISPONIBLES
        return await obtener_secciones_rol(db_session, rol.id)


class UsuarioController(Controller):
    path = "/usuarios"
    tags = ["Usuarios"]

    @get()
    async def listar(self, db_session: AsyncSession) -> list[UsuarioRespuesta]:
        usuarios = await obtener_usuarios(db_session)
        return [_respuesta(u) for u in usuarios]

    @get("/{usuario_id:int}")
    async def obtener(self, db_session: AsyncSession, usuario_id: int) -> UsuarioRespuesta:
        usuario = await obtener_usuario(db_session, usuario_id)
        if not usuario:
            raise NotFoundException(detail="Usuario no encontrado")
        return _respuesta(usuario)

    @post()
    async def crear(self, request: Request, db_session: AsyncSession, data: UsuarioCrear) -> UsuarioRespuesta:
        await requerir_admin(db_session, request)
        usuario = await crear_usuario(db_session, data)
        return _respuesta(usuario)

    @put("/{usuario_id:int}")
    async def actualizar(self, request: Request, db_session: AsyncSession, usuario_id: int, data: UsuarioActualizar) -> UsuarioRespuesta:
        await requerir_admin(db_session, request)
        usuario = await actualizar_usuario(db_session, usuario_id, data)
        if not usuario:
            raise NotFoundException(detail="Usuario no encontrado")
        return _respuesta(usuario)

    @post("/{usuario_id:int}/avatar")
    async def subir_avatar(
        self,
        request: Request,
        db_session: AsyncSession,
        usuario_id: int,
        data: Annotated[ImagenSubida, Body(media_type=RequestEncodingType.MULTI_PART)],
    ) -> UsuarioRespuesta:
        await requerir_admin(db_session, request)
        usuario = await obtener_usuario(db_session, usuario_id)
        if not usuario:
            raise NotFoundException(detail="Usuario no encontrado")
        return _respuesta(await cambiar_avatar(db_session, usuario, data.archivo))

    @delete("/{usuario_id:int}")
    async def eliminar(self, request: Request, db_session: AsyncSession, usuario_id: int) -> None:
        await requerir_admin(db_session, request)
        eliminado = await eliminar_usuario(db_session, usuario_id)
        if not eliminado:
            raise NotFoundException(detail="Usuario no encontrado")
