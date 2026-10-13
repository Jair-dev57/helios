from datetime import date
from typing import Literal

from msgspec import Struct


class EventoCalendario(Struct):
    """Algo con fecha: una tarea que vence o la entrega de un proyecto."""
    tipo: Literal["tarea", "entrega"]
    id: int
    titulo: str
    fecha: date
    proyecto_id: int
    proyecto_nombre: str
    # Tarea: si ya esta en una columna final, su prioridad y a quien esta asignada
    terminada: bool = False
    prioridad: str | None = None
    asignado: str | None = None
    asignado_a_mi: bool = False
    # Entrega: estado del proyecto (activo, pausado, completado, cancelado)
    estado: str | None = None
