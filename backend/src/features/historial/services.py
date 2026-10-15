from __future__ import annotations
import re
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
from sqlalchemy import and_, func, not_, or_, select, tuple_
from sqlalchemy.ext.asyncio import AsyncSession
from src.features.historial.models import HistorialCambioModel
from src.features.historial.schemas import (
    CambioCampo,
    ConteoDia,
    ConteoPersona,
    ConteoProyecto,
    EventoActividad,
    ResumenActividad,
)

ACCION_TEXTO = {
    "creado": "fue creado",
    "actualizado": "fue actualizado",
    "completado": "se completó",
    "eliminado": "fue eliminado",
    "restringido": "se restringió",
    "acceso_abierto": "volvió a ser visible para todo el equipo",
    "papelera": "se movió a la papelera",
    "restaurado": "se restauró de la papelera",
    "recibido": "se recibió por un enlace para solicitar archivos",
}

PREFIJO_TIPO = {
    "proyecto": "Proyecto",
    "tarea": "Tarea",
}


async def registrar_cambio(
    db: AsyncSession,
    entidad_tipo: str,
    entidad_id: int,
    entidad_nombre: str,
    accion: str,
    proyecto_id: int | None,
    usuario_id: int | None,
    cambios: str | None = None,
    ruta: str | None = None,
    numero_version: int | None = None,
) -> None:
    """Registra un evento de auditoria sobre cualquier entidad (proyecto, tarea, documento)."""
    db.add(
        HistorialCambioModel(
            entidad_tipo=entidad_tipo,
            entidad_id=entidad_id,
            entidad_nombre=entidad_nombre,
            accion=accion,
            cambios=cambios,
            ruta=ruta,
            numero_version=numero_version,
            proyecto_id=proyecto_id,
            usuario_id=usuario_id,
        )
    )
    await db.commit()


def _texto_evento(cambio: HistorialCambioModel) -> str:
    if cambio.entidad_tipo == "documento":
        # Cambios sin version nueva (renombrar, mover, eliminar) usan el texto de la accion
        if cambio.numero_version is None:
            return f'"{cambio.entidad_nombre}" {ACCION_TEXTO.get(cambio.accion, cambio.accion)}'
        if cambio.numero_version == 1:
            return f'"{cambio.entidad_nombre}" fue creado'
        return f'"{cambio.entidad_nombre}" se actualizó a v{cambio.numero_version}'
    prefijo = PREFIJO_TIPO.get(cambio.entidad_tipo, cambio.entidad_tipo)
    verbo = ACCION_TEXTO.get(cambio.accion, cambio.accion)
    return f'{prefijo} "{cambio.entidad_nombre}" {verbo}'


# Campos que proyectos y tareas guardan en el detalle como «campo: antes → despues; ...»
ETIQUETAS_CAMPO = {
    "nombre": "Nombre",
    "titulo": "Título",
    "descripcion": "Descripción",
    "estado": "Estado",
    "prioridad": "Prioridad",
    "fecha_vencimiento": "Fecha de vencimiento",
    "cliente_id": "Cliente",
    "usuario_asignado_id": "Responsable",
    "columna": "Columna",
}
_SEGMENTO = re.compile(r"^(\w+): (.*)$", re.S)
_FECHA = re.compile(r"^(\d{4}-\d{2}-\d{2})(?: 00:00:00(?:\+00:00)?)?$")


def _separar_cambios(detalle: str | None) -> list[tuple[str, str, str]] | None:
    """«fecha_vencimiento: 2026-09-25 → 2026-11-19; columna: A → B» -> [(campo, antes, despues), ...].

    Un «; » dentro de un valor (p. ej. una descripcion) se une al campo anterior. None si no tiene ese formato.
    """
    if not detalle:
        return None
    partes: list[list[str]] = []
    for segmento in detalle.split("; "):
        m = _SEGMENTO.match(segmento)
        if m and m.group(1) in ETIQUETAS_CAMPO:
            partes.append([m.group(1), m.group(2)])
        elif partes:
            partes[-1][1] += "; " + segmento
        else:
            return None
    # Un «campo:» sin flecha era parte del valor anterior
    unidas: list[list[str]] = []
    for campo, texto in partes:
        if " → " not in texto and unidas:
            unidas[-1][1] += f"; {campo}: {texto}"
        else:
            unidas.append([campo, texto])
    if any(" → " not in texto for _, texto in unidas):
        return None
    return [(campo, *texto.split(" → ", 1)) for campo, texto in unidas]


def _valor(campo: str, valor: str, nombres: dict[str, dict[int, str]]) -> str | None:
    if valor in ("None", ""):
        return None
    if campo in ("cliente_id", "usuario_asignado_id"):
        return nombres[campo].get(int(valor), f"#{valor}") if valor.isdigit() else valor
    if campo in ("estado", "prioridad"):
        return valor.replace("_", " ").capitalize()
    fecha = _FECHA.match(valor)
    return fecha.group(1) if fecha else valor


