from datetime import datetime

from msgspec import Struct


class Notificacion(Struct):
    id: int
    tipo: str
    texto: str
    documento_id: int | None
    proyecto_id: int | None
    actor: str | None
    actor_avatar_url: str | None
    leida: bool
    created_at: datetime


class Notificaciones(Struct):
    no_leidas: int
    notificaciones: list[Notificacion]
