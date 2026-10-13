from datetime import datetime, timezone

from sqlalchemy import delete, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from src.features.carpetas.models import CarpetaModel
from src.features.documentos.models import DocumentoModel
from src.features.favoritos.models import DocumentoVistoModel, FavoritoModel


async def favoritos(db: AsyncSession, usuario_id: int, proyecto_id: int) -> tuple[list[int], list[int]]:
    """(documentos, carpetas) con estrella del usuario en el proyecto, en el orden en que se marcaron."""
    documentos = (await db.execute(
        select(FavoritoModel.documento_id)
        .join(DocumentoModel, DocumentoModel.id == FavoritoModel.documento_id)
        .where(FavoritoModel.usuario_id == usuario_id, DocumentoModel.proyecto_id == proyecto_id)
        .order_by(FavoritoModel.created_at)
    )).scalars().all()
    carpetas = (await db.execute(
        select(FavoritoModel.carpeta_id)
        .join(CarpetaModel, CarpetaModel.id == FavoritoModel.carpeta_id)
        .where(FavoritoModel.usuario_id == usuario_id, CarpetaModel.proyecto_id == proyecto_id)
        .order_by(FavoritoModel.created_at)
    )).scalars().all()
    return list(documentos), list(carpetas)


async def marcar(db: AsyncSession, usuario_id: int, documento_id: int | None, carpeta_id: int | None, favorito: bool) -> None:
    columna, valor = (FavoritoModel.documento_id, documento_id) if documento_id is not None else (FavoritoModel.carpeta_id, carpeta_id)
    if favorito:
        await db.execute(
            insert(FavoritoModel)
            .values(usuario_id=usuario_id, documento_id=documento_id, carpeta_id=carpeta_id)
            .on_conflict_do_nothing()
        )
    else:
        await db.execute(delete(FavoritoModel).where(FavoritoModel.usuario_id == usuario_id, columna == valor))
    await db.commit()


async def registrar_visto(db: AsyncSession, usuario_id: int, documento_id: int) -> None:
    ahora = datetime.now(timezone.utc)
    await db.execute(
        insert(DocumentoVistoModel)
        .values(usuario_id=usuario_id, documento_id=documento_id, visto_at=ahora)
        .on_conflict_do_update(index_elements=["usuario_id", "documento_id"], set_={"visto_at": ahora})
    )
    await db.commit()


async def recientes(db: AsyncSession, usuario_id: int, proyecto_id: int, ocultos: set[int], limite: int) -> list[int]:
    """Documentos del proyecto que el usuario abrio, el mas reciente primero."""
    consulta = (
        select(DocumentoVistoModel.documento_id)
        .join(DocumentoModel, DocumentoModel.id == DocumentoVistoModel.documento_id)
        .where(DocumentoVistoModel.usuario_id == usuario_id, DocumentoModel.proyecto_id == proyecto_id)
        .order_by(DocumentoVistoModel.visto_at.desc())
        .limit(limite + len(ocultos))
    )
    return [d for d in (await db.execute(consulta)).scalars().all() if d not in ocultos][:limite]


async def _lugares(db: AsyncSession, proyecto_ids: set[int], sin_acceso: set[int]) -> dict[int, dict]:
    """Proyecto o espacio de cada id visible para el usuario: {id: {proyecto_id, proyecto_nombre, proyecto_tipo}}."""
    from src.features.proyectos.models import ProyectoModel

    ids = proyecto_ids - sin_acceso
    if not ids:
        return {}
    proyectos = (await db.execute(select(ProyectoModel).where(ProyectoModel.id.in_(ids)))).scalars().all()
    return {p.id: {"proyecto_id": p.id, "proyecto_nombre": p.nombre, "proyecto_tipo": p.tipo} for p in proyectos}


def _objeto_documento(d: DocumentoModel, lugar: dict) -> dict:
    return {
        "tipo": "documento", "id": d.id, "nombre": d.nombre, "extension": d.tipo, "color": None,
        "carpeta_id": d.carpeta_id, "updated_at": d.updated_at, **lugar,
    }


async def favoritos_global(db: AsyncSession, usuario_id: int, ocultos: set[int], sin_acceso: set[int]) -> list[dict]:
    """Carpetas y documentos con estrella del usuario en todos sus proyectos y espacios, el ultimo marcado primero."""
    filas = (await db.execute(
        select(FavoritoModel.created_at, DocumentoModel, CarpetaModel)
        .outerjoin(DocumentoModel, DocumentoModel.id == FavoritoModel.documento_id)
        .outerjoin(CarpetaModel, CarpetaModel.id == FavoritoModel.carpeta_id)
        .where(FavoritoModel.usuario_id == usuario_id)
        .order_by(FavoritoModel.created_at.desc())
    )).all()
    lugares = await _lugares(db, {(d or c).proyecto_id for _, d, c in filas if d or c}, sin_acceso)
    objetos = []
    for _, documento, carpeta in filas:
        if documento is not None:
            if documento.id not in ocultos and documento.proyecto_id in lugares:
                objetos.append(_objeto_documento(documento, lugares[documento.proyecto_id]))
        elif carpeta is not None and carpeta.eliminado_at is None and carpeta.proyecto_id in lugares:
            objetos.append({
                "tipo": "carpeta", "id": carpeta.id, "nombre": carpeta.nombre, "extension": None, "color": carpeta.color,
                "carpeta_id": carpeta.id, "updated_at": carpeta.created_at, **lugares[carpeta.proyecto_id],
            })
    return objetos


async def recientes_global(db: AsyncSession, usuario_id: int, ocultos: set[int], sin_acceso: set[int], limite: int) -> list[dict]:
    """Documentos que el usuario abrio en cualquiera de sus proyectos y espacios, el mas reciente primero."""
    filas = (await db.execute(
        select(DocumentoVistoModel.visto_at, DocumentoModel)
        .join(DocumentoModel, DocumentoModel.id == DocumentoVistoModel.documento_id)
        .where(DocumentoVistoModel.usuario_id == usuario_id)
        .order_by(DocumentoVistoModel.visto_at.desc())
        .limit(limite + len(ocultos))
    )).all()
    lugares = await _lugares(db, {d.proyecto_id for _, d in filas}, sin_acceso)
    return [
        {**_objeto_documento(d, lugares[d.proyecto_id]), "visto_at": visto_at}
        for visto_at, d in filas if d.id not in ocultos and d.proyecto_id in lugares
    ][:limite]
