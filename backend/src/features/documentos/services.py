import hashlib
from pathlib import Path

import msgspec
from litestar import Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import delete, select
from src.core.permisos import es_admin
from src.features.documentos.models import DocumentoAccesoModel, DocumentoModel
from src.features.documentos.schemas import DocumentoCrear, DocumentoActualizar
from src.features.documentos.extraccion import extraer_contenido, _ruta_local, LIMITE_PALABRAS
from src.features.busqueda.services import indexar_entidad, eliminar_indice, indexar_fragmentos
from src.features.historial.services import registrar_cambio


# Tope de texto que se parte en fragmentos para buscar dentro del documento (el indice global usa menos)
LIMITE_PALABRAS_FRAGMENTOS = 60000


async def documentos_ocultos(db: AsyncSession, request: Request, incluir_papelera: bool = True) -> set[int]:
    """Ids de los documentos que el usuario autenticado no debe ver: los de la papelera (no se listan,
    no se buscan ni se abren) y los restringidos que no se le compartieron.

    Los administradores ven todos los restringidos; el resto, los no restringidos y los que se les compartieron.
    """
    ocultos = set()
    if incluir_papelera:
        ocultos = set((await db.execute(
            select(DocumentoModel.id).where(DocumentoModel.eliminado_at.is_not(None))
        )).scalars().all())
    if await es_admin(db, request):
        return ocultos
    usuario_id = int(request.user["id"]) if request.user else None
    compartidos = select(DocumentoAccesoModel.documento_id).where(DocumentoAccesoModel.usuario_id == usuario_id)
    return ocultos | set((await db.execute(
        select(DocumentoModel.id).where(DocumentoModel.restringido.is_(True), DocumentoModel.id.not_in(compartidos))
    )).scalars().all())


async def obtener_accesos(db: AsyncSession, documento_id: int) -> list[int]:
    """Ids de los usuarios con los que se compartio un documento restringido."""
    return list((await db.execute(
        select(DocumentoAccesoModel.usuario_id).where(DocumentoAccesoModel.documento_id == documento_id)
    )).scalars().all())


async def cambiar_acceso(
    db: AsyncSession,
    documento: DocumentoModel,
    restringido: bool,
    usuario_ids: list[int],
    usuario_id: int | None,
) -> list[int]:
    """Restringe (o libera) un documento y reemplaza la lista de usuarios con acceso."""
    from src.features.auth.models import UsuarioModel

    # Al liberarlo la lista no aplica: se vacia para que no reaparezca al volver a restringir
    usuario_ids = sorted(set(usuario_ids)) if restringido else []
    if usuario_ids:
        usuario_ids = list((await db.execute(
            select(UsuarioModel.id).where(UsuarioModel.id.in_(usuario_ids))
        )).scalars().all())
    # El commit expira el objeto: leer antes lo que se usa despues
    documento_id, nombre, proyecto_id = documento.id, documento.nombre, documento.proyecto_id
    anterior = (documento.restringido, sorted(await obtener_accesos(db, documento_id)))

    await db.execute(delete(DocumentoAccesoModel).where(DocumentoAccesoModel.documento_id == documento_id))
    for uid in usuario_ids:
        db.add(DocumentoAccesoModel(documento_id=documento_id, usuario_id=uid))
    documento.restringido = restringido
    await db.commit()

    if anterior != (restringido, sorted(usuario_ids)):
        nombres = []
        if usuario_ids:
            nombres = list((await db.execute(
                select(UsuarioModel.nombre).where(UsuarioModel.id.in_(usuario_ids)).order_by(UsuarioModel.nombre)
            )).scalars().all())
        if restringido:
            detalle = f"Acceso: administradores{', ' + ', '.join(nombres) if nombres else ''}"
        else:
            detalle = "Visible para todo el equipo"
        await registrar_cambio(
            db, "documento", documento_id, nombre,
            "restringido" if restringido else "acceso_abierto",
            proyecto_id, usuario_id, cambios=detalle,
        )
    await db.refresh(documento)
    return usuario_ids


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
    ocultos: set[int] | None = None,
) -> list[DocumentoModel]:
    query = select(DocumentoModel).where(DocumentoModel.eliminado_at.is_(None))
    if ocultos:
        query = query.where(DocumentoModel.id.not_in(ocultos))
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


