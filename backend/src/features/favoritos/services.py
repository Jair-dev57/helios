from datetime import datetime, timezone

from sqlalchemy import delete, func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from src.features.carpetas.models import CarpetaModel
from src.features.documentos.models import DocumentoModel
from src.features.favoritos.models import DocumentoVistoModel, FavoritoModel, ProyectoVistoModel


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


async def marcar(
    db: AsyncSession, usuario_id: int, documento_id: int | None, carpeta_id: int | None, favorito: bool,
    proyecto_id: int | None = None,
) -> None:
    columna, valor = (
        (FavoritoModel.documento_id, documento_id) if documento_id is not None
        else (FavoritoModel.carpeta_id, carpeta_id) if carpeta_id is not None
        else (FavoritoModel.proyecto_id, proyecto_id)
    )
    if favorito:
        # Al final de los Favoritos de la barra lateral (los de Proyectos y los de Archivos van aparte)
        del_grupo = FavoritoModel.proyecto_id.is_not(None) if proyecto_id is not None else FavoritoModel.proyecto_id.is_(None)
        ultimo = (await db.execute(
            select(func.max(FavoritoModel.orden)).where(FavoritoModel.usuario_id == usuario_id, del_grupo)
        )).scalar_one_or_none()
        orden = (ultimo or 0) + 1
        await db.execute(
            insert(FavoritoModel)
            .values(usuario_id=usuario_id, documento_id=documento_id, carpeta_id=carpeta_id, proyecto_id=proyecto_id, orden=orden)
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
    """Carpetas y documentos con estrella del usuario en todos sus proyectos y espacios, en el orden de la barra lateral."""
    filas = (await db.execute(
        select(FavoritoModel.created_at, DocumentoModel, CarpetaModel)
        .outerjoin(DocumentoModel, DocumentoModel.id == FavoritoModel.documento_id)
        .outerjoin(CarpetaModel, CarpetaModel.id == FavoritoModel.carpeta_id)
        .where(FavoritoModel.usuario_id == usuario_id, FavoritoModel.proyecto_id.is_(None))
        # Los marcados antes de que hubiera orden (sin orden) van primero, en el orden en que se marcaron
        .order_by(FavoritoModel.orden.asc().nulls_first(), FavoritoModel.created_at)
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


async def proyectos_favoritos(db: AsyncSession, usuario_id: int) -> list[int]:
    """Proyectos con estrella del usuario en el orden de la barra lateral (sin espacios de archivos)."""
    from src.features.proyectos.models import ProyectoModel

    return list((await db.execute(
        select(FavoritoModel.proyecto_id)
        .join(ProyectoModel, ProyectoModel.id == FavoritoModel.proyecto_id)
        .where(FavoritoModel.usuario_id == usuario_id, ProyectoModel.tipo == "proyecto")
        .order_by(FavoritoModel.orden.asc().nulls_last(), FavoritoModel.created_at)
    )).scalars().all())


async def ordenar_proyectos_favoritos(db: AsyncSession, usuario_id: int, proyecto_ids: list[int]) -> None:
    """Deja los favoritos de proyectos en el orden indicado; los que no vienen quedan al final."""
    favoritos = (await db.execute(
        select(FavoritoModel).where(FavoritoModel.usuario_id == usuario_id, FavoritoModel.proyecto_id.is_not(None))
    )).scalars().all()
    posicion = {pid: i for i, pid in enumerate(proyecto_ids)}
    for fav in favoritos:
        fav.orden = posicion.get(fav.proyecto_id, len(proyecto_ids) + (fav.orden or 0)) + 1
    await db.commit()


async def ordenar_archivos_favoritos(db: AsyncSession, usuario_id: int, claves: list[str]) -> None:
    """Orden de los Favoritos de Archivos: claves «d:ID» (documento) o «c:ID» (carpeta); los que no vienen quedan al final."""
    favoritos = (await db.execute(
        select(FavoritoModel).where(FavoritoModel.usuario_id == usuario_id, FavoritoModel.proyecto_id.is_(None))
    )).scalars().all()
    posicion = {clave: i for i, clave in enumerate(claves)}
    for fav in favoritos:
        clave = f"d:{fav.documento_id}" if fav.documento_id is not None else f"c:{fav.carpeta_id}"
        fav.orden = posicion.get(clave, len(claves) + (fav.orden or 0)) + 1
    await db.commit()


async def registrar_proyecto_visto(db: AsyncSession, usuario_id: int, proyecto_id: int) -> None:
    ahora = datetime.now(timezone.utc)
    await db.execute(
        insert(ProyectoVistoModel)
        .values(usuario_id=usuario_id, proyecto_id=proyecto_id, visto_at=ahora)
        .on_conflict_do_update(index_elements=["usuario_id", "proyecto_id"], set_={"visto_at": ahora})
    )
    await db.commit()


async def proyectos_recientes(db: AsyncSession, usuario_id: int, limite: int) -> list[dict]:
    """Proyectos que el usuario abrio, el mas reciente primero: [{proyecto_id, visto_at}]."""
    from src.features.proyectos.models import ProyectoModel

    filas = (await db.execute(
        select(ProyectoVistoModel.proyecto_id, ProyectoVistoModel.visto_at)
        .join(ProyectoModel, ProyectoModel.id == ProyectoVistoModel.proyecto_id)
        .where(ProyectoVistoModel.usuario_id == usuario_id, ProyectoModel.tipo == "proyecto")
        .order_by(ProyectoVistoModel.visto_at.desc())
        .limit(limite)
    )).all()
    return [{"proyecto_id": p, "visto_at": v} for p, v in filas]
