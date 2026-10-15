"""Espacios de archivos: el personal de cada usuario y los de equipo (por area).

Por dentro son proyectos con tipo 'personal' o 'equipo', asi reutilizan todo lo de documentos.
El acceso a espacios y a proyectos se decide en proyectos_sin_acceso, que documentos_ocultos y los
controladores consultan.
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


async def ocultos_para(db: AsyncSession, usuario_id: int | None, admin: bool) -> set[int]:
    """Ids de espacios y proyectos que esa persona no puede ver.

    Espacios: los personales ajenos (tampoco los ve un administrador) y los de equipo cerrados de los que no es
    miembro (los administradores si los ven).
    Proyectos: quien lo creo siempre lo ve. 'solo': nadie mas (tampoco un administrador); 'personas': las elegidas
    y los administradores; 'equipo': los miembros de su area (o todos si el area esta abierta) y los
    administradores; 'todos': cualquiera.
    """
    miembro_de = select(EspacioMiembroModel.proyecto_id).where(EspacioMiembroModel.usuario_id == usuario_id)
    filas = (await db.execute(
        select(ProyectoModel.id, ProyectoModel.tipo, ProyectoModel.propietario_id, ProyectoModel.abierto,
               ProyectoModel.usuario_id, ProyectoModel.acceso, ProyectoModel.area_id, ProyectoModel.id.in_(miembro_de))
    )).all()
    # Areas que esa persona puede ver: abiertas o de las que es miembro
    areas_visibles = {f[0] for f in filas if f[1] == "equipo" and (f[3] or f[7])}
    sin_acceso = set()
    for proyecto_id, tipo, propietario_id, abierto, creador_id, acceso, area_id, es_miembro in filas:
        if tipo == "personal":
            if propietario_id != usuario_id:
                sin_acceso.add(proyecto_id)
        elif tipo == "equipo":
            if not (admin or abierto or es_miembro):
                sin_acceso.add(proyecto_id)
        elif creador_id == usuario_id or acceso == "todos":
            continue
        elif acceso == "solo":
            sin_acceso.add(proyecto_id)
        elif acceso == "personas" and not (admin or es_miembro):
            sin_acceso.add(proyecto_id)
        elif acceso == "equipo" and area_id and not (admin or area_id in areas_visibles):
            sin_acceso.add(proyecto_id)
    return sin_acceso


async def proyectos_sin_acceso(db: AsyncSession, request: Request) -> set[int]:
    """Ids de espacios y proyectos que el usuario autenticado no puede ver (ver ocultos_para)."""
    return await ocultos_para(db, id_usuario(request), await es_admin(db, request))


async def puede_ver(db: AsyncSession, proyecto_id: int, usuario_id: int) -> bool:
    """Si esa persona (no necesariamente quien hace la peticion) ve el proyecto; sirve para asignarle tareas."""
    from src.features.auth.models import UsuarioModel
    from src.features.roles.services import obtener_rol_por_nombre

    usuario = await db.get(UsuarioModel, usuario_id)
    if not usuario or not usuario.activo:
        return False
    rol = await obtener_rol_por_nombre(db, usuario.rol or "")
    return proyecto_id not in await ocultos_para(db, usuario_id, bool(rol and rol.es_administrador))


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
