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
