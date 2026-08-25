import msgspec
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from src.features.busqueda.services import eliminar_indice, indexar_entidad
from src.features.historial.services import registrar_cambio
from src.features.proyectos.models import ProyectoModel
from src.features.proyectos.schemas import ProyectoActualizar, ProyectoCrear

CAMPOS_SEGUIMIENTO = ["nombre", "descripcion", "estado", "fecha_vencimiento", "cliente_id"]


def _texto_indexado(proyecto: ProyectoModel) -> str:
    partes = [proyecto.nombre]
    if proyecto.descripcion:
        partes.append(proyecto.descripcion)
    if proyecto.estado:
        partes.append(proyecto.estado)
    return "\n".join(partes)


def _calcular_diff(antes: dict, despues: ProyectoModel) -> str | None:
    cambios = []
    for campo in CAMPOS_SEGUIMIENTO:
        valor_nuevo = getattr(despues, campo)
        valor_viejo = antes.get(campo)
        if valor_viejo != valor_nuevo:
            cambios.append(f"{campo}: {valor_viejo} → {valor_nuevo}")
    return "; ".join(cambios) if cambios else None


async def obtener_proyectos(db: AsyncSession) -> list[ProyectoModel]:
    result = await db.execute(select(ProyectoModel))
    return result.scalars().all()


async def obtener_proyecto(db: AsyncSession, proyecto_id: int) -> ProyectoModel | None:
    result = await db.execute(select(ProyectoModel).where(ProyectoModel.id == proyecto_id))
    return result.scalar_one_or_none()


async def crear_proyecto(db: AsyncSession, data: ProyectoCrear, usuario_id: int | None = None) -> ProyectoModel:
    proyecto = ProyectoModel(**msgspec.structs.asdict(data))
    db.add(proyecto)
    await db.commit()
    await db.refresh(proyecto)
    proyecto_id, nombre = proyecto.id, proyecto.nombre
    texto = _texto_indexado(proyecto)
    await indexar_entidad(db, "proyecto", proyecto_id, texto)
    await registrar_cambio(db, "proyecto", proyecto_id, nombre, "creado", proyecto_id, usuario_id)
    await db.refresh(proyecto)
    return proyecto


async def actualizar_proyecto(
    db: AsyncSession, proyecto_id: int, data: ProyectoActualizar, usuario_id: int | None = None
) -> ProyectoModel | None:
    proyecto = await obtener_proyecto(db, proyecto_id)
    if not proyecto:
        return None
    antes = {campo: getattr(proyecto, campo) for campo in CAMPOS_SEGUIMIENTO}
    for campo, valor in msgspec.structs.asdict(data).items():
        if valor is not None:
            setattr(proyecto, campo, valor)
    await db.commit()
    await db.refresh(proyecto)
    diff = _calcular_diff(antes, proyecto)
    nombre = proyecto.nombre
    texto = _texto_indexado(proyecto)
    await indexar_entidad(db, "proyecto", proyecto_id, texto)
    if diff:
        await registrar_cambio(db, "proyecto", proyecto_id, nombre, "actualizado", proyecto_id, usuario_id, diff)
    await db.refresh(proyecto)
    return proyecto


async def eliminar_proyecto(db: AsyncSession, proyecto_id: int, usuario_id: int | None = None) -> bool:
    proyecto = await obtener_proyecto(db, proyecto_id)
    if not proyecto:
        return False
    nombre = proyecto.nombre
    await eliminar_indice(db, "proyecto", proyecto_id)
    await registrar_cambio(db, "proyecto", proyecto_id, nombre, "eliminado", proyecto_id, usuario_id)
    await db.delete(proyecto)
    await db.commit()
    return True
