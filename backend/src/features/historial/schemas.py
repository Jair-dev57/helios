from datetime import datetime
from msgspec import Struct


class CambioCampo(Struct):
    """Un campo editado, listo para mostrar: «Fecha de vencimiento: 25 sep → 19 nov»."""
    campo: str
    etiqueta: str
    antes: str | None
    despues: str | None


class EventoActividad(Struct):
    tipo: str  # 'proyecto' | 'tarea' | 'documento'
    texto: str
    detalle: str | None
    usuario_nombre: str | None
    created_at: datetime
    usuario_id: int | None = None
    proyecto_id: int | None = None
    proyecto_nombre: str | None = None
    # Para la pagina Actividad: enlazar al elemento, paginar y mostrar la foto de quien lo hizo
    id: int | None = None
    entidad_id: int | None = None
    accion: str | None = None
    usuario_avatar_url: str | None = None
    # Para las tarjetas del Inicio: «Tú modificaste Propuesta.docx» (version 1 = se subio)
    entidad_nombre: str | None = None
    numero_version: int | None = None
    # Pagina Actividad: el detalle de proyectos y tareas separado por campo (ids ya convertidos a nombres)
    cambios: list[CambioCampo] | None = None


class ConteoDia(Struct):
    fecha: str  # AAAA-MM-DD en la zona horaria de quien consulta
    total: int


class ConteoPersona(Struct):
    usuario_id: int
    nombre: str
    total: int
    avatar_url: str | None = None


class ConteoProyecto(Struct):
    proyecto_id: int
    nombre: str
    total: int


class ResumenActividad(Struct):
    """Columna lateral de la pagina Actividad: la semana por dia y por accion, y quien y donde en el ultimo mes."""
    dias: list[ConteoDia]
    por_accion: dict[str, int]
    personas: list[ConteoPersona]
    proyectos: list[ConteoProyecto]
