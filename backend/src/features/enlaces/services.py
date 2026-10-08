"""Enlaces publicos a documentos y carpetas.

Un enlace deja de funcionar si vence, si lo que comparte esta en la papelera o si el documento se restringe.
Los documentos restringidos nunca se muestran por enlace, tampoco dentro de una carpeta compartida.
"""
import secrets
from datetime import datetime, timezone

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.security import hash_password, verify_password
from src.features.carpetas.models import CarpetaModel
from src.features.documentos.extraccion import _ruta_local
from src.features.documentos.models import DocumentoModel
from src.features.enlaces.models import EnlaceCompartidoModel
from src.features.historial.services import registrar_cambio


def _ahora() -> datetime:
    return datetime.now(timezone.utc)


async def crear(
    db: AsyncSession,
    *,
    proyecto_id: int,
    documento_id: int | None,
    carpeta_id: int | None,
    permiso: str,
    contrasena: str | None,
    expira_at: datetime | None,
    usuario_id: int | None,
) -> EnlaceCompartidoModel:
    enlace = EnlaceCompartidoModel(
        token=secrets.token_urlsafe(24),
        permiso=permiso,
        documento_id=documento_id,
        carpeta_id=carpeta_id,
        proyecto_id=proyecto_id,
        contrasena_hash=hash_password(contrasena) if contrasena else None,
        expira_at=expira_at,
        creado_por=usuario_id,
    )
    db.add(enlace)
    await db.commit()
    await db.refresh(enlace)
    return enlace


async def listar(db: AsyncSession, documento_id: int | None, carpeta_id: int | None) -> list[dict]:
    """Enlaces de un documento o una carpeta, el mas reciente primero, con el nombre de quien lo creo."""
    from src.features.auth.models import UsuarioModel

    consulta = (
        select(EnlaceCompartidoModel, UsuarioModel.nombre)
        .outerjoin(UsuarioModel, EnlaceCompartidoModel.creado_por == UsuarioModel.id)
        .order_by(EnlaceCompartidoModel.created_at.desc())
    )
    if documento_id is not None:
        consulta = consulta.where(EnlaceCompartidoModel.documento_id == documento_id)
    else:
        consulta = consulta.where(EnlaceCompartidoModel.carpeta_id == carpeta_id)
    return [
        {
            "id": e.id, "token": e.token, "permiso": e.permiso, "documento_id": e.documento_id,
            "carpeta_id": e.carpeta_id, "tiene_contrasena": bool(e.contrasena_hash), "expira_at": e.expira_at,
            "created_at": e.created_at, "creado_por": nombre, "accesos": e.accesos,
            "ultimo_acceso_at": e.ultimo_acceso_at,
        }
        for e, nombre in (await db.execute(consulta)).all()
    ]


async def obtener(db: AsyncSession, enlace_id: int) -> EnlaceCompartidoModel | None:
    return await db.get(EnlaceCompartidoModel, enlace_id)


async def eliminar(db: AsyncSession, enlace: EnlaceCompartidoModel) -> None:
    await db.delete(enlace)
    await db.commit()


async def resolver(db: AsyncSession, token: str):
    """(enlace, documento o carpeta) si el enlace sigue disponible; si no, None."""
    enlace = (await db.execute(
        select(EnlaceCompartidoModel).where(EnlaceCompartidoModel.token == token)
    )).scalar_one_or_none()
    if not enlace or (enlace.expira_at and enlace.expira_at < _ahora()):
        return None
    if enlace.documento_id is not None:
        objeto = await db.get(DocumentoModel, enlace.documento_id)
        if not objeto or objeto.eliminado_at or objeto.restringido:
            return None
    else:
        objeto = await db.get(CarpetaModel, enlace.carpeta_id)
        if not objeto or objeto.eliminado_at:
            return None
    return enlace, objeto


def contrasena_valida(enlace: EnlaceCompartidoModel, contrasena: str | None) -> bool:
    if not enlace.contrasena_hash:
        return True
    return bool(contrasena) and verify_password(contrasena, enlace.contrasena_hash)


