from datetime import datetime
from msgspec import Struct


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
