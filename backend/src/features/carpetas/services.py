import msgspec
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from src.features.carpetas.models import CarpetaModel
from src.features.carpetas.schemas import CarpetaCrear, CarpetaActualizar


async def obtener_carpetas(db: AsyncSession, proyecto_id: int | None = None) -> list[CarpetaModel]:
    query = select(CarpetaModel).where(CarpetaModel.eliminado_at.is_(None))
    if proyecto_id is not None:
        query = query.where(CarpetaModel.proyecto_id == proyecto_id)
    result = await db.execute(query)
    return result.scalars().all()


async def obtener_carpeta(db: AsyncSession, carpeta_id: int) -> CarpetaModel | None:
    result = await db.execute(
        select(CarpetaModel).where(CarpetaModel.id == carpeta_id, CarpetaModel.eliminado_at.is_(None))
    )
    return result.scalar_one_or_none()


async def crear_carpeta(db: AsyncSession, data: CarpetaCrear) -> CarpetaModel:
    # Omitir los None para que la base de datos aplique sus valores por defecto (color amarillo)
    campos = {k: v for k, v in msgspec.structs.asdict(data).items() if v is not None}
    carpeta = CarpetaModel(**campos)
    db.add(carpeta)
    await db.commit()
    await db.refresh(carpeta)
    return carpeta


async def actualizar_carpeta(db: AsyncSession, carpeta_id: int, data: CarpetaActualizar) -> CarpetaModel | None:
    carpeta = await obtener_carpeta(db, carpeta_id)
    if not carpeta:
        return None
    for campo, valor in msgspec.structs.asdict(data).items():
        if valor is not None:
            setattr(carpeta, campo, valor)
    await db.commit()
    await db.refresh(carpeta)
    return carpeta


def _nombre_seguro(nombre: str) -> str:
    """Un nombre de carpeta o archivo no puede partir la ruta dentro del ZIP."""
    return nombre.replace("/", "-").replace("\\", "-").strip() or "sin nombre"


async def contenido_para_zip(db: AsyncSession, carpeta: CarpetaModel, ocultos: set[int]) -> list[tuple[str, str | None]]:
    """Entradas del ZIP de una carpeta: (ruta dentro del ZIP, ruta del archivo en disco o None si es carpeta).

    Incluye las subcarpetas (tambien vacias) y la version actual de cada archivo; deja fuera lo que esta
    en la papelera y los documentos ocultos para el usuario.
    """
    from src.features.documentos.models import DocumentoModel

    filas = (await db.execute(
        select(CarpetaModel.id, CarpetaModel.nombre, CarpetaModel.carpeta_padre_id).where(
            CarpetaModel.proyecto_id == carpeta.proyecto_id, CarpetaModel.eliminado_at.is_(None)
        )
    )).all()
    hijos: dict[int, list[tuple[int, str]]] = {}
    for id_, nombre, padre in filas:
        hijos.setdefault(padre, []).append((id_, nombre))

    rutas = {carpeta.id: _nombre_seguro(carpeta.nombre)}
    pendientes = [carpeta.id]
    while pendientes:
        actual = pendientes.pop()
        usados = set()
        for id_, nombre in sorted(hijos.get(actual, []), key=lambda h: h[1].lower()):
            nombre = _nombre_seguro(nombre)
            base, n = nombre, 2
            while nombre.lower() in usados:
                nombre, n = f"{base} ({n})", n + 1
            usados.add(nombre.lower())
            rutas[id_] = f"{rutas[actual]}/{nombre}"
            pendientes.append(id_)

    consulta = select(DocumentoModel.nombre, DocumentoModel.tipo, DocumentoModel.ruta, DocumentoModel.carpeta_id).where(
        DocumentoModel.carpeta_id.in_(rutas), DocumentoModel.eliminado_at.is_(None)
    )
    if ocultos:
        consulta = consulta.where(DocumentoModel.id.not_in(ocultos))
    entradas: list[tuple[str, str | None]] = [(f"{ruta}/", None) for ruta in rutas.values()]
    usados: set[str] = set()
    for nombre, tipo, ruta, carpeta_id in sorted((await db.execute(consulta)).all(), key=lambda d: d[0].lower()):
        base = _nombre_seguro(nombre)
        extension = f".{tipo}" if tipo else ""
        destino, n = f"{rutas[carpeta_id]}/{base}{extension}", 2
        # Dos archivos con el mismo nombre en una carpeta (p. ej. copias): el ZIP no admite repetidos
        while destino.lower() in usados:
            destino, n = f"{rutas[carpeta_id]}/{base} ({n}){extension}", n + 1
        usados.add(destino.lower())
        entradas.append((destino, ruta))
    return entradas