async def registrar_acceso(db: AsyncSession, enlace: EnlaceCompartidoModel) -> None:
    enlace.accesos += 1
    enlace.ultimo_acceso_at = _ahora()
    await db.commit()


async def no_publicos(db: AsyncSession) -> set[int]:
    """Documentos que nunca se muestran por enlace: restringidos y en la papelera."""
    return set((await db.execute(
        select(DocumentoModel.id).where(
            or_(DocumentoModel.restringido.is_(True), DocumentoModel.eliminado_at.is_not(None))
        )
    )).scalars().all())


async def _subcarpetas(db: AsyncSession, carpeta: CarpetaModel) -> list[CarpetaModel]:
    """Subcarpetas (a cualquier profundidad) que no estan en la papelera."""
    todas = (await db.execute(
        select(CarpetaModel).where(CarpetaModel.proyecto_id == carpeta.proyecto_id, CarpetaModel.eliminado_at.is_(None))
    )).scalars().all()
    hijos: dict[int, list[CarpetaModel]] = {}
    for c in todas:
        hijos.setdefault(c.carpeta_padre_id, []).append(c)
    resultado, pendientes = [], [carpeta.id]
    while pendientes:
        for hija in hijos.get(pendientes.pop(), []):
            resultado.append(hija)
            pendientes.append(hija.id)
    return resultado


def _tamano(ruta: str) -> int | None:
    archivo = _ruta_local(ruta)
    return archivo.stat().st_size if archivo.exists() else None


def datos_documento(d: DocumentoModel) -> dict:
    return {
        "id": d.id, "nombre": d.nombre, "tipo": d.tipo, "tamano": _tamano(d.ruta),
        "carpeta_id": d.carpeta_id, "updated_at": d.updated_at,
    }


async def contenido_carpeta(db: AsyncSession, carpeta: CarpetaModel) -> tuple[list[dict], list[dict]]:
    """Subcarpetas y documentos visibles por enlace dentro de la carpeta compartida."""
    subcarpetas = await _subcarpetas(db, carpeta)
    ids = [carpeta.id, *(c.id for c in subcarpetas)]
    ocultos = await no_publicos(db)
    documentos = (await db.execute(
        select(DocumentoModel).where(DocumentoModel.carpeta_id.in_(ids)).order_by(DocumentoModel.nombre)
    )).scalars().all()
    return (
        [{"id": c.id, "nombre": c.nombre, "carpeta_padre_id": c.carpeta_padre_id} for c in subcarpetas],
        [datos_documento(d) for d in documentos if d.id not in ocultos],
    )


async def documento_en_carpeta(db: AsyncSession, carpeta: CarpetaModel, documento_id: int) -> DocumentoModel | None:
    """El documento si esta dentro de la carpeta compartida y se puede mostrar por enlace."""
    documento = await db.get(DocumentoModel, documento_id)
    if not documento or documento.eliminado_at or documento.restringido:
        return None
    ids = {carpeta.id, *(c.id for c in await _subcarpetas(db, carpeta))}
    return documento if documento.carpeta_id in ids else None


async def nombre_libre(db: AsyncSession, carpeta_id: int, nombre: str, tipo: str) -> str:
    """Quien envia por enlace no ve la carpeta: nunca se pisa un archivo, se agrega "(2)", "(3)"..."""
    ocupados = set((await db.execute(
        select(DocumentoModel.nombre).where(
            DocumentoModel.carpeta_id == carpeta_id,
            DocumentoModel.tipo == tipo,
            DocumentoModel.eliminado_at.is_(None),
        )
    )).scalars().all())
    libre, n = nombre, 2
    while libre in ocupados:
        libre, n = f"{nombre} ({n})", n + 1
    return libre


async def registrar_recibido(db: AsyncSession, documento: DocumentoModel, remitente: str | None) -> None:
    detalle = f"Enviado por {remitente}" if remitente else "Enviado por enlace"
    await registrar_cambio(
        db, "documento", documento.id, documento.nombre, "recibido", documento.proyecto_id, None, cambios=detalle
    )
