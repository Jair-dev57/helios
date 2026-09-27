import msgspec
from litestar.datastructures import UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from src.core.archivos import guardar_imagen, eliminar_archivo
from src.features.configuracion.models import EmpresaModel
from src.features.configuracion.schemas import EmpresaActualizar


async def obtener_empresa(db: AsyncSession) -> EmpresaModel:
    """Devuelve la fila de la empresa, creandola con valores por defecto si aun no existe."""
    result = await db.execute(select(EmpresaModel).order_by(EmpresaModel.id).limit(1))
    empresa = result.scalar_one_or_none()
    if not empresa:
        empresa = EmpresaModel(nombre="Mi empresa")
        db.add(empresa)
        await db.commit()
        await db.refresh(empresa)
    return empresa


async def actualizar_empresa(db: AsyncSession, data: EmpresaActualizar) -> EmpresaModel:
    empresa = await obtener_empresa(db)
    for campo, valor in msgspec.structs.asdict(data).items():
        if valor is None:
            continue
        valor = valor.strip()
        if campo == "nombre":
            if valor:
                empresa.nombre = valor
        else:
            # Un texto vacio borra el dato opcional
            setattr(empresa, campo, valor or None)
    await db.commit()
    await db.refresh(empresa)
    return empresa


async def cambiar_logo(db: AsyncSession, archivo: UploadFile) -> EmpresaModel:
    empresa = await obtener_empresa(db)
    nueva_ruta = await guardar_imagen(archivo, "empresa")
    eliminar_archivo(empresa.logo_url)
    empresa.logo_url = nueva_ruta
    await db.commit()
    await db.refresh(empresa)
    return empresa


async def quitar_logo(db: AsyncSession) -> EmpresaModel:
    empresa = await obtener_empresa(db)
    eliminar_archivo(empresa.logo_url)
    empresa.logo_url = None
    await db.commit()
    await db.refresh(empresa)
    return empresa
