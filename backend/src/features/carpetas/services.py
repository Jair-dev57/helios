import msgspec
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from src.features.carpetas.models import CarpetaModel
from src.features.carpetas.schemas import CarpetaCrear, CarpetaActualizar


async def obtener_carpetas(db: AsyncSession, proyecto_id: int | None = None) -> list[CarpetaModel]:
    query = select(CarpetaModel)
    if proyecto_id is not None:
        query = query.where(CarpetaModel.proyecto_id == proyecto_id)
    result = await db.execute(query)
    return result.scalars().all()


async def obtener_carpeta(db: AsyncSession, carpeta_id: int) -> CarpetaModel | None:
    result = await db.execute(select(CarpetaModel).where(CarpetaModel.id == carpeta_id))
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


async def contar_archivos_en_arbol(db: AsyncSession, carpeta_id: int) -> int:
    """Cuenta los documentos de la carpeta y de todas sus subcarpetas."""
    from src.features.documentos.models import DocumentoModel

    ids = [carpeta_id]
    pendientes = [carpeta_id]
    while pendientes:
        hijos = (await db.execute(
            select(CarpetaModel.id).where(CarpetaModel.carpeta_padre_id.in_(pendientes))
        )).scalars().all()
        ids.extend(hijos)
        pendientes = list(hijos)
    return (await db.execute(
        select(func.count()).select_from(DocumentoModel).where(DocumentoModel.carpeta_id.in_(ids))
    )).scalar_one()


async def eliminar_carpeta(db: AsyncSession, carpeta_id: int) -> bool:
    carpeta = await obtener_carpeta(db, carpeta_id)
    if not carpeta:
        return False
    await db.delete(carpeta)
    await db.commit()
    return True