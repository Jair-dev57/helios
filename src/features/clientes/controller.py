from litestar import Controller, get, post, put, delete
from litestar.exceptions import NotFoundException
from sqlalchemy.ext.asyncio import AsyncSession
from src.features.clientes.schemas import ClienteCrear, ClienteActualizar, ClienteRespuesta
from src.features.clientes.services import (
    obtener_clientes,
    obtener_cliente,
    crear_cliente,
    actualizar_cliente,
    eliminar_cliente
)

class ClienteController(Controller):
    path = "/clientes"
    tags = ["Clientes"]

    @get()
    async def listar(self, db_session: AsyncSession) -> list[ClienteRespuesta]:
        return await obtener_clientes(db_session)

    @get("/{cliente_id:int}")
    async def obtener(self, db_session: AsyncSession, cliente_id: int) -> ClienteRespuesta:
        cliente = await obtener_cliente(db_session, cliente_id)
        if not cliente:
            raise NotFoundException(detail="Cliente no encontrado")
        return cliente

    @post()
    async def crear(self, db_session: AsyncSession, data: ClienteCrear) -> ClienteRespuesta:
        return await crear_cliente(db_session, data)

    @put("/{cliente_id:int}")
    async def actualizar(self, db_session: AsyncSession, cliente_id: int, data: ClienteActualizar) -> ClienteRespuesta:
        cliente = await actualizar_cliente(db_session, cliente_id, data)
        if not cliente:
            raise NotFoundException(detail="Cliente no encontrado")
        return cliente

    @delete("/{cliente_id:int}")
    async def eliminar(self, db_session: AsyncSession, cliente_id: int) -> None:
        eliminado = await eliminar_cliente(db_session, cliente_id)
        if not eliminado:
            raise NotFoundException(detail="Cliente no encontrado")