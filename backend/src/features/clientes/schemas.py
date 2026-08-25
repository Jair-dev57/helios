from datetime import datetime
from msgspec import Struct


class ClienteCrear(Struct):
    nombre: str
    email: str | None = None
    telefono: str | None = None
    empresa: str | None = None


class ClienteActualizar(Struct):
    nombre: str | None = None
    email: str | None = None
    telefono: str | None = None
    empresa: str | None = None
    activo: bool | None = None


class ClienteRespuesta(Struct):
    id: int
    nombre: str
    email: str | None
    telefono: str | None
    empresa: str | None
    activo: bool
    created_at: datetime
    updated_at: datetime
