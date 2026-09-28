import re

import msgspec
from litestar.exceptions import ValidationException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from src.features.busqueda.services import eliminar_indice, indexar_entidad
from src.features.documentos.models import DocumentoModel
from src.features.tareas.models import TareaColumnaModel, TareaDocumentoModel, TareaModel
from src.features.tareas.schemas import (
    ColumnaActualizar,
    ColumnaCrear,
    TareaActualizar,
    TareaCrear,
)
from src.features.historial.services import registrar_cambio

CAMPOS_SEGUIMIENTO = ["titulo", "descripcion", "prioridad", "fecha_vencimiento", "usuario_asignado_id"]

# Columnas con las que arranca todo proyecto (las mismas que habia antes de ser editables)
COLUMNAS_POR_DEFECTO = [
    ("Por hacer", "#9096A8", False),
    ("En progreso", "#C08A2E", False),
    ("En revisión", "#5B6FB0", False),
    ("Hecho", "#1A7F4B", True),
]
PATRON_COLOR = re.compile(r"^#[0-9a-fA-F]{6}$")


def _texto_indexado(tarea: TareaModel, nombre_columna: str) -> str:
    partes = [tarea.titulo]
    if tarea.descripcion:
        partes.append(tarea.descripcion)
    partes.append(nombre_columna)
    partes.append(tarea.prioridad)
    return "\n".join(partes)


def _calcular_diff(antes: dict, despues: TareaModel, columna_antes: str, columna_despues: str) -> str | None:
    cambios = []
    if columna_antes != columna_despues:
        cambios.append(f"columna: {columna_antes} → {columna_despues}")
    for campo in CAMPOS_SEGUIMIENTO:
        valor_nuevo = getattr(despues, campo)
        valor_viejo = antes.get(campo)
        if valor_viejo != valor_nuevo:
            cambios.append(f"{campo}: {valor_viejo} → {valor_nuevo}")
    return "; ".join(cambios) if cambios else None


# ---------- Columnas ----------

async def obtener_columnas(db: AsyncSession, proyecto_id: int) -> list[TareaColumnaModel]:
    """Columnas del proyecto en orden; si aun no tiene, crea las de por defecto."""
    result = await db.execute(
        select(TareaColumnaModel)
        .where(TareaColumnaModel.proyecto_id == proyecto_id)
        .order_by(TareaColumnaModel.orden, TareaColumnaModel.id)
    )
    columnas = list(result.scalars().all())
    if columnas:
        return columnas
    for orden, (nombre, color, es_final) in enumerate(COLUMNAS_POR_DEFECTO):
        db.add(TareaColumnaModel(proyecto_id=proyecto_id, nombre=nombre, color=color, orden=orden, es_final=es_final))
    await db.commit()
    return await obtener_columnas(db, proyecto_id)


async def listar_todas_columnas(db: AsyncSession) -> list[TareaColumnaModel]:
    """Columnas de todos los proyectos, sin crear las de por defecto."""
    result = await db.execute(
        select(TareaColumnaModel).order_by(TareaColumnaModel.proyecto_id, TareaColumnaModel.orden, TareaColumnaModel.id)
    )
    return list(result.scalars().all())


async def obtener_columna(db: AsyncSession, columna_id: int) -> TareaColumnaModel | None:
    result = await db.execute(select(TareaColumnaModel).where(TareaColumnaModel.id == columna_id))
    return result.scalar_one_or_none()


async def _columna_del_proyecto(db: AsyncSession, columna_id: int, proyecto_id: int) -> TareaColumnaModel:
    columna = await obtener_columna(db, columna_id)
    if not columna or columna.proyecto_id != proyecto_id:
        raise ValidationException(detail="La columna no pertenece a este proyecto")
    return columna


def _validar_columna(nombre: str | None, color: str | None) -> None:
    if nombre is not None and not nombre.strip():
        raise ValidationException(detail="La columna necesita un nombre")
    if nombre is not None and len(nombre.strip()) > 50:
        raise ValidationException(detail="El nombre de la columna no puede superar 50 caracteres")
    if color is not None and not PATRON_COLOR.match(color):
        raise ValidationException(detail="Color no valido")


async def crear_columna(db: AsyncSession, data: ColumnaCrear) -> TareaColumnaModel:
    _validar_columna(data.nombre, data.color)
    columnas = await obtener_columnas(db, data.proyecto_id)
    columna = TareaColumnaModel(
        proyecto_id=data.proyecto_id,
        nombre=data.nombre.strip(),
        color=data.color,
        orden=max((c.orden for c in columnas), default=-1) + 1,
        es_final=False,
    )
    db.add(columna)
    await db.commit()
    await db.refresh(columna)
    return columna


async def actualizar_columna(db: AsyncSession, columna_id: int, data: ColumnaActualizar) -> TareaColumnaModel | None:
    columna = await obtener_columna(db, columna_id)
    if not columna:
        return None
    _validar_columna(data.nombre, data.color)
    if data.nombre is not None:
        columna.nombre = data.nombre.strip()
    if data.color is not None:
        columna.color = data.color
    if data.es_final is not None:
        if data.es_final:
            # Solo una columna de terminadas por proyecto
            for otra in await obtener_columnas(db, columna.proyecto_id):
                otra.es_final = otra.id == columna.id
        else:
            columna.es_final = False
    await db.commit()
    await db.refresh(columna)
    return columna


