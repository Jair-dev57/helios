import msgspec
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from src.features.documentos.models import DocumentoModel
from src.features.documentos.schemas import DocumentoCrear, DocumentoActualizar
from src.features.documentos.extraccion import extraer_contenido, _ruta_local, LIMITE_PALABRAS
from src.features.busqueda.services import indexar_entidad, eliminar_indice, indexar_fragmentos
from src.features.historial.services import registrar_cambio


# Tope de texto que se parte en fragmentos para buscar dentro del documento (el indice global usa menos)
LIMITE_PALABRAS_FRAGMENTOS = 60000


async def indexar_documento(db: AsyncSession, documento: DocumentoModel, con_fragmentos: bool = True) -> None:
    """Indexa el documento para el buscador global y, si cambio el archivo, sus fragmentos para buscar dentro."""
    contenido = extraer_contenido(documento.ruta, documento.tipo, LIMITE_PALABRAS_FRAGMENTOS)
    documento_id, proyecto_id, nombre = documento.id, documento.proyecto_id, documento.nombre
    partes = [nombre]
    if documento.tipo:
        partes.append(documento.tipo)
    if contenido:
        partes.append(" ".join(contenido.split()[:LIMITE_PALABRAS]))
    await indexar_entidad(db, "documento", documento_id, "\n".join(partes))
    if con_fragmentos:
        await indexar_fragmentos(db, documento_id, proyecto_id, nombre, contenido)


async def ids_documentos_en_carpeta(db: AsyncSession, proyecto_id: int, carpeta_id: int) -> list[int]:
    """Ids de los documentos de una carpeta y de todas sus subcarpetas."""
    from src.features.carpetas.models import CarpetaModel

    filas = (await db.execute(
        select(CarpetaModel.id, CarpetaModel.carpeta_padre_id).where(CarpetaModel.proyecto_id == proyecto_id)
    )).all()
    hijos: dict[int | None, list[int]] = {}
    for id_, padre in filas:
        hijos.setdefault(padre, []).append(id_)
    carpetas, pendientes = set(), [carpeta_id]
    while pendientes:
        actual = pendientes.pop()
        if actual in carpetas:
            continue
        carpetas.add(actual)
        pendientes.extend(hijos.get(actual, []))
    return list((await db.execute(
        select(DocumentoModel.id).where(
            DocumentoModel.proyecto_id == proyecto_id,
            DocumentoModel.carpeta_id.in_(carpetas),
        )
    )).scalars().all())


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


async def datos_listado(db: AsyncSession, documentos: list[DocumentoModel]) -> dict[int, tuple[str | None, int | None]]:
    """Por documento: (nombre de quien subio la version actual, tamano en bytes del archivo actual)."""
    from src.features.auth.models import UsuarioModel
    from src.features.historial.models import HistorialCambioModel

    if not documentos:
        return {}
    ids = [d.id for d in documentos]
    # Cada subida (creacion o nueva version) queda en el historial con su ruta; la mas reciente es la actual
    filas = (await db.execute(
        select(HistorialCambioModel.entidad_id, UsuarioModel.nombre)
        .outerjoin(UsuarioModel, HistorialCambioModel.usuario_id == UsuarioModel.id)
        .where(
            HistorialCambioModel.entidad_tipo == "documento",
            HistorialCambioModel.entidad_id.in_(ids),
            HistorialCambioModel.ruta.is_not(None),
        )
        .order_by(HistorialCambioModel.created_at.desc())
    )).all()
    ultimo_autor: dict[int, str | None] = {}
    for doc_id, nombre in filas:
        ultimo_autor.setdefault(doc_id, nombre)

    # Documentos sin historial (anteriores al refactor): usar el creador
    sin_autor = {d.usuario_id for d in documentos if d.id not in ultimo_autor and d.usuario_id}
    creadores = {}
    if sin_autor:
        creadores = dict((await db.execute(
            select(UsuarioModel.id, UsuarioModel.nombre).where(UsuarioModel.id.in_(sin_autor))
        )).all())

    datos = {}
    for d in documentos:
        autor = ultimo_autor.get(d.id, creadores.get(d.usuario_id))
        ruta = _ruta_local(d.ruta)
        tamano = ruta.stat().st_size if ruta.exists() else None
        datos[d.id] = (autor, tamano)
    return datos


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
    await indexar_documento(db, documento)
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
    # Renombrar o mover no cambia el contenido: solo se rehacen los fragmentos si hay archivo nuevo
    await indexar_documento(db, documento, con_fragmentos=bool(data.ruta))
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
