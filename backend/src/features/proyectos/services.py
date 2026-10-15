import msgspec
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession
from src.features.busqueda.services import eliminar_indice, indexar_entidad
from src.features.historial.services import registrar_cambio
from src.features.proyectos.models import ProyectoModel
from src.features.proyectos.schemas import ProyectoActualizar, ProyectoCrear

CAMPOS_SEGUIMIENTO = ["nombre", "descripcion", "estado", "fecha_vencimiento", "cliente_id", "acceso"]


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
    # Los espacios de archivos (personal / equipo) no son proyectos
    result = await db.execute(select(ProyectoModel).where(ProyectoModel.tipo == "proyecto"))
    return result.scalars().all()


async def obtener_proyecto(db: AsyncSession, proyecto_id: int) -> ProyectoModel | None:
    result = await db.execute(select(ProyectoModel).where(ProyectoModel.id == proyecto_id))
    return result.scalar_one_or_none()


async def miembros_de(db: AsyncSession, proyecto_ids: list[int]) -> dict[int, list[int]]:
    """Personas elegidas de cada proyecto (acceso 'personas')."""
    from src.features.espacios.models import EspacioMiembroModel

    miembros: dict[int, list[int]] = {pid: [] for pid in proyecto_ids}
    if proyecto_ids:
        filas = await db.execute(
            select(EspacioMiembroModel.proyecto_id, EspacioMiembroModel.usuario_id)
            .where(EspacioMiembroModel.proyecto_id.in_(proyecto_ids))
        )
        for pid, uid in filas.all():
            miembros[pid].append(uid)
    return miembros


async def _guardar_miembros(db: AsyncSession, proyecto_id: int, usuario_ids: list[int]) -> None:
    from src.features.espacios.models import EspacioMiembroModel

    await db.execute(delete(EspacioMiembroModel).where(EspacioMiembroModel.proyecto_id == proyecto_id))
    for uid in dict.fromkeys(usuario_ids):
        db.add(EspacioMiembroModel(proyecto_id=proyecto_id, usuario_id=uid))


async def crear_proyecto(db: AsyncSession, data: ProyectoCrear, usuario_id: int | None = None) -> ProyectoModel:
    datos = msgspec.structs.asdict(data)
    miembro_ids = datos.pop("miembro_ids")
    proyecto = ProyectoModel(**datos)
    db.add(proyecto)
    await db.flush()
    if data.acceso == "personas":
        await _guardar_miembros(db, proyecto.id, miembro_ids)
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
    datos = msgspec.structs.asdict(data)
    miembro_ids = datos.pop("miembro_ids")
    if miembro_ids is not None:
        # Las personas elegidas solo cuentan con acceso 'personas'
        await _guardar_miembros(db, proyecto_id, miembro_ids if (data.acceso or proyecto.acceso) == "personas" else [])
    for campo, valor in datos.items():
        # area_id admite null (quitar el area); el resto, solo los campos enviados con valor
        if (campo == "area_id" and valor is not msgspec.UNSET) or (campo != "area_id" and valor is not None):
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