async def _cambios_legibles(db: AsyncSession, detalles: list[str | None]) -> list[list[CambioCampo] | None]:
    """Separa el detalle de cada evento por campo y cambia los ids de cliente y responsable por sus nombres."""
    from src.features.auth.models import UsuarioModel
    from src.features.clientes.models import ClienteModel

    separados = [_separar_cambios(d) for d in detalles]
    ids: dict[str, set[int]] = {"cliente_id": set(), "usuario_asignado_id": set()}
    for cambios in filter(None, separados):
        for campo, antes, despues in cambios:
            if campo in ids:
                ids[campo].update(int(v) for v in (antes, despues) if v.isdigit())
    nombres: dict[str, dict[int, str]] = {"cliente_id": {}, "usuario_asignado_id": {}}
    if ids["cliente_id"]:
        filas = await db.execute(select(ClienteModel.id, ClienteModel.nombre).where(ClienteModel.id.in_(ids["cliente_id"])))
        nombres["cliente_id"] = dict(filas.all())
    if ids["usuario_asignado_id"]:
        filas = await db.execute(
            select(UsuarioModel.id, UsuarioModel.nombre).where(UsuarioModel.id.in_(ids["usuario_asignado_id"]))
        )
        nombres["usuario_asignado_id"] = dict(filas.all())
    return [
        [
            CambioCampo(campo=c, etiqueta=ETIQUETAS_CAMPO[c], antes=_valor(c, a, nombres), despues=_valor(c, d, nombres))
            for c, a, d in cambios
        ] if cambios else None
        for cambios in separados
    ]


def _filtros(
    *,
    proyecto_id: int | None = None,
    tipo: str | None = None,
    usuario_id: int | None = None,
    desde: datetime | None = None,
    hasta: datetime | None = None,
    documentos_ocultos: set[int] | None = None,
) -> list:
    """Condiciones comunes del listado y del resumen."""
    h = HistorialCambioModel
    condiciones = []
    if proyecto_id is not None:
        condiciones.append(h.proyecto_id == proyecto_id)
    if tipo == "documento":
        # «Archivos» incluye las carpetas
        condiciones.append(h.entidad_tipo.in_(("documento", "carpeta")))
    elif tipo:
        condiciones.append(h.entidad_tipo == tipo)
    if usuario_id is not None:
        condiciones.append(h.usuario_id == usuario_id)
    if desde is not None:
        condiciones.append(h.created_at >= desde)
    if hasta is not None:
        condiciones.append(h.created_at < hasta)
    if documentos_ocultos:
        condiciones.append(not_(and_(h.entidad_tipo == "documento", h.entidad_id.in_(documentos_ocultos))))
    return condiciones


async def obtener_historial_combinado(
    db: AsyncSession,
    proyecto_id: int | None,
    limite: int = 50,
    documentos_ocultos: set[int] | None = None,
    *,
    tipo: str | None = None,
    usuario_id: int | None = None,
    antes_de: int | None = None,
    desde: datetime | None = None,
    hasta: datetime | None = None,
    buscar: str | None = None,
) -> list[EventoActividad]:
    """Devuelve el timeline unificado de proyecto, tareas y documentos; sin proyecto, el de todos.

    Los eventos de documentos_ocultos (restringidos para quien consulta) no se incluyen.
    tipo, usuario_id, el rango [desde, hasta) y buscar (nombre del elemento o del proyecto) filtran;
    antes_de (id de un evento) pagina hacia atras.
    """
    from src.features.auth.models import UsuarioModel
    from src.features.proyectos.models import ProyectoModel

    consulta = (
        select(HistorialCambioModel, UsuarioModel.nombre, UsuarioModel.avatar_url, ProyectoModel.nombre)
        .outerjoin(UsuarioModel, HistorialCambioModel.usuario_id == UsuarioModel.id)
        .outerjoin(ProyectoModel, HistorialCambioModel.proyecto_id == ProyectoModel.id)
        .where(*_filtros(
            proyecto_id=proyecto_id, tipo=tipo, usuario_id=usuario_id, desde=desde, hasta=hasta,
            documentos_ocultos=documentos_ocultos,
        ))
        .order_by(HistorialCambioModel.created_at.desc(), HistorialCambioModel.id.desc())
        .limit(limite)
    )
    if buscar and buscar.strip():
        patron = f"%{buscar.strip()}%"
        consulta = consulta.where(or_(HistorialCambioModel.entidad_nombre.ilike(patron), ProyectoModel.nombre.ilike(patron)))
    if antes_de is not None:
        # Mismo orden que el listado (fecha y luego id): sigue justo despues del ultimo evento mostrado
        fecha = (await db.execute(
            select(HistorialCambioModel.created_at).where(HistorialCambioModel.id == antes_de)
        )).scalar_one_or_none()
        if fecha is not None:
            consulta = consulta.where(
                tuple_(HistorialCambioModel.created_at, HistorialCambioModel.id) < tuple_(fecha, antes_de)
            )
    filas = (await db.execute(consulta)).all()
    cambios = await _cambios_legibles(
        db, [c.cambios if c.entidad_tipo in ("proyecto", "tarea") else None for c, *_ in filas]
    )
    return [
        EventoActividad(
            tipo=cambio.entidad_tipo,
            texto=_texto_evento(cambio),
            detalle=cambio.cambios,
            usuario_nombre=nombre_usuario,
            created_at=cambio.created_at,
            usuario_id=cambio.usuario_id,
            proyecto_id=cambio.proyecto_id,
            proyecto_nombre=nombre_proyecto,
            id=cambio.id,
            entidad_id=cambio.entidad_id,
            accion=cambio.accion,
            usuario_avatar_url=avatar,
            entidad_nombre=cambio.entidad_nombre,
            numero_version=cambio.numero_version,
            cambios=campos,
        )
        for (cambio, nombre_usuario, avatar, nombre_proyecto), campos in zip(filas, cambios)
    ]


