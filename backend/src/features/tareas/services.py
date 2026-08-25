import msgspec
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from src.features.busqueda.services import eliminar_indice, indexar_entidad
from src.features.documentos.models import DocumentoModel
from src.features.tareas.models import TareaDocumentoModel, TareaModel
from src.features.tareas.schemas import TareaActualizar, TareaCrear
from src.features.historial.services import registrar_cambio

CAMPOS_SEGUIMIENTO = ["titulo", "descripcion", "estado", "prioridad", "fecha_vencimiento", "usuario_asignado_id"]


def _texto_indexado(tarea: TareaModel) -> str:
    partes = [tarea.titulo]
    if tarea.descripcion:
        partes.append(tarea.descripcion)
    partes.append(tarea.estado)
    partes.append(tarea.prioridad)
    return "\n".join(partes)


def _calcular_diff(antes: dict, despues: TareaModel) -> str | None:
    cambios = []
    for campo in CAMPOS_SEGUIMIENTO:
        valor_nuevo = getattr(despues, campo)
        valor_viejo = antes.get(campo)
        if valor_viejo != valor_nuevo:
            cambios.append(f"{campo}: {valor_viejo} → {valor_nuevo}")
    return "; ".join(cambios) if cambios else None


async def obtener_tareas(db: AsyncSession, proyecto_id: int | None = None) -> list[TareaModel]:
    query = select(TareaModel).order_by(TareaModel.orden)
    if proyecto_id is not None:
        query = query.where(TareaModel.proyecto_id == proyecto_id)
    result = await db.execute(query)
    return result.scalars().all()


async def obtener_tarea(db: AsyncSession, tarea_id: int) -> TareaModel | None:
    result = await db.execute(select(TareaModel).where(TareaModel.id == tarea_id))
    return result.scalar_one_or_none()


async def crear_tarea(db: AsyncSession, data: TareaCrear, usuario_id: int | None = None) -> TareaModel:
    tarea = TareaModel(**msgspec.structs.asdict(data))
    db.add(tarea)
    await db.commit()
    await db.refresh(tarea)
    tarea_id, titulo, proyecto_id = tarea.id, tarea.titulo, tarea.proyecto_id
    texto = _texto_indexado(tarea)
    await indexar_entidad(db, "tarea", tarea_id, texto)
    await registrar_cambio(db, "tarea", tarea_id, titulo, "creado", proyecto_id, usuario_id)
    await db.refresh(tarea)
    return tarea


async def actualizar_tarea(
    db: AsyncSession, tarea_id: int, data: TareaActualizar, usuario_id: int | None = None
) -> TareaModel | None:
    tarea = await obtener_tarea(db, tarea_id)
    if not tarea:
        return None
    antes = {campo: getattr(tarea, campo) for campo in CAMPOS_SEGUIMIENTO}
    for campo, valor in msgspec.structs.asdict(data).items():
        if valor is not None:
            setattr(tarea, campo, valor)
    await db.commit()
    await db.refresh(tarea)
    diff = _calcular_diff(antes, tarea)
    titulo, proyecto_id = tarea.titulo, tarea.proyecto_id
    texto = _texto_indexado(tarea)
    await indexar_entidad(db, "tarea", tarea_id, texto)
    if diff:
        await registrar_cambio(db, "tarea", tarea_id, titulo, "actualizado", proyecto_id, usuario_id, diff)
    await db.refresh(tarea)
    return tarea
    
async def eliminar_tarea(db: AsyncSession, tarea_id: int, usuario_id: int | None = None) -> bool:
    tarea = await obtener_tarea(db, tarea_id)
    if not tarea:
        return False
    titulo = tarea.titulo
    proyecto_id = tarea.proyecto_id
    enlaces = (await db.execute(
        select(TareaDocumentoModel).where(TareaDocumentoModel.tarea_id == tarea_id)
    )).scalars().all()
    for enlace in enlaces:
        await db.delete(enlace)
    await eliminar_indice(db, "tarea", tarea_id)
    await registrar_cambio(db, "tarea", tarea_id, titulo, "eliminado", proyecto_id, usuario_id)
    await db.delete(tarea)
    await db.commit()
    return True


async def agregar_documento_a_tarea(db: AsyncSession, tarea_id: int, documento_id: int) -> None:
    existe = await db.execute(
        select(TareaDocumentoModel).where(
            TareaDocumentoModel.tarea_id == tarea_id,
            TareaDocumentoModel.documento_id == documento_id,
        )
    )
    if existe.scalar_one_or_none():
        return
    enlace = TareaDocumentoModel(tarea_id=tarea_id, documento_id=documento_id)
    db.add(enlace)
    await db.commit()


async def quitar_documento_de_tarea(db: AsyncSession, tarea_id: int, documento_id: int) -> None:
    enlace = await db.execute(
        select(TareaDocumentoModel).where(
            TareaDocumentoModel.tarea_id == tarea_id,
            TareaDocumentoModel.documento_id == documento_id,
        )
    )
    obj = enlace.scalar_one_or_none()
    if obj:
        await db.delete(obj)
        await db.commit()


async def obtener_documentos_de_tarea(db: AsyncSession, tarea_id: int):
    result = await db.execute(
        select(DocumentoModel)
        .join(TareaDocumentoModel, TareaDocumentoModel.documento_id == DocumentoModel.id)
        .where(TareaDocumentoModel.tarea_id == tarea_id)
    )
    return result.scalars().all()


async def obtener_conteo_documentos_por_tareas(db: AsyncSession, tarea_ids: list[int]) -> dict[int, int]:
    if not tarea_ids:
        return {}
    result = await db.execute(
        select(TareaDocumentoModel.tarea_id, func.count(TareaDocumentoModel.id))
        .where(TareaDocumentoModel.tarea_id.in_(tarea_ids))
        .group_by(TareaDocumentoModel.tarea_id)
    )
    return dict(result.all())
