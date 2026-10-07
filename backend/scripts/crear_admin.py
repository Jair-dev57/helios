"""Crea el rol administrador y el primer usuario administrador en una base vacia.

Uso (desde backend/):  python -m scripts.crear_admin "Nombre" correo@ejemplo.com contraseña
"""
import asyncio
import sys

from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

import main  # noqa: F401 - registra todos los modelos
from src.core.config import settings
from src.features.auth.schemas import UsuarioCrear
from src.features.auth.services import crear_usuario
from src.features.roles.models import RolModel

NOMBRE_ROL = "administrador"


async def principal(nombre: str, email: str, password: str) -> None:
    engine = create_async_engine(settings.DATABASE_URL)
    sesion = async_sessionmaker(engine, expire_on_commit=False)
    async with sesion() as db:
        rol = await db.scalar(select(RolModel).where(RolModel.nombre == NOMBRE_ROL))
        if not rol:
            db.add(RolModel(nombre=NOMBRE_ROL, es_administrador=True))
            await db.commit()
        usuario = await crear_usuario(db, UsuarioCrear(nombre=nombre, email=email, password=password, rol=NOMBRE_ROL))
        print(f"Administrador creado: {usuario.email}")
    await engine.dispose()


if __name__ == "__main__":
    if len(sys.argv) != 4:
        sys.exit(__doc__)
    asyncio.run(principal(*sys.argv[1:]))
