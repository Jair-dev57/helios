import msgspec
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from src.features.tareas.models import TareaModel
from src.features.tareas.schemas import TareaCrear, TareaActualizar


async def obtener_tareas(db: AsyncSession, proyecto_id: int | None = None) -> list[TareaModel]:
    query = select(TareaModel).order_by(TareaModel.orden)
    if proyecto_id is not None:
        query = query.where(TareaModel.proyecto_id == proyecto_id)
    result = await db.execute(query)
    return result.scalars().all()


async def obtener_tarea(db: AsyncSession, tarea_id: int) -> TareaModel | None:
    result = await db.execute(select(TareaModel).where(TareaModel.id == tarea_id))
    return result.scalar_one_or_none()


async def crear_tarea(db: AsyncSession, data: TareaCrear) -> TareaModel:
    tarea = TareaModel(**msgspec.structs.asdict(data))
    db.add(tarea)
    await db.commit()
    await db.refresh(tarea)
    return tarea


async def actualizar_tarea(db: AsyncSession, tarea_id: int, data: TareaActualizar) -> TareaModel | None:
    tarea = await obtener_tarea(db, tarea_id)
    if not tarea:
        return None
    for campo, valor in msgspec.structs.asdict(data).items():
        if valor is not None:
            setattr(tarea, campo, valor)
    await db.commit()
    await db.refresh(tarea)
    return tarea


async def eliminar_tarea(db: AsyncSession, tarea_id: int) -> bool:
    tarea = await obtener_tarea(db, tarea_id)
    if not tarea:
        return False
    await db.delete(tarea)
    await db.commit()
    return True