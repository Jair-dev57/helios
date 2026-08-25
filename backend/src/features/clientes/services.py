import msgspec
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from src.features.busqueda.services import eliminar_indice, indexar_entidad
from src.features.clientes.models import ClienteModel
from src.features.clientes.schemas import ClienteActualizar, ClienteCrear


def _texto_indexado(cliente: ClienteModel) -> str:
    partes = [cliente.nombre]
    if cliente.empresa:
        partes.append(cliente.empresa)
    if cliente.email:
        partes.append(cliente.email)
    if cliente.telefono:
        partes.append(cliente.telefono)
    return "\n".join(partes)


async def obtener_clientes(db: AsyncSession) -> list[ClienteModel]:
    result = await db.execute(select(ClienteModel))
    return result.scalars().all()


async def obtener_cliente(db: AsyncSession, cliente_id: int) -> ClienteModel | None:
    result = await db.execute(select(ClienteModel).where(ClienteModel.id == cliente_id))
    return result.scalar_one_or_none()


async def crear_cliente(db: AsyncSession, data: ClienteCrear) -> ClienteModel:
    cliente = ClienteModel(**msgspec.structs.asdict(data))
    db.add(cliente)
    await db.commit()
    await db.refresh(cliente)
    await indexar_entidad(db, "cliente", cliente.id, _texto_indexado(cliente))
    await db.refresh(cliente)
    return cliente


async def actualizar_cliente(db: AsyncSession, cliente_id: int, data: ClienteActualizar) -> ClienteModel | None:
    cliente = await obtener_cliente(db, cliente_id)
    if not cliente:
        return None
    for campo, valor in msgspec.structs.asdict(data).items():
        if valor is not None:
            setattr(cliente, campo, valor)
    await db.commit()
    await db.refresh(cliente)
    await indexar_entidad(db, "cliente", cliente.id, _texto_indexado(cliente))
    await db.refresh(cliente)
    return cliente


async def desactivar_cliente(db: AsyncSession, cliente_id: int) -> ClienteModel | None:
    cliente = await obtener_cliente(db, cliente_id)
    if not cliente:
        return None
    cliente.activo = not cliente.activo
    await db.commit()
    await db.refresh(cliente)
    return cliente
