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


async def contenido_proyecto(db: AsyncSession, proyecto_id: int) -> dict[str, int]:
    """Lo que se perderia al eliminar el proyecto (incluida su papelera)."""
    from sqlalchemy import func
    from src.features.carpetas.models import CarpetaModel
    from src.features.documentos.models import DocumentoModel
    from src.features.tareas.models import TareaModel

    contar = lambda modelo: select(func.count()).select_from(modelo).where(modelo.proyecto_id == proyecto_id)  # noqa: E731
    return {
        "tareas": (await db.execute(contar(TareaModel))).scalar_one(),
        "archivos": (await db.execute(contar(DocumentoModel))).scalar_one(),
        "carpetas": (await db.execute(contar(CarpetaModel))).scalar_one(),
    }


async def eliminar_proyecto(db: AsyncSession, proyecto_id: int, usuario_id: int | None = None) -> bool:
    """Elimina para siempre el proyecto con sus tareas, archivos (tambien del disco, con todas sus versiones),
    carpetas y columnas. Lo demas (favoritos, enlaces, etiquetas, miembros...) se va en cascada."""
    from src.features.carpetas.models import CarpetaModel
    from src.features.documentos.extraccion import _ruta_local
    from src.features.documentos.models import DocumentoModel
    from src.features.historial.models import HistorialCambioModel
    from src.features.tareas.models import TareaDocumentoModel, TareaModel

    proyecto = await obtener_proyecto(db, proyecto_id)
    if not proyecto:
        return False
    nombre = proyecto.nombre
    tarea_ids = list((await db.execute(select(TareaModel.id).where(TareaModel.proyecto_id == proyecto_id))).scalars().all())
    documentos = (await db.execute(
        select(DocumentoModel.id, DocumentoModel.ruta).where(DocumentoModel.proyecto_id == proyecto_id)
    )).all()
    documento_ids = [d for d, _ in documentos]
    # Archivos del disco: la version actual y las anteriores (quedan en el historial)
    rutas = {r for _, r in documentos if r}
    if documento_ids:
        rutas |= set((await db.execute(
            select(HistorialCambioModel.ruta).where(
                HistorialCambioModel.entidad_tipo == "documento",
                HistorialCambioModel.entidad_id.in_(documento_ids),
                HistorialCambioModel.ruta.is_not(None),
            )
        )).scalars().all())

    for tarea_id in tarea_ids:
        await eliminar_indice(db, "tarea", tarea_id)
    for documento_id in documento_ids:
        await eliminar_indice(db, "documento", documento_id)
    await eliminar_indice(db, "proyecto", proyecto_id)

    if tarea_ids or documento_ids:
        await db.execute(delete(TareaDocumentoModel).where(
            TareaDocumentoModel.tarea_id.in_(tarea_ids) | TareaDocumentoModel.documento_id.in_(documento_ids)
        ))
    await db.execute(delete(TareaModel).where(TareaModel.proyecto_id == proyecto_id))
    await db.execute(delete(DocumentoModel).where(DocumentoModel.proyecto_id == proyecto_id))
    # Una sola sentencia: la referencia a la carpeta padre se comprueba al final
    await db.execute(delete(CarpetaModel).where(CarpetaModel.proyecto_id == proyecto_id))
    await db.delete(proyecto)
    await db.commit()
    await registrar_cambio(db, "proyecto", proyecto_id, nombre, "eliminado", proyecto_id, usuario_id)

    # Los archivos se borran del disco solo cuando la base de datos ya confirmo
    for ruta in rutas:
        _ruta_local(ruta).unlink(missing_ok=True)
    return True
