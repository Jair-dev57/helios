from datetime import datetime
from typing import Literal

from msgspec import Struct


class Espacio(Struct):
    id: int
    nombre: str
    tipo: Literal["personal", "equipo"]
    descripcion: str | None
    color: str | None
    # Equipo: abierto a todos o solo para miembro_ids
    abierto: bool
    miembro_ids: list[int]
    archivos: int
    ultima_modificacion: datetime | None
    # Equipo: secciones que suma a sus miembros, ademas del Acceso basico
    secciones: list[str] = []


class Espacios(Struct):
    personal: Espacio
    equipo: list[Espacio]


class EspacioCrear(Struct):
    nombre: str
    descripcion: str | None = None
    color: str | None = None
    abierto: bool = False
    miembro_ids: list[int] = []
    secciones: list[str] = []


class EspacioActualizar(Struct):
    nombre: str | None = None
    descripcion: str | None = None
    color: str | None = None
    abierto: bool | None = None
    miembro_ids: list[int] | None = None
    secciones: list[str] | None = None


class AccesoBasico(Struct):
    """Secciones que tiene cualquier persona, aunque no este en ningun equipo."""
    secciones: list[str]
