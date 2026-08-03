import msgspec
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.features.busqueda.services import eliminar_indice, indexar_entidad
from src.features.proyectos.models import ProyectoModel
from src.features.proyectos.schemas import ProyectoActualizar, ProyectoCrear


def _texto_indexado(proyecto: ProyectoModel) -> str:
    partes = [proyecto.nombre]
    if proyecto.descripcion:
        partes.append(proyecto.descripcion)
    if proyecto.estado:
        partes.append(proyecto.estado)
    return "\n".join(partes)


async def obtener_proyectos(db: AsyncSession) -> list[ProyectoModel]:
    result = await db.execute(select(ProyectoModel))
    return result.scalars().all()


async def obtener_proyecto(db: AsyncSession, proyecto_id: int) -> ProyectoModel | None:
    result = await db.execute(select(ProyectoModel).where(ProyectoModel.id == proyecto_id))
    return result.scalar_one_or_none()


async def crear_proyecto(db: AsyncSession, data: ProyectoCrear) -> ProyectoModel:
    proyecto = ProyectoModel(**msgspec.structs.asdict(data))
    db.add(proyecto)
    await db.commit()
    await db.refresh(proyecto)
    await indexar_entidad(db, "proyecto", proyecto.id, _texto_indexado(proyecto))
    await db.refresh(proyecto)
    return proyecto


async def actualizar_proyecto(db: AsyncSession, proyecto_id: int, data: ProyectoActualizar) -> ProyectoModel | None:
    proyecto = await obtener_proyecto(db, proyecto_id)
    if not proyecto:
        return None
    for campo, valor in msgspec.structs.asdict(data).items():
        if valor is not None:
            setattr(proyecto, campo, valor)
    await db.commit()
    await db.refresh(proyecto)
    await indexar_entidad(db, "proyecto", proyecto.id, _texto_indexado(proyecto))
    await db.refresh(proyecto)
    return proyecto


async def eliminar_proyecto(db: AsyncSession, proyecto_id: int) -> bool:
    proyecto = await obtener_proyecto(db, proyecto_id)
    if not proyecto:
        return False
    await eliminar_indice(db, "proyecto", proyecto_id)
    await db.delete(proyecto)
    await db.commit()
    return True