import msgspec
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from src.features.clientes.models import ClienteModel
from src.features.clientes.schemas import ClienteCrear, ClienteActualizar


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
    return cliente


async def eliminar_cliente(db: AsyncSession, cliente_id: int) -> bool:
    cliente = await obtener_cliente(db, cliente_id)
    if not cliente:
        return False
    await db.delete(cliente)
    await db.commit()
    return True