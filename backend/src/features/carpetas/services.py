import msgspec
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from src.features.carpetas.models import CarpetaModel
from src.features.carpetas.schemas import CarpetaCrear, CarpetaActualizar


async def obtener_carpetas(db: AsyncSession, proyecto_id: int | None = None) -> list[CarpetaModel]:
    query = select(CarpetaModel).where(CarpetaModel.eliminado_at.is_(None))
    if proyecto_id is not None:
        query = query.where(CarpetaModel.proyecto_id == proyecto_id)
    result = await db.execute(query)
    return result.scalars().all()


async def obtener_carpeta(db: AsyncSession, carpeta_id: int) -> CarpetaModel | None:
    result = await db.execute(
        select(CarpetaModel).where(CarpetaModel.id == carpeta_id, CarpetaModel.eliminado_at.is_(None))
    )
    return result.scalar_one_or_none()


async def crear_carpeta(db: AsyncSession, data: CarpetaCrear) -> CarpetaModel:
    # Omitir los None para que la base de datos aplique sus valores por defecto (color amarillo)
    campos = {k: v for k, v in msgspec.structs.asdict(data).items() if v is not None}
    carpeta = CarpetaModel(**campos)
    db.add(carpeta)
    await db.commit()
    await db.refresh(carpeta)
    return carpeta


async def actualizar_carpeta(db: AsyncSession, carpeta_id: int, data: CarpetaActualizar) -> CarpetaModel | None:
    carpeta = await obtener_carpeta(db, carpeta_id)
    if not carpeta:
        return None
    for campo, valor in msgspec.structs.asdict(data).items():
        if valor is not None:
            setattr(carpeta, campo, valor)
    await db.commit()
    await db.refresh(carpeta)
    return carpeta
