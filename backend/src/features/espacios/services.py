"""Espacios de archivos: el personal de cada usuario y los de equipo (por area).

Por dentro son proyectos con tipo 'personal' o 'equipo', asi reutilizan todo lo de documentos.
El acceso se decide en proyectos_sin_acceso, que documentos_ocultos y los controladores consultan.
"""
from litestar import Request
from litestar.exceptions import NotFoundException
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.permisos import es_admin, id_usuario
from src.features.documentos.models import DocumentoModel
from src.features.espacios.models import EspacioMiembroModel
from src.features.proyectos.models import ProyectoModel

TIPOS_ESPACIO = ("personal", "equipo")


async def proyectos_sin_acceso(db: AsyncSession, request: Request) -> set[int]:
    """Ids de espacios que el usuario no puede ver: personales ajenos (tampoco los ve un administrador)
    y de equipo cerrados de los que no es miembro (los administradores si los ven)."""
    usuario_id = id_usuario(request)
    admin = await es_admin(db, request)
    miembro_de = select(EspacioMiembroModel.proyecto_id).where(EspacioMiembroModel.usuario_id == usuario_id)
    filas = (await db.execute(
        select(ProyectoModel.id, ProyectoModel.tipo, ProyectoModel.propietario_id, ProyectoModel.abierto,
               ProyectoModel.id.in_(miembro_de))
        .where(ProyectoModel.tipo.in_(TIPOS_ESPACIO))
    )).all()
    sin_acceso = set()
    for proyecto_id, tipo, propietario_id, abierto, es_miembro in filas:
        if tipo == "personal" and propietario_id != usuario_id:
            sin_acceso.add(proyecto_id)
        elif tipo == "equipo" and not (admin or abierto or es_miembro):
            sin_acceso.add(proyecto_id)
    return sin_acceso


async def requerir_acceso(db: AsyncSession, request: Request, proyecto_id: int | None) -> None:
    """404 si proyecto_id es un espacio que el usuario no puede ver (como si no existiera)."""
    if proyecto_id is not None and proyecto_id in await proyectos_sin_acceso(db, request):
        raise NotFoundException(detail="No encontrado")


async def espacio_personal(db: AsyncSession, usuario_id: int) -> ProyectoModel:
    """El espacio personal del usuario; se crea la primera vez que lo pide."""
    espacio = (await db.execute(
        select(ProyectoModel).where(ProyectoModel.tipo == "personal", ProyectoModel.propietario_id == usuario_id)
    )).scalar_one_or_none()
    if espacio:
        return espacio
    espacio = ProyectoModel(nombre="Mis archivos", tipo="personal", propietario_id=usuario_id, usuario_id=usuario_id, estado="activo")
    db.add(espacio)
    await db.commit()
    await db.refresh(espacio)
    return espacio


async def espacios_de_equipo(db: AsyncSession, sin_acceso: set[int]) -> list[ProyectoModel]:
    consulta = select(ProyectoModel).where(ProyectoModel.tipo == "equipo").order_by(func.lower(ProyectoModel.nombre))
    if sin_acceso:
        consulta = consulta.where(ProyectoModel.id.not_in(sin_acceso))
    return list((await db.execute(consulta)).scalars().all())


async def obtener_espacio(db: AsyncSession, proyecto_id: int) -> ProyectoModel | None:
    return (await db.execute(
        select(ProyectoModel).where(ProyectoModel.id == proyecto_id, ProyectoModel.tipo.in_(TIPOS_ESPACIO))
    )).scalar_one_or_none()


async def respuestas(db: AsyncSession, espacios: list[ProyectoModel]) -> list[dict]:
    """Datos para mostrar cada espacio: miembros, cantidad de archivos y ultima modificacion."""
    ids = [e.id for e in espacios]
    if not ids:
        return []
    miembros: dict[int, list[int]] = {}
    for proyecto_id, usuario_id in (await db.execute(
        select(EspacioMiembroModel.proyecto_id, EspacioMiembroModel.usuario_id).where(EspacioMiembroModel.proyecto_id.in_(ids))
    )).all():
        miembros.setdefault(proyecto_id, []).append(usuario_id)
    conteos = {
        proyecto_id: (cantidad, ultima)
        for proyecto_id, cantidad, ultima in (await db.execute(
            select(DocumentoModel.proyecto_id, func.count(DocumentoModel.id), func.max(DocumentoModel.updated_at))
            .where(DocumentoModel.proyecto_id.in_(ids), DocumentoModel.eliminado_at.is_(None))
            .group_by(DocumentoModel.proyecto_id)
        )).all()
    }
    return [
        {
            "id": e.id, "nombre": e.nombre, "tipo": e.tipo, "descripcion": e.descripcion, "color": e.color,
            "abierto": e.abierto, "miembro_ids": miembros.get(e.id, []),
            "archivos": conteos.get(e.id, (0, None))[0], "ultima_modificacion": conteos.get(e.id, (0, None))[1],
        }
        for e in espacios
    ]


async def guardar_miembros(db: AsyncSession, proyecto_id: int, usuario_ids: list[int]) -> None:
    await db.execute(delete(EspacioMiembroModel).where(EspacioMiembroModel.proyecto_id == proyecto_id))
    for usuario_id in set(usuario_ids):
        db.add(EspacioMiembroModel(proyecto_id=proyecto_id, usuario_id=usuario_id))
