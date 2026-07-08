from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from src.features.proyectos.models import ProyectoModel
from src.features.proyectos.schemas import ProyectoCrear, ProyectoActualizar

async def obtener_proyectos(db: AsyncSession) -> list[ProyectoModel]:
    result = await db.execute(select(ProyectoModel))
    return result.scalars().all()

async def obtener_proyecto(db: AsyncSession, proyecto_id: int) -> ProyectoModel | None:
    result = await db.execute(select(ProyectoModel).where(ProyectoModel.id == proyecto_id))
    return result.scalar_one_or_none()

async def crear_proyecto(db: AsyncSession, data: ProyectoCrear) -> ProyectoModel:
    proyecto = ProyectoModel(**data.__dict__)
    db.add(proyecto)
    await db.commit()
    await db.refresh(proyecto)
    return proyecto

async def actualizar_proyecto(db: AsyncSession, proyecto_id: int, data: ProyectoActualizar) -> ProyectoModel | None:
    proyecto = await obtener_proyecto(db, proyecto_id)
    if not proyecto:
        return None
    for campo, valor in data.__dict__.items():
        if valor is not None:
            setattr(proyecto, campo, valor)
    await db.commit()
    await db.refresh(proyecto)
    return proyecto

async def eliminar_proyecto(db: AsyncSession, proyecto_id: int) -> bool:
    proyecto = await obtener_proyecto(db, proyecto_id)
    if not proyecto:
        return False
    await db.delete(proyecto)
    await db.commit()
    return True