from litestar import Controller, get, post, put, delete
from litestar.exceptions import NotFoundException
from sqlalchemy.ext.asyncio import AsyncSession
from src.features.auth.schemas import UsuarioCrear, UsuarioActualizar, UsuarioRespuesta
from src.features.auth import services

class UsuarioController(Controller):
    path = "/usuarios"

    @get()
    async def listar(self, db_session: AsyncSession) -> list[UsuarioRespuesta]:
        return await services.obtener_usuarios(db_session)

    @get("/{usuario_id:int}")
    async def obtener(self, db_session: AsyncSession, usuario_id: int) -> UsuarioRespuesta:
        usuario = await services.obtener_usuario(db_session, usuario_id)
        if not usuario:
            raise NotFoundException(detail="Usuario no encontrado")
        return usuario

    @post()
    async def crear(self, db_session: AsyncSession, data: UsuarioCrear) -> UsuarioRespuesta:
        return await services.crear_usuario(db_session, data)

    @put("/{usuario_id:int}")
    async def actualizar(self, db_session: AsyncSession, usuario_id: int, data: UsuarioActualizar) -> UsuarioRespuesta:
        usuario = await services.actualizar_usuario(db_session, usuario_id, data)
        if not usuario:
            raise NotFoundException(detail="Usuario no encontrado")
        return usuario

    @delete("/{usuario_id:int}")
    async def eliminar(self, db_session: AsyncSession, usuario_id: int) -> None:
        eliminado = await services.eliminar_usuario(db_session, usuario_id)
        if not eliminado:
            raise NotFoundException(detail="Usuario no encontrado")