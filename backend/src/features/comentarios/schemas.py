from datetime import datetime

from msgspec import Struct


class ComentarioTexto(Struct):
    # Las menciones van como @[Nombre](usuario_id)
    texto: str


class Comentario(Struct):
    id: int
    documento_id: int
    usuario_id: int | None
    autor: str | None
    autor_avatar_url: str | None
    texto: str
    created_at: datetime
    editado_at: datetime | None
