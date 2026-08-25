import msgspec
from litestar import Controller, get, post, put, delete, Request
from litestar.exceptions import NotFoundException
from sqlalchemy.ext.asyncio import AsyncSession
from src.core.permisos import requerir_seccion
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
    async def listar(self, request: Request, db_session: AsyncSession) -> list[ClienteRespuesta]:
        await requerir_seccion(db_session, request, "clientes")
        clientes = await obtener_clientes(db_session)
        return [msgspec.convert(c, ClienteRespuesta, from_attributes=True) for c in clientes]

    @get("/{cliente_id:int}")
    async def obtener(self, request: Request, db_session: AsyncSession, cliente_id: int) -> ClienteRespuesta:
        await requerir_seccion(db_session, request, "clientes")
        cliente = await obtener_cliente(db_session, cliente_id)
        if not cliente:
            raise NotFoundException(detail="Cliente no encontrado")
        return msgspec.convert(cliente, ClienteRespuesta, from_attributes=True)

    @post()
    async def crear(self, request: Request, db_session: AsyncSession, data: ClienteCrear) -> ClienteRespuesta:
        await requerir_seccion(db_session, request, "clientes")
        cliente = await crear_cliente(db_session, data)
        return msgspec.convert(cliente, ClienteRespuesta, from_attributes=True)

    @put("/{cliente_id:int}")
    async def actualizar(self, request: Request, db_session: AsyncSession, cliente_id: int, data: ClienteActualizar) -> ClienteRespuesta:
        await requerir_seccion(db_session, request, "clientes")
        cliente = await actualizar_cliente(db_session, cliente_id, data)
        if not cliente:
            raise NotFoundException(detail="Cliente no encontrado")
        return msgspec.convert(cliente, ClienteRespuesta, from_attributes=True)

    @delete("/{cliente_id:int}")
    async def eliminar(self, request: Request, db_session: AsyncSession, cliente_id: int) -> None:
        await requerir_seccion(db_session, request, "clientes")
        eliminado = await eliminar_cliente(db_session, cliente_id)
        if not eliminado:
            raise NotFoundException(detail="Cliente no encontrado")
