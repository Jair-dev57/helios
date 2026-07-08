import msgspec
from litestar import Controller, get, post, put, delete, Request
from litestar.exceptions import NotFoundException, NotAuthorizedException
from sqlalchemy.ext.asyncio import AsyncSession
from src.features.auth.schemas import (
    UsuarioCrear,
    UsuarioActualizar,
    UsuarioRespuesta,
    LoginRequest,
    LoginRespuesta,
)
from src.features.auth.services import (
    obtener_usuarios,
    obtener_usuario,
    autenticar_usuario,
    crear_usuario,
    actualizar_usuario,
    eliminar_usuario,
)
from src.core.security import jwt_auth


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
            access_token=token,
        )

    @get("/me")
    async def me(self, request: Request, db_session: AsyncSession) -> UsuarioRespuesta:
        if not request.user:
            raise NotAuthorizedException("No autenticado")
        usuario = await obtener_usuario(db_session, int(request.user["id"]))
        if not usuario:
            raise NotFoundException(detail="Usuario no encontrado")
        return msgspec.convert(usuario, UsuarioRespuesta, from_attributes=True)


class UsuarioController(Controller):
    path = "/usuarios"
    tags = ["Usuarios"]

    @get()
    async def listar(self, db_session: AsyncSession) -> list[UsuarioRespuesta]:
        usuarios = await obtener_usuarios(db_session)
        return [msgspec.convert(u, UsuarioRespuesta, from_attributes=True) for u in usuarios]

    @get("/{usuario_id:int}")
    async def obtener(self, db_session: AsyncSession, usuario_id: int) -> UsuarioRespuesta:
        usuario = await obtener_usuario(db_session, usuario_id)
        if not usuario:
            raise NotFoundException(detail="Usuario no encontrado")
        return msgspec.convert(usuario, UsuarioRespuesta, from_attributes=True)

    @post()
    async def crear(self, db_session: AsyncSession, data: UsuarioCrear) -> UsuarioRespuesta:
        usuario = await crear_usuario(db_session, data)
        return msgspec.convert(usuario, UsuarioRespuesta, from_attributes=True)

    @put("/{usuario_id:int}")
    async def actualizar(self, db_session: AsyncSession, usuario_id: int, data: UsuarioActualizar) -> UsuarioRespuesta:
        usuario = await actualizar_usuario(db_session, usuario_id, data)
        if not usuario:
            raise NotFoundException(detail="Usuario no encontrado")
        return msgspec.convert(usuario, UsuarioRespuesta, from_attributes=True)

    @delete("/{usuario_id:int}")
    async def eliminar(self, db_session: AsyncSession, usuario_id: int) -> None:
        eliminado = await eliminar_usuario(db_session, usuario_id)
        if not eliminado:
            raise NotFoundException(detail="Usuario no encontrado")