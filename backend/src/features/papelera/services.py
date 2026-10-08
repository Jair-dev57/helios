"""Papelera de documentos y carpetas.

Borrar marca el elemento (y, si es una carpeta, todo lo que contiene) con la fecha, quien lo borro y un
lote comun. La papelera muestra solo las raices de cada lote: la carpeta borrada, no cada archivo de dentro.
Restaurar devuelve el lote completo; eliminar definitivamente borra los registros y los archivos del disco.
"""
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.features.carpetas.models import CarpetaModel
from src.features.documentos.extraccion import _ruta_local
from src.features.documentos.models import DocumentoModel
from src.features.documentos.services import eliminar_documento
from src.features.historial.models import HistorialCambioModel
from src.features.historial.services import registrar_cambio

# Pasado este tiempo lo que esta en la papelera se elimina solo
DIAS_EN_PAPELERA = 30


def _ahora() -> datetime:
    return datetime.now(timezone.utc)


async def _subarbol(db: AsyncSession, carpeta_id: int) -> list[int]:
    """Ids de la carpeta y de todas sus subcarpetas, esten o no en la papelera."""
    ids, pendientes = [carpeta_id], [carpeta_id]
    while pendientes:
        hijos = (await db.execute(
            select(CarpetaModel.id).where(CarpetaModel.carpeta_padre_id.in_(pendientes))
        )).scalars().all()
        ids.extend(hijos)
        pendientes = list(hijos)
    return ids


def _marcar(elementos, usuario_id: int | None) -> None:
    lote, ahora = str(uuid.uuid4()), _ahora()
    for elemento in elementos:
        elemento.eliminado_at, elemento.eliminado_por, elemento.papelera_lote = ahora, usuario_id, lote


def _desmarcar(elemento) -> None:
    elemento.eliminado_at = elemento.eliminado_por = elemento.papelera_lote = None


async def mover_documento(db: AsyncSession, documento: DocumentoModel, usuario_id: int | None) -> None:
    datos = (documento.id, documento.nombre, documento.proyecto_id)
    _marcar([documento], usuario_id)
    await db.commit()
    await registrar_cambio(db, "documento", datos[0], datos[1], "papelera", datos[2], usuario_id)


async def mover_carpeta(db: AsyncSession, carpeta: CarpetaModel, usuario_id: int | None) -> int:
    """Manda la carpeta y su contenido a la papelera. Devuelve cuantos archivos se fueron con ella."""
    datos = (carpeta.id, carpeta.nombre, carpeta.proyecto_id)
    ids = await _subarbol(db, carpeta.id)
    carpetas = (await db.execute(
        select(CarpetaModel).where(CarpetaModel.id.in_(ids), CarpetaModel.eliminado_at.is_(None))
    )).scalars().all()
    documentos = (await db.execute(
        select(DocumentoModel).where(DocumentoModel.carpeta_id.in_(ids), DocumentoModel.eliminado_at.is_(None))
    )).scalars().all()
    _marcar([*carpetas, *documentos], usuario_id)
    await db.commit()
    detalle = f"{len(documentos)} archivo(s)" if documentos else None
    await registrar_cambio(db, "carpeta", datos[0], datos[1], "papelera", datos[2], usuario_id, cambios=detalle)
    return len(documentos)


async def _en_papelera(db: AsyncSession, proyecto_id: int | None = None):
    """Carpetas y documentos en la papelera (de un proyecto o de todos)."""
    consulta_c = select(CarpetaModel).where(CarpetaModel.eliminado_at.is_not(None))
    consulta_d = select(DocumentoModel).where(DocumentoModel.eliminado_at.is_not(None))
    if proyecto_id is not None:
        consulta_c = consulta_c.where(CarpetaModel.proyecto_id == proyecto_id)
        consulta_d = consulta_d.where(DocumentoModel.proyecto_id == proyecto_id)
    carpetas = (await db.execute(consulta_c)).scalars().all()
    documentos = (await db.execute(consulta_d)).scalars().all()
    return carpetas, documentos


def _raices(carpetas, documentos):
    """Lo que se ve en la papelera: lo que no esta dentro de una carpeta borrada en el mismo lote."""
    por_id = {c.id: c for c in carpetas}

    def es_raiz(elemento, padre_id):
        padre = por_id.get(padre_id)
        return not (padre and padre.papelera_lote == elemento.papelera_lote)

    return (
        [c for c in carpetas if es_raiz(c, c.carpeta_padre_id)],
        [d for d in documentos if es_raiz(d, d.carpeta_id)],
    )


def _tamano(ruta: str) -> int | None:
    archivo = _ruta_local(ruta)
    return archivo.stat().st_size if archivo.exists() else None