async def resumen_actividad(
    db: AsyncSession,
    documentos_ocultos: set[int] | None = None,
    *,
    zona: str = "UTC",
    tipo: str | None = None,
    usuario_id: int | None = None,
    proyecto_id: int | None = None,
    solo_mias: bool = False,
) -> ResumenActividad:
    """Los ultimos 7 dias por dia (en la zona horaria de quien consulta) y por accion, y en los ultimos 30 dias
    quienes y en que proyectos hubo mas movimiento. Cada lista ignora su propio filtro para servir de selector,
    salvo solo_mias: entonces usuario_id es quien consulta y nada cuenta a los demas."""
    from src.features.auth.models import UsuarioModel
    from src.features.proyectos.models import ProyectoModel

    try:
        tz = ZoneInfo(zona)
    except (ZoneInfoNotFoundError, ValueError):
        zona, tz = "UTC", ZoneInfo("UTC")
    hoy = datetime.now(tz).replace(hour=0, minute=0, second=0, microsecond=0)
    hace_7, hace_30 = hoy - timedelta(days=6), hoy - timedelta(days=29)
    h = HistorialCambioModel
    comunes = dict(tipo=tipo, documentos_ocultos=documentos_ocultos)

    dia = func.date(func.timezone(zona, h.created_at))
    filas = await db.execute(
        select(dia, func.count()).where(*_filtros(
            desde=hace_7, usuario_id=usuario_id, proyecto_id=proyecto_id, **comunes
        )).group_by(dia)
    )
    por_dia = {str(f): n for f, n in filas.all()}
    dias = [
        ConteoDia(fecha=(fecha := (hace_7 + timedelta(days=i)).date().isoformat()), total=por_dia.get(fecha, 0))
        for i in range(7)
    ]

    filas = await db.execute(
        select(h.accion, func.count()).where(*_filtros(
            desde=hace_7, usuario_id=usuario_id, proyecto_id=proyecto_id, **comunes
        )).group_by(h.accion)
    )
    por_accion = dict(filas.all())

    total = func.count().label("total")
    filas = await db.execute(
        select(h.usuario_id, UsuarioModel.nombre, UsuarioModel.avatar_url, total)
        .join(UsuarioModel, h.usuario_id == UsuarioModel.id)
        .where(*_filtros(
            desde=hace_30, usuario_id=usuario_id if solo_mias else None, proyecto_id=proyecto_id, **comunes
        ))
        .group_by(h.usuario_id, UsuarioModel.nombre, UsuarioModel.avatar_url)
        .order_by(total.desc())
        .limit(8)
    )
    personas = [ConteoPersona(usuario_id=u, nombre=n, avatar_url=a, total=t) for u, n, a, t in filas.all()]

    # Los espacios de archivos (personal / equipo) no son proyectos
    filas = await db.execute(
        select(h.proyecto_id, ProyectoModel.nombre, total)
        .join(ProyectoModel, h.proyecto_id == ProyectoModel.id)
        .where(ProyectoModel.tipo == "proyecto", *_filtros(desde=hace_30, usuario_id=usuario_id, **comunes))
        .group_by(h.proyecto_id, ProyectoModel.nombre)
        .order_by(total.desc())
        .limit(8)
    )
    proyectos = [ConteoProyecto(proyecto_id=p, nombre=n, total=t) for p, n, t in filas.all()]

    return ResumenActividad(dias=dias, por_accion=por_accion, personas=personas, proyectos=proyectos)
