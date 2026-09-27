import msgspec
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from src.features.documentos.models import DocumentoModel
from src.features.documentos.schemas import DocumentoCrear, DocumentoActualizar
from src.features.documentos.extraccion import extraer_contenido
from src.features.busqueda.services import indexar_entidad, eliminar_indice
from src.features.historial.services import registrar_cambio


def _texto_indexado(documento: DocumentoModel) -> str:
    partes = [documento.nombre]
    if documento.tipo:
        partes.append(documento.tipo)
    contenido = extraer_contenido(documento.ruta, documento.tipo)
    if contenido:
        partes.append(contenido)
    return "\n".join(partes)


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


async def crear_documento(db: AsyncSession, data: DocumentoCrear) -> DocumentoModel:
    documento = DocumentoModel(**msgspec.structs.asdict(data))
    db.add(documento)
    await db.commit()
    await db.refresh(documento)
    await registrar_cambio(
        db, "documento", documento.id, documento.nombre, "creado",
        documento.proyecto_id, documento.usuario_id,
        ruta=documento.ruta, numero_version=1,
    )
    # registrar_cambio hace commit y expira el objeto: recargarlo antes de leer atributos
    await db.refresh(documento)
    await indexar_entidad(db, "documento", documento.id, _texto_indexado(documento))
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
        await db.commit()
        await db.refresh(documento)
        await registrar_cambio(
            db, "documento", documento.id, documento.nombre, "actualizado",
            documento.proyecto_id, usuario_id or documento.usuario_id,
            cambios=notas, ruta=data.ruta, numero_version=documento.version_actual,
        )
        await db.refresh(documento)
    else:
        await db.commit()
        await db.refresh(documento)
    await indexar_entidad(db, "documento", documento.id, _texto_indexado(documento))
    await db.refresh(documento)
    return documento


async def eliminar_documento(db: AsyncSession, documento_id: int) -> bool:
    from src.features.tareas.models import TareaDocumentoModel

    documento = await obtener_documento(db, documento_id)
    if not documento:
        return False
    enlaces = (await db.execute(
        select(TareaDocumentoModel).where(TareaDocumentoModel.documento_id == documento_id)
    )).scalars().all()
    for enlace in enlaces:
        await db.delete(enlace)
    await eliminar_indice(db, "documento", documento_id)
    await registrar_cambio(db, "documento", documento_id, documento.nombre, "eliminado", documento.proyecto_id, None)
    await db.delete(documento)
    await db.commit()
    return True