async def listar(db: AsyncSession, proyecto_id: int, ocultos: set[int]) -> list[dict]:
    """Raices de la papelera del proyecto, la mas reciente primero. ocultos: documentos que el usuario no puede ver."""
    from src.features.auth.models import UsuarioModel

    await purgar_vencidos(db, proyecto_id)
    carpetas, documentos = await _en_papelera(db, proyecto_id)
    carpetas_raiz, documentos_raiz = _raices(carpetas, documentos)
    documentos_raiz = [d for d in documentos_raiz if d.id not in ocultos]

    # Nombres de todas las carpetas del proyecto (tambien las borradas) para mostrar la ubicacion original
    todas = dict((await db.execute(
        select(CarpetaModel.id, CarpetaModel.carpeta_padre_id).where(CarpetaModel.proyecto_id == proyecto_id)
    )).all())
    nombres = dict((await db.execute(
        select(CarpetaModel.id, CarpetaModel.nombre).where(CarpetaModel.proyecto_id == proyecto_id)
    )).all())

    def ubicacion(carpeta_id):
        partes = []
        while carpeta_id is not None and carpeta_id in todas:
            partes.insert(0, nombres[carpeta_id])
            carpeta_id = todas[carpeta_id]
        return " / ".join(partes)

    autores = {e.eliminado_por for e in [*carpetas_raiz, *documentos_raiz] if e.eliminado_por}
    usuarios = dict((await db.execute(
        select(UsuarioModel.id, UsuarioModel.nombre).where(UsuarioModel.id.in_(autores))
    )).all()) if autores else {}

    vence = timedelta(days=DIAS_EN_PAPELERA)
    elementos = []
    for c in carpetas_raiz:
        contenido = [d for d in documentos if d.papelera_lote == c.papelera_lote]
        tamanos = [t for t in (_tamano(d.ruta) for d in contenido) if t is not None]
        elementos.append({
            "tipo": "carpeta", "id": c.id, "nombre": c.nombre, "extension": None, "color": c.color,
            "ubicacion": ubicacion(c.carpeta_padre_id), "eliminado_at": c.eliminado_at,
            "expira_at": c.eliminado_at + vence, "eliminado_por": usuarios.get(c.eliminado_por),
            "archivos": len(contenido), "tamano": sum(tamanos), "restringido": False,
        })
    for d in documentos_raiz:
        elementos.append({
            "tipo": "documento", "id": d.id, "nombre": d.nombre, "extension": d.tipo, "color": None,
            "ubicacion": ubicacion(d.carpeta_id), "eliminado_at": d.eliminado_at,
            "expira_at": d.eliminado_at + vence, "eliminado_por": usuarios.get(d.eliminado_por),
            "archivos": 1, "tamano": _tamano(d.ruta), "restringido": d.restringido,
        })
    elementos.sort(key=lambda e: e["eliminado_at"], reverse=True)
    return elementos


async def obtener(db: AsyncSession, tipo: str, elemento_id: int):
    """El elemento si esta en la papelera."""
    modelo = CarpetaModel if tipo == "carpeta" else DocumentoModel
    return (await db.execute(
        select(modelo).where(modelo.id == elemento_id, modelo.eliminado_at.is_not(None))
    )).scalar_one_or_none()


async def _nombre_libre(db: AsyncSession, elemento) -> str:
    """El nombre del elemento, o "nombre (restaurado)" si ya hay otro igual donde vuelve."""
    if isinstance(elemento, CarpetaModel):
        consulta = select(CarpetaModel.nombre).where(
            CarpetaModel.proyecto_id == elemento.proyecto_id,
            CarpetaModel.eliminado_at.is_(None),
            CarpetaModel.id != elemento.id,
            CarpetaModel.carpeta_padre_id.is_(None) if elemento.carpeta_padre_id is None
            else CarpetaModel.carpeta_padre_id == elemento.carpeta_padre_id,
        )
    else:
        consulta = select(DocumentoModel.nombre).where(
            DocumentoModel.carpeta_id == elemento.carpeta_id,
            DocumentoModel.tipo == elemento.tipo,
            DocumentoModel.eliminado_at.is_(None),
            DocumentoModel.id != elemento.id,
        )
    ocupados = set((await db.execute(consulta)).scalars().all())
    nombre = elemento.nombre
    if nombre in ocupados:
        nombre = f"{elemento.nombre} (restaurado)"
        for n in range(2, 1000):
            if nombre not in ocupados:
                break
            nombre = f"{elemento.nombre} (restaurado {n})"
    return nombre


