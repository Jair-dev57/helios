from datetime import datetime
from msgspec import Struct


class RolCrear(Struct):
    nombre: str
    es_administrador: bool = False


class RolActualizar(Struct):
    nombre: str | None = None
    es_administrador: bool | None = None


class RolRespuesta(Struct):
    id: int
    nombre: str
    es_administrador: bool
    created_at: datetime


class SeccionesActualizar(Struct):
    secciones: list[str]


class SeccionesRespuesta(Struct):
    rol_id: int
    secciones: list[str]
