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