async def restaurar(db: AsyncSession, elemento, usuario_id: int | None) -> int | None:
    """Saca de la papelera el lote del elemento. Si su carpeta tambien esta borrada, la restaura (sin el resto
    de su contenido) para que el elemento tenga donde volver. Devuelve la carpeta donde quedo."""
    es_carpeta = isinstance(elemento, CarpetaModel)
    lote = elemento.papelera_lote
    carpetas = (await db.execute(select(CarpetaModel).where(CarpetaModel.papelera_lote == lote))).scalars().all()
    documentos = (await db.execute(select(DocumentoModel).where(DocumentoModel.papelera_lote == lote))).scalars().all()

    destino_id = elemento.carpeta_padre_id if es_carpeta else elemento.carpeta_id
    padre_id = destino_id
    while padre_id is not None:
        padre = (await db.execute(select(CarpetaModel).where(CarpetaModel.id == padre_id))).scalar_one_or_none()
        if not padre or padre.eliminado_at is None:
            break
        padre.nombre = await _nombre_libre(db, padre)
        _desmarcar(padre)
        padre_id = padre.carpeta_padre_id

    elemento.nombre = await _nombre_libre(db, elemento)
    for e in [*carpetas, *documentos]:
        _desmarcar(e)
    # El commit expira los objetos: leer antes lo que se usa despues
    datos = ("carpeta" if es_carpeta else "documento", elemento.id, elemento.nombre, elemento.proyecto_id)
    carpeta_final = elemento.id if es_carpeta else destino_id
    await db.commit()
    detalle = f"{len(documentos)} archivo(s)" if es_carpeta and documentos else None
    await registrar_cambio(db, datos[0], datos[1], datos[2], "restaurado", datos[3], usuario_id, cambios=detalle)
    return carpeta_final


async def _purgar_documento(db: AsyncSession, documento_id: int) -> None:
    """Borra el documento y los archivos de todas sus versiones del disco."""
    rutas = set((await db.execute(
        select(HistorialCambioModel.ruta).where(
            HistorialCambioModel.entidad_tipo == "documento",
            HistorialCambioModel.entidad_id == documento_id,
            HistorialCambioModel.ruta.is_not(None),
        )
    )).scalars().all())
    actual = (await db.execute(select(DocumentoModel.ruta).where(DocumentoModel.id == documento_id))).scalar_one_or_none()
    if actual:
        rutas.add(actual)
    await eliminar_documento(db, documento_id)
    for ruta in rutas:
        _ruta_local(ruta).unlink(missing_ok=True)


async def eliminar_definitivamente(db: AsyncSession, elemento, usuario_id: int | None) -> None:
    """Borra para siempre el elemento; una carpeta, con todo lo que tiene dentro."""
    if isinstance(elemento, DocumentoModel):
        await _purgar_documento(db, elemento.id)
        return
    datos = (elemento.id, elemento.nombre, elemento.proyecto_id)
    ids = await _subarbol(db, elemento.id)
    documento_ids = (await db.execute(
        select(DocumentoModel.id).where(DocumentoModel.carpeta_id.in_(ids))
    )).scalars().all()
    for documento_id in documento_ids:
        await _purgar_documento(db, documento_id)
    # Una sola sentencia: la referencia a la carpeta padre se comprueba al final
    await db.execute(delete(CarpetaModel).where(CarpetaModel.id.in_(ids)))
    await db.commit()
    await registrar_cambio(db, "carpeta", datos[0], datos[1], "eliminado", datos[2], usuario_id)


async def _eliminar_raices(db: AsyncSession, proyecto_id: int | None, usuario_id: int | None, antes_de=None) -> int:
    """Elimina definitivamente las raices de la papelera (solo las borradas antes_de, si se indica)."""
    carpetas, documentos = _raices(*await _en_papelera(db, proyecto_id))
    # Cada eliminacion hace commit y expira los objetos: se guardan los ids y se vuelven a buscar
    pendientes = [
        ("carpeta" if isinstance(e, CarpetaModel) else "documento", e.id)
        for e in [*carpetas, *documentos]
        if antes_de is None or e.eliminado_at < antes_de
    ]
    for tipo, elemento_id in pendientes:
        # Un documento pudo irse ya con la carpeta que lo contenia
        elemento = await obtener(db, tipo, elemento_id)
        if elemento:
            await eliminar_definitivamente(db, elemento, usuario_id)
    return len(pendientes)


async def vaciar(db: AsyncSession, proyecto_id: int, usuario_id: int | None) -> int:
    """Elimina definitivamente todo lo que esta en la papelera del proyecto. Devuelve cuantos elementos eran."""
    return await _eliminar_raices(db, proyecto_id, usuario_id)


async def purgar_vencidos(db: AsyncSession, proyecto_id: int | None = None) -> None:
    """Elimina lo que lleva mas de DIAS_EN_PAPELERA en la papelera."""
    await _eliminar_raices(db, proyecto_id, None, antes_de=_ahora() - timedelta(days=DIAS_EN_PAPELERA))
