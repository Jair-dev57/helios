import msgspec
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from src.features.documentos.models import DocumentoModel, DocumentoVersionModel
from src.features.documentos.schemas import DocumentoCrear, DocumentoActualizar


async def obtener_documentos(db: AsyncSession) -> list[DocumentoModel]:
    result = await db.execute(select(DocumentoModel))
    return result.scalars().all()


async def obtener_documento(db: AsyncSession, documento_id: int) -> DocumentoModel | None:
    result = await db.execute(select(DocumentoModel).where(DocumentoModel.id == documento_id))
    return result.scalar_one_or_none()


async def crear_documento(db: AsyncSession, data: DocumentoCrear) -> DocumentoModel:
    documento = DocumentoModel(**msgspec.structs.asdict(data))
    db.add(documento)
    await db.commit()
    await db.refresh(documento)
    version = DocumentoVersionModel(
        documento_id=documento.id,
        numero_version=1,
        ruta=documento.ruta,
        usuario_id=documento.usuario_id,
    )
    db.add(version)
    await db.commit()
    return documento


async def actualizar_documento(db: AsyncSession, documento_id: int, data: DocumentoActualizar) -> DocumentoModel | None:
    documento = await obtener_documento(db, documento_id)
    if not documento:
        return None
    campos = msgspec.structs.asdict(data)
    for campo, valor in campos.items():
        if valor is not None:
            setattr(documento, campo, valor)
    if data.ruta:
        documento.version_actual += 1
        version = DocumentoVersionModel(
            documento_id=documento.id,
            numero_version=documento.version_actual,
            ruta=data.ruta,
            usuario_id=documento.usuario_id,
        )
        db.add(version)
    await db.commit()
    await db.refresh(documento)
    return documento


async def eliminar_documento(db: AsyncSession, documento_id: int) -> bool:
    documento = await obtener_documento(db, documento_id)
    if not documento:
        return False
    await db.delete(documento)
    await db.commit()
    return True