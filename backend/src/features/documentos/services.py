import msgspec
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from src.features.documentos.models import DocumentoModel, DocumentoVersionModel
from src.features.documentos.schemas import DocumentoCrear, DocumentoActualizar



async def obtener_documentos(
    db: AsyncSession,
    proyecto_id: int | None = None,
    carpeta_id: int | None = None,
    sin_carpeta: bool = False,
) -> list[DocumentoModel]:
    query = select(DocumentoModel)
    if proyecto_id is not None:
        query = query.where(DocumentoModel.proyecto_id == proyecto_id)
    if sin_carpeta:
        query = query.where(DocumentoModel.carpeta_id.is_(None))
    elif carpeta_id is not None:
        query = query.where(DocumentoModel.carpeta_id == carpeta_id)
    result = await db.execute(query)
    return result.scalars().all()

async def obtener_documento(db: AsyncSession, documento_id: int) -> DocumentoModel | None:
    result = await db.execute(select(DocumentoModel).where(DocumentoModel.id == documento_id))
    return result.scalar_one_or_none()


async def obtener_versiones_documento(db: AsyncSession, documento_id: int) -> list[DocumentoVersionModel]:
    result = await db.execute(
        select(DocumentoVersionModel)
        .where(DocumentoVersionModel.documento_id == documento_id)
        .order_by(DocumentoVersionModel.numero_version.desc())
    )
    return result.scalars().all()


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
        notas="Version inicial",
    )
    db.add(version)
    await db.commit()
    await db.refresh(documento)
    return documento


async def actualizar_documento(
    db: AsyncSession,
    documento_id: int,
    data: DocumentoActualizar,
    notas: str | None = None,
    usuario_id: int | None = None,
) -> DocumentoModel | None:
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
            usuario_id=usuario_id or documento.usuario_id,
            notas=notas,
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



async def obtener_actividad_documentos(db: AsyncSession, proyecto_id: int, limite: int = 30):
    from src.features.auth.models import UsuarioModel

    result = await db.execute(
        select(
            DocumentoVersionModel,
            DocumentoModel.nombre,
            UsuarioModel.nombre,
        )
        .join(DocumentoModel, DocumentoVersionModel.documento_id == DocumentoModel.id)
        .outerjoin(UsuarioModel, DocumentoVersionModel.usuario_id == UsuarioModel.id)
        .where(DocumentoModel.proyecto_id == proyecto_id)
        .order_by(DocumentoVersionModel.created_at.desc())
        .limit(limite)
    )
    return result.all()