import re

import msgspec
from litestar.datastructures import UploadFile
from litestar.exceptions import ValidationException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from src.core.archivos import guardar_imagen, eliminar_archivo
from src.core.security import hash_password, verify_password
from src.features.auth.models import UsuarioModel
from src.features.auth.schemas import (
    UsuarioCrear,
    UsuarioActualizar,
    PerfilActualizar,
    CambioPassword,
    LoginRequest,
)

PATRON_USERNAME = re.compile(r"^[a-z0-9._-]{3,30}$")
LARGO_MIN_PASSWORD = 6
CAMPOS_OPCIONALES = {"telefono", "cargo"}


def _validar_password(password: str) -> None:
    if len(password) < LARGO_MIN_PASSWORD:
        raise ValidationException(detail=f"La contraseña debe tener al menos {LARGO_MIN_PASSWORD} caracteres")


async def _normalizar_username(db: AsyncSession, username: str, usuario_id: int | None = None) -> str | None:
    """Valida formato y unicidad del nombre de usuario. Un texto vacio lo quita."""
    username = username.strip().lower()
    if not username:
        return None
    if not PATRON_USERNAME.match(username):
        raise ValidationException(
            detail="El nombre de usuario debe tener 3 a 30 caracteres: letras, numeros, punto, guion o guion bajo"
        )
    consulta = select(UsuarioModel.id).where(UsuarioModel.username == username)
    if usuario_id is not None:
        consulta = consulta.where(UsuarioModel.id != usuario_id)
    if (await db.execute(consulta)).first():
        raise ValidationException(detail="Ese nombre de usuario ya esta en uso")
    return username


async def _validar_email_unico(db: AsyncSession, email: str, usuario_id: int | None = None) -> str:
    email = email.strip().lower()
    consulta = select(UsuarioModel.id).where(func.lower(UsuarioModel.email) == email)
    if usuario_id is not None:
        consulta = consulta.where(UsuarioModel.id != usuario_id)
    if (await db.execute(consulta)).first():
        raise ValidationException(detail="Ya existe un usuario con ese email")
    return email


async def _aplicar_cambios(db: AsyncSession, usuario: UsuarioModel, cambios: dict) -> None:
    for campo, valor in cambios.items():
        if valor is None:
            continue
        if campo == "password":
            _validar_password(valor)
            usuario.password_hash = hash_password(valor)
        elif campo == "username":
            usuario.username = await _normalizar_username(db, valor, usuario.id)
        elif campo == "email":
            usuario.email = await _validar_email_unico(db, valor, usuario.id)
        elif campo in CAMPOS_OPCIONALES:
            # Un texto vacio borra el dato opcional
            setattr(usuario, campo, valor.strip() or None)
        elif campo == "nombre":
            if valor.strip():
                usuario.nombre = valor.strip()
        else:
            setattr(usuario, campo, valor)


async def obtener_usuarios(db: AsyncSession) -> list[UsuarioModel]:
    result = await db.execute(select(UsuarioModel).order_by(UsuarioModel.nombre))
    return result.scalars().all()


async def obtener_usuario(db: AsyncSession, usuario_id: int) -> UsuarioModel | None:
    result = await db.execute(select(UsuarioModel).where(UsuarioModel.id == usuario_id))
    return result.scalar_one_or_none()


async def autenticar_usuario(db: AsyncSession, data: LoginRequest) -> UsuarioModel | None:
    """Acepta el email o el nombre de usuario."""
    identificador = data.usuario.strip().lower()
    result = await db.execute(
        select(UsuarioModel).where(
            (func.lower(UsuarioModel.email) == identificador) | (UsuarioModel.username == identificador)
        )
    )
    usuario = result.scalars().first()
    if not usuario or not usuario.activo:
        return None
    if not verify_password(data.password, usuario.password_hash):
        return None
    return usuario


async def crear_usuario(db: AsyncSession, data: UsuarioCrear) -> UsuarioModel:
    _validar_password(data.password)
    usuario = UsuarioModel(
        nombre=data.nombre.strip(),
        email=await _validar_email_unico(db, data.email),
        password_hash=hash_password(data.password),
        rol=data.rol,
        username=await _normalizar_username(db, data.username) if data.username else None,
        telefono=(data.telefono or "").strip() or None,
        cargo=(data.cargo or "").strip() or None,
    )
    db.add(usuario)
    await db.commit()
    await db.refresh(usuario)
    return usuario


async def actualizar_usuario(db: AsyncSession, usuario_id: int, data: UsuarioActualizar) -> UsuarioModel | None:
    usuario = await obtener_usuario(db, usuario_id)
    if not usuario:
        return None
    await _aplicar_cambios(db, usuario, msgspec.structs.asdict(data))
    await db.commit()
    await db.refresh(usuario)
    return usuario


async def actualizar_perfil(db: AsyncSession, usuario: UsuarioModel, data: PerfilActualizar) -> UsuarioModel:
    await _aplicar_cambios(db, usuario, msgspec.structs.asdict(data))
    await db.commit()
    await db.refresh(usuario)
    return usuario


async def cambiar_password(db: AsyncSession, usuario: UsuarioModel, data: CambioPassword) -> None:
    if not verify_password(data.password_actual, usuario.password_hash):
        raise ValidationException(detail="La contraseña actual no es correcta")
    _validar_password(data.password_nueva)
    usuario.password_hash = hash_password(data.password_nueva)
    await db.commit()


async def cambiar_avatar(db: AsyncSession, usuario: UsuarioModel, archivo: UploadFile) -> UsuarioModel:
    nueva_ruta = await guardar_imagen(archivo, "avatares")
    eliminar_archivo(usuario.avatar_url)
    usuario.avatar_url = nueva_ruta
    await db.commit()
    await db.refresh(usuario)
    return usuario


async def quitar_avatar(db: AsyncSession, usuario: UsuarioModel) -> UsuarioModel:
    eliminar_archivo(usuario.avatar_url)
    usuario.avatar_url = None
    await db.commit()
    await db.refresh(usuario)
    return usuario


async def eliminar_usuario(db: AsyncSession, usuario_id: int) -> bool:
    usuario = await obtener_usuario(db, usuario_id)
    if not usuario:
        return False
    eliminar_archivo(usuario.avatar_url)
    await db.delete(usuario)
    await db.commit()
    return True