async def reordenar_columnas(db: AsyncSession, proyecto_id: int, columna_ids: list[int]) -> list[TareaColumnaModel]:
    columnas = await obtener_columnas(db, proyecto_id)
    por_id = {c.id: c for c in columnas}
    if set(columna_ids) != set(por_id):
        raise ValidationException(detail="El orden debe incluir todas las columnas del proyecto")
    for orden, columna_id in enumerate(columna_ids):
        por_id[columna_id].orden = orden
    await db.commit()
    return await obtener_columnas(db, proyecto_id)


async def eliminar_columna(db: AsyncSession, columna_id: int, mover_a: int | None) -> bool:
    """Elimina una columna moviendo antes sus tareas a `mover_a`."""
    columna = await obtener_columna(db, columna_id)
    if not columna:
        return False
    columnas = await obtener_columnas(db, columna.proyecto_id)
    if len(columnas) <= 1:
        raise ValidationException(detail="El tablero debe tener al menos una columna")

    tareas = (await db.execute(select(TareaModel).where(TareaModel.columna_id == columna_id))).scalars().all()
    if tareas:
        if mover_a is None or mover_a == columna_id:
            raise ValidationException(detail="Elige a qué columna mover las tareas")
        destino = await _columna_del_proyecto(db, mover_a, columna.proyecto_id)
        base = await _siguiente_orden(db, destino.id)
        for i, tarea in enumerate(sorted(tareas, key=lambda t: t.orden)):
            tarea.columna_id = destino.id
            tarea.orden = base + i
    await db.delete(columna)
    await db.commit()
    return True


async def ids_columnas_finales(db: AsyncSession, columna_ids: set[int]) -> set[int]:
    if not columna_ids:
        return set()
    result = await db.execute(
        select(TareaColumnaModel.id).where(
            TareaColumnaModel.id.in_(columna_ids), TareaColumnaModel.es_final.is_(True)
        )
    )
    return set(result.scalars().all())


async def _siguiente_orden(db: AsyncSession, columna_id: int) -> int:
    result = await db.execute(select(func.max(TareaModel.orden)).where(TareaModel.columna_id == columna_id))
    maximo = result.scalar_one_or_none()
    return 0 if maximo is None else maximo + 1


# ---------- Tareas ----------

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
    if data.columna_id is None:
        columna = (await obtener_columnas(db, data.proyecto_id))[0]
    else:
        columna = await _columna_del_proyecto(db, data.columna_id, data.proyecto_id)
    nombre_columna = columna.nombre
    datos = msgspec.structs.asdict(data)
    datos["columna_id"] = columna.id
    datos["orden"] = await _siguiente_orden(db, columna.id)
    tarea = TareaModel(**datos)
    db.add(tarea)
    await db.commit()
    await db.refresh(tarea)
    tarea_id, titulo, proyecto_id = tarea.id, tarea.titulo, tarea.proyecto_id
    texto = _texto_indexado(tarea, nombre_columna)
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
    # Nombres leidos antes del commit (despues los objetos quedan expirados)
    nombre_antes = (await obtener_columna(db, tarea.columna_id)).nombre
    nombre_despues = nombre_antes
    if data.columna_id is not None and data.columna_id != tarea.columna_id:
        nombre_despues = (await _columna_del_proyecto(db, data.columna_id, tarea.proyecto_id)).nombre
    for campo, valor in msgspec.structs.asdict(data).items():
        if valor is not None:
            setattr(tarea, campo, valor)
    await db.commit()
    await db.refresh(tarea)
    diff = _calcular_diff(antes, tarea, nombre_antes, nombre_despues)
    titulo, proyecto_id = tarea.titulo, tarea.proyecto_id
    texto = _texto_indexado(tarea, nombre_despues)
    await indexar_entidad(db, "tarea", tarea_id, texto)
    if diff:
        await registrar_cambio(db, "tarea", tarea_id, titulo, "actualizado", proyecto_id, usuario_id, diff)
    await db.refresh(tarea)
    return tarea


async def reordenar_tareas(
    db: AsyncSession, columna_id: int, tarea_ids: list[int], usuario_id: int | None = None
) -> None:
    """Deja las tareas indicadas en la columna, en ese orden. Registra en el historial las que cambian de columna."""
    columna = await obtener_columna(db, columna_id)
    if not columna:
        raise ValidationException(detail="Columna no encontrada")
    tareas = (await db.execute(select(TareaModel).where(TareaModel.id.in_(tarea_ids)))).scalars().all()
    por_id = {t.id: t for t in tareas}
    if len(por_id) != len(set(tarea_ids)) or any(t.proyecto_id != columna.proyecto_id for t in tareas):
        raise ValidationException(detail="Las tareas no pertenecen a este proyecto")

    # Los datos para historial y busqueda se leen antes del commit (despues quedan expirados)
    movidas = []
    nombre_columna, proyecto_id = columna.nombre, columna.proyecto_id
    for orden, tarea_id in enumerate(tarea_ids):
        tarea = por_id[tarea_id]
        if tarea.columna_id != columna_id:
            anterior = await obtener_columna(db, tarea.columna_id)
            movidas.append((tarea.id, tarea.titulo, anterior.nombre if anterior else "?", _texto_indexado(tarea, nombre_columna)))
            tarea.columna_id = columna_id
        tarea.orden = orden
    await db.commit()

    for tarea_id, titulo, nombre_anterior, texto in movidas:
        await indexar_entidad(db, "tarea", tarea_id, texto)
        await registrar_cambio(
            db, "tarea", tarea_id, titulo, "actualizado", proyecto_id, usuario_id,
            f"columna: {nombre_anterior} → {nombre_columna}",
        )


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