async def obtener_versiones(db: AsyncSession, documento: DocumentoModel) -> list[dict]:
    """Versiones del documento, la mas reciente primero. Cada subida queda en el historial con su archivo."""
    from src.features.auth.models import UsuarioModel
    from src.features.historial.models import HistorialCambioModel

    filas = (await db.execute(
        select(
            HistorialCambioModel.numero_version,
            HistorialCambioModel.ruta,
            HistorialCambioModel.cambios,
            HistorialCambioModel.created_at,
            UsuarioModel.nombre,
        )
        .outerjoin(UsuarioModel, HistorialCambioModel.usuario_id == UsuarioModel.id)
        .where(
            HistorialCambioModel.entidad_tipo == "documento",
            HistorialCambioModel.entidad_id == documento.id,
            HistorialCambioModel.ruta.is_not(None),
            HistorialCambioModel.numero_version.is_not(None),
        )
        .order_by(HistorialCambioModel.numero_version.desc(), HistorialCambioModel.created_at.desc())
    )).all()
    # Documentos anteriores al historial de versiones: solo se conoce la actual
    if not filas:
        filas = [(documento.version_actual, documento.ruta, None, documento.updated_at, None)]

    versiones, vistas = [], set()
    for numero, ruta, notas, fecha, autor in filas:
        if numero in vistas:
            continue
        vistas.add(numero)
        archivo = _ruta_local(ruta)
        versiones.append({
            "numero": numero,
            "fecha": fecha,
            "autor": autor,
            "notas": notas,
            "extension": Path(ruta).suffix.lstrip(".").lower() or None,
            "tamano": archivo.stat().st_size if archivo.exists() else None,
            "actual": numero == documento.version_actual,
            "disponible": archivo.exists(),
        })
    return versiones


async def ruta_de_version(db: AsyncSession, documento: DocumentoModel, numero: int) -> str | None:
    """Ruta del archivo de una version del documento (None si no existe esa version)."""
    from src.features.historial.models import HistorialCambioModel

    if numero == documento.version_actual:
        return documento.ruta
    return (await db.execute(
        select(HistorialCambioModel.ruta)
        .where(
            HistorialCambioModel.entidad_tipo == "documento",
            HistorialCambioModel.entidad_id == documento.id,
            HistorialCambioModel.numero_version == numero,
            HistorialCambioModel.ruta.is_not(None),
        )
        .order_by(HistorialCambioModel.created_at.desc())
        .limit(1)
    )).scalar_one_or_none()


async def restaurar_version(
    db: AsyncSession, documento: DocumentoModel, numero: int, usuario_id: int | None
) -> DocumentoModel | None:
    """Vuelve a una version anterior creando una version nueva con su archivo (el historial no se reescribe).

    Devuelve None si esa version no existe o su archivo ya no esta en el servidor.
    """
    ruta = await ruta_de_version(db, documento, numero)
    if not ruta or not _ruta_local(ruta).is_file():
        return None
    hash_archivo = hashlib.sha256(_ruta_local(ruta).read_bytes()).hexdigest()
    # Ya es la actual (o tiene el mismo contenido): nada que hacer
    if numero == documento.version_actual or hash_archivo == documento.hash:
        return documento
    data = DocumentoActualizar(ruta=ruta, tipo=Path(ruta).suffix.lstrip(".").lower() or None, hash=hash_archivo)
    return await actualizar_documento(
        db, documento.id, data, notas=f"Restaurada la versión {numero}", usuario_id=usuario_id
    )


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
