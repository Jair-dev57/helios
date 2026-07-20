import msgspec
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from src.features.tareas.models import TareaModel, TareaDocumentoModel
from src.features.documentos.models import DocumentoModel
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


async def agregar_documento_a_tarea(db: AsyncSession, tarea_id: int, documento_id: int) -> None:
    existe = await db.execute(
        select(TareaDocumentoModel).where(
            TareaDocumentoModel.tarea_id == tarea_id,
            TareaDocumentoModel.documento_id == documento_id,
        )
    )
    if existe.scalar_one_or_none():
        return
    enlace = TareaDocumentoModel(tarea_id=tarea_id, documento_id=documento_id)
    db.add(enlace)
    await db.commit()


async def quitar_documento_de_tarea(db: AsyncSession, tarea_id: int, documento_id: int) -> None:
    enlace = await db.execute(
        select(TareaDocumentoModel).where(
            TareaDocumentoModel.tarea_id == tarea_id,
            TareaDocumentoModel.documento_id == documento_id,
        )
    )
    obj = enlace.scalar_one_or_none()
    if obj:
        await db.delete(obj)
        await db.commit()


async def obtener_documentos_de_tarea(db: AsyncSession, tarea_id: int):
    result = await db.execute(
        select(DocumentoModel)
        .join(TareaDocumentoModel, TareaDocumentoModel.documento_id == DocumentoModel.id)
        .where(TareaDocumentoModel.tarea_id == tarea_id)
    )
    return result.scalars().all()


async def obtener_conteo_documentos_por_tareas(db: AsyncSession, tarea_ids: list[int]) -> dict[int, int]:
    if not tarea_ids:
        return {}
    result = await db.execute(
        select(TareaDocumentoModel.tarea_id, func.count(TareaDocumentoModel.id))
        .where(TareaDocumentoModel.tarea_id.in_(tarea_ids))
        .group_by(TareaDocumentoModel.tarea_id)
    )
    return dict(result.all())