from litestar import Controller, get, post, put, delete
from litestar.exceptions import NotFoundException
from sqlalchemy.ext.asyncio import AsyncSession
from src.features.auth.schemas import UsuarioCrear, UsuarioActualizar, UsuarioRespuesta
from src.features.auth.services import (
    obtener_usuarios,
    obtener_usuario,
    crear_usuario,
    actualizar_usuario,
    eliminar_usuario
)

class UsuarioController(Controller):
    path = "/usuarios"
    tags = ["Usuarios"]

    @get()
    async def listar(self, db_session: AsyncSession) -> list[UsuarioRespuesta]:
        return await obtener_usuarios(db_session)

    @get("/{usuario_id:int}")
    async def obtener(self, db_session: AsyncSession, usuario_id: int) -> UsuarioRespuesta:
        usuario = await obtener_usuario(db_session, usuario_id)
        if not usuario:
            raise NotFoundException(detail="Usuario no encontrado")
        return usuario

    @post()
    async def crear(self, db_session: AsyncSession, data: UsuarioCrear) -> UsuarioRespuesta:
        return await crear_usuario(db_session, data)

    @put("/{usuario_id:int}")
    async def actualizar(self, db_session: AsyncSession, usuario_id: int, data: UsuarioActualizar) -> UsuarioRespuesta:
        usuario = await actualizar_usuario(db_session, usuario_id, data)
        if not usuario:
            raise NotFoundException(detail="Usuario no encontrado")
        return usuario

    @delete("/{usuario_id:int}")
    async def eliminar(self, db_session: AsyncSession, usuario_id: int) -> None:
        eliminado = await eliminar_usuario(db_session, usuario_id)
        if not eliminado:
            raise NotFoundException(detail="Usuario no encontrado")