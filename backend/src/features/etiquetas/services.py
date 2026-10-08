from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.features.documentos.models import DocumentoModel
from src.features.etiquetas.models import DocumentoEtiquetaModel, EtiquetaModel


async def listar(db: AsyncSession, proyecto_id: int, ocultos: set[int]) -> list[dict]:
    """Etiquetas del proyecto con cuantos documentos (visibles) tiene cada una."""
    etiquetas = (await db.execute(
        select(EtiquetaModel).where(EtiquetaModel.proyecto_id == proyecto_id).order_by(func.lower(EtiquetaModel.nombre))
    )).scalars().all()
    filas = (await db.execute(
        select(DocumentoEtiquetaModel.etiqueta_id, DocumentoEtiquetaModel.documento_id)
        .join(EtiquetaModel, EtiquetaModel.id == DocumentoEtiquetaModel.etiqueta_id)
        .where(EtiquetaModel.proyecto_id == proyecto_id)
    )).all()
    conteo: dict[int, int] = {}
    for etiqueta_id, documento_id in filas:
        if documento_id not in ocultos:
            conteo[etiqueta_id] = conteo.get(etiqueta_id, 0) + 1
    return [
        {"id": e.id, "proyecto_id": e.proyecto_id, "nombre": e.nombre, "color": e.color, "documentos": conteo.get(e.id, 0)}
        for e in etiquetas
    ]


async def obtener(db: AsyncSession, etiqueta_id: int) -> EtiquetaModel | None:
    return await db.get(EtiquetaModel, etiqueta_id)


async def nombre_ocupado(db: AsyncSession, proyecto_id: int, nombre: str, excepto: int | None = None) -> bool:
    consulta = select(EtiquetaModel.id).where(
        EtiquetaModel.proyecto_id == proyecto_id, func.lower(EtiquetaModel.nombre) == nombre.lower()
    )
    if excepto is not None:
        consulta = consulta.where(EtiquetaModel.id != excepto)
    return (await db.execute(consulta)).first() is not None


async def crear(db: AsyncSession, proyecto_id: int, nombre: str, color: str) -> dict:
    etiqueta = EtiquetaModel(proyecto_id=proyecto_id, nombre=nombre, color=color)
    db.add(etiqueta)
    await db.flush()
    datos = {"id": etiqueta.id, "proyecto_id": proyecto_id, "nombre": nombre, "color": color, "documentos": 0}
    await db.commit()
    return datos


async def actualizar(db: AsyncSession, etiqueta: EtiquetaModel, nombre: str | None, color: str | None) -> None:
    if nombre:
        etiqueta.nombre = nombre
    if color:
        etiqueta.color = color
    await db.commit()


async def eliminar(db: AsyncSession, etiqueta: EtiquetaModel) -> None:
    await db.delete(etiqueta)
    await db.commit()


async def etiquetas_por_documento(db: AsyncSession, documento_ids: list[int]) -> dict[int, list[int]]:
    if not documento_ids:
        return {}
    resultado: dict[int, list[int]] = {}
    for documento_id, etiqueta_id in (await db.execute(
        select(DocumentoEtiquetaModel.documento_id, DocumentoEtiquetaModel.etiqueta_id)
        .where(DocumentoEtiquetaModel.documento_id.in_(documento_ids))
    )).all():
        resultado.setdefault(documento_id, []).append(etiqueta_id)
    return resultado


async def asignar(db: AsyncSession, documento: DocumentoModel, etiqueta_ids: list[int]) -> list[int]:
    """Reemplaza las etiquetas del documento; ignora las que no son de su proyecto."""
    documento_id = documento.id
    validas = list((await db.execute(
        select(EtiquetaModel.id).where(
            EtiquetaModel.id.in_(set(etiqueta_ids)), EtiquetaModel.proyecto_id == documento.proyecto_id
        )
    )).scalars().all()) if etiqueta_ids else []
    await db.execute(delete(DocumentoEtiquetaModel).where(DocumentoEtiquetaModel.documento_id == documento_id))
    for etiqueta_id in validas:
        db.add(DocumentoEtiquetaModel(documento_id=documento_id, etiqueta_id=etiqueta_id))
    await db.commit()
    return sorted(validas)
