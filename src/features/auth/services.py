from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from src.features.auth.models import UsuarioModel
from src.features.auth.schemas import UsuarioCrear, UsuarioActualizar

async def obtener_usuarios(db: AsyncSession) -> list[UsuarioModel]:
    result = await db.execute(select(UsuarioModel))
    return result.scalars().all()

async def obtener_usuario(db: AsyncSession, usuario_id: int) -> UsuarioModel | None:
    result = await db.execute(select(UsuarioModel).where(UsuarioModel.id == usuario_id))
    return result.scalar_one_or_none()

async def crear_usuario(db: AsyncSession, data: UsuarioCrear) -> UsuarioModel:
    usuario = UsuarioModel(
        nombre=data.nombre,
        email=data.email,
        password_hash=data.password,  # sin hashear por ahora
        rol=data.rol,
    )
    db.add(usuario)
    await db.commit()
    await db.refresh(usuario)
    return usuario

async def actualizar_usuario(db: AsyncSession, usuario_id: int, data: UsuarioActualizar) -> UsuarioModel | None:
    usuario = await obtener_usuario(db, usuario_id)
    if not usuario:
        return None
    for campo, valor in data.__dict__.items():
        if valor is not None:
            setattr(usuario, campo, valor)
    await db.commit()
    await db.refresh(usuario)
    return usuario

async def eliminar_usuario(db: AsyncSession, usuario_id: int) -> bool:
    usuario = await obtener_usuario(db, usuario_id)
    if not usuario:
        return False
    await db.delete(usuario)
    await db.commit()
    return True