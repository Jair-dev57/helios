from datetime import datetime
from msgspec import Struct


class EventoActividad(Struct):
    tipo: str  # 'proyecto' | 'tarea' | 'documento'
    texto: str
    detalle: str | None
    usuario_nombre: str | None
    created_at: datetime
