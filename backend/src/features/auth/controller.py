from typing import Annotated

import msgspec
from litestar import Controller, get, post, put, delete, Request
from litestar.enums import RequestEncodingType
from litestar.exceptions import NotFoundException, NotAuthorizedException, ValidationException
from litestar.params import Body
from sqlalchemy.ext.asyncio import AsyncSession
from src.core.permisos import id_usuario, requerir_admin, secciones_de
from src.features.auth.models import UsuarioModel
from src.features.auth.schemas import (
    UsuarioCrear,
    UsuarioActualizar,
    UsuarioRespuesta,
    MiUsuarioRespuesta,
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
    equipos_de,
)
from src.core.security import jwt_auth


def _respuesta(usuario: UsuarioModel, equipo_ids: list[int] | None = None) -> UsuarioRespuesta:
    respuesta = msgspec.convert(usuario, UsuarioRespuesta, from_attributes=True)
    respuesta.equipo_ids = equipo_ids or []
    return respuesta


async def _respuestas(db: AsyncSession, usuarios: list[UsuarioModel]) -> list[UsuarioRespuesta]:
    equipos = await equipos_de(db, [u.id for u in usuarios])
    return [_respuesta(u, equipos[u.id]) for u in usuarios]


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
            es_administrador=usuario.es_administrador,
            access_token=token,
        )

    @get("/me")
    async def me(self, request: Request, db_session: AsyncSession) -> MiUsuarioRespuesta:
        usuario = await _usuario_actual(request, db_session)
        respuesta = msgspec.convert(usuario, MiUsuarioRespuesta, from_attributes=True)
        respuesta.equipo_ids = (await equipos_de(db_session, [usuario.id]))[usuario.id]
        return respuesta

    @put("/me")
    async def actualizar_me(self, request: Request, db_session: AsyncSession, data: PerfilActualizar) -> UsuarioRespuesta:
        usuario = await _usuario_actual(request, db_session)
        return (await _respuestas(db_session, [await actualizar_perfil(db_session, usuario, data)]))[0]

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
        return (await _respuestas(db_session, [await cambiar_avatar(db_session, usuario, data.archivo)]))[0]

    @delete("/me/avatar", status_code=200)
    async def quitar_mi_avatar(self, request: Request, db_session: AsyncSession) -> UsuarioRespuesta:
        usuario = await _usuario_actual(request, db_session)
        return (await _respuestas(db_session, [await quitar_avatar(db_session, usuario)]))[0]

    @get("/me/secciones")
    async def mis_secciones(self, request: Request, db_session: AsyncSession) -> list[str]:
        """Lo que puede usar: el Acceso basico mas lo de sus equipos, o todo si es administrador."""
        if not request.user:
            raise NotAuthorizedException("No autenticado")
        return await secciones_de(db_session, id_usuario(request))


class UsuarioController(Controller):
    path = "/usuarios"
    tags = ["Usuarios"]

    @get()
    async def listar(self, db_session: AsyncSession) -> list[UsuarioRespuesta]:
        return await _respuestas(db_session, await obtener_usuarios(db_session))

    @get("/{usuario_id:int}")
    async def obtener(self, db_session: AsyncSession, usuario_id: int) -> UsuarioRespuesta:
        usuario = await obtener_usuario(db_session, usuario_id)
        if not usuario:
            raise NotFoundException(detail="Usuario no encontrado")
        return (await _respuestas(db_session, [usuario]))[0]

    @post()
    async def crear(self, request: Request, db_session: AsyncSession, data: UsuarioCrear) -> UsuarioRespuesta:
        await requerir_admin(db_session, request)
        usuario = await crear_usuario(db_session, data)
        return (await _respuestas(db_session, [usuario]))[0]

    @put("/{usuario_id:int}")
    async def actualizar(self, request: Request, db_session: AsyncSession, usuario_id: int, data: UsuarioActualizar) -> UsuarioRespuesta:
        await requerir_admin(db_session, request)
        # Nadie se quita a si mismo el acceso de administrador ni se desactiva (quedaria fuera)
        if usuario_id == id_usuario(request) and (data.es_administrador is False or data.activo is False):
            raise ValidationException(detail="No puedes quitarte el acceso de administrador ni desactivarte")
        usuario = await actualizar_usuario(db_session, usuario_id, data)
        if not usuario:
            raise NotFoundException(detail="Usuario no encontrado")
        return (await _respuestas(db_session, [usuario]))[0]

    @delete("/{usuario_id:int}")
    async def eliminar(self, request: Request, db_session: AsyncSession, usuario_id: int) -> None:
        await requerir_admin(db_session, request)
        eliminado = await eliminar_usuario(db_session, usuario_id)
        if not eliminado:
            raise NotFoundException(detail="Usuario no encontrado")
