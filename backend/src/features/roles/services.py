import msgspec
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from src.core.secciones import SECCIONES_DISPONIBLES
from src.features.roles.models import RolModel, RolSeccionModel
from src.features.roles.schemas import RolCrear, RolActualizar


async def obtener_roles(db: AsyncSession) -> list[RolModel]:
    result = await db.execute(select(RolModel).order_by(RolModel.nombre))
    return result.scalars().all()


async def obtener_rol(db: AsyncSession, rol_id: int) -> RolModel | None:
    result = await db.execute(select(RolModel).where(RolModel.id == rol_id))
    return result.scalar_one_or_none()


async def obtener_rol_por_nombre(db: AsyncSession, nombre: str) -> RolModel | None:
    result = await db.execute(select(RolModel).where(RolModel.nombre == nombre))
    return result.scalar_one_or_none()


async def crear_rol(db: AsyncSession, data: RolCrear) -> RolModel:
    rol = RolModel(**msgspec.structs.asdict(data))
    db.add(rol)
    await db.commit()
    await db.refresh(rol)
    return rol


async def actualizar_rol(db: AsyncSession, rol_id: int, data: RolActualizar) -> RolModel | None:
    rol = await obtener_rol(db, rol_id)
    if not rol:
        return None
    for campo, valor in msgspec.structs.asdict(data).items():
        if valor is not None:
            setattr(rol, campo, valor)
    await db.commit()
    await db.refresh(rol)
    return rol


async def eliminar_rol(db: AsyncSession, rol_id: int) -> bool:
    rol = await obtener_rol(db, rol_id)
    if not rol:
        return False
    await db.delete(rol)
    await db.commit()
    return True


async def obtener_secciones_rol(db: AsyncSession, rol_id: int) -> list[str]:
    result = await db.execute(select(RolSeccionModel.seccion).where(RolSeccionModel.rol_id == rol_id))
    return [row[0] for row in result.all()]


async def reemplazar_secciones_rol(db: AsyncSession, rol_id: int, secciones: list[str]) -> list[str]:
    secciones_validas = [s for s in secciones if s in SECCIONES_DISPONIBLES]

    existentes = await db.execute(select(RolSeccionModel).where(RolSeccionModel.rol_id == rol_id))
    for fila in existentes.scalars().all():
        await db.delete(fila)
    await db.commit()

    for seccion in secciones_validas:
        db.add(RolSeccionModel(rol_id=rol_id, seccion=seccion))
    await db.commit()

    return secciones_validas


async def usuario_tiene_seccion(db: AsyncSession, rol_nombre: str, seccion: str) -> bool:
    """Los roles con es_administrador=True siempre tienen acceso total."""
    rol = await obtener_rol_por_nombre(db, rol_nombre)
    if not rol:
        return False
    if rol.es_administrador:
        return True
    secciones = await obtener_secciones_rol(db, rol.id)
    return seccion in secciones
