from datetime import datetime
from typing import Annotated, Literal

from msgspec import UNSET, Meta, Struct, UnsetType

# Color del proyecto en #rrggbb (el menu de Archivos lo muestra junto a su nombre)
Color = Annotated[str, Meta(pattern=r"^#[0-9a-fA-F]{6}$")]
# Quien ve el proyecto: todo el equipo, los miembros de su area, personas elegidas (miembro_ids) o solo quien lo creo
Acceso = Literal["todos", "equipo", "personas", "solo"]


class ProyectoCrear(Struct):
    nombre: str
    descripcion: str | None = None
    estado: str = "activo"
    fecha_vencimiento: datetime | None = None
    cliente_id: int | None = None
    usuario_id: int | None = None
    color: Color | None = None
    area_id: int | None = None
    acceso: Acceso = "todos"
    miembro_ids: list[int] = []

class ProyectoActualizar(Struct):
    nombre: str | None = None
    descripcion: str | None = None
    estado: str | None = None
    fecha_vencimiento: datetime | None = None
    cliente_id: int | None = None
    usuario_id: int | None = None
    color: Color | None = None
    # Sin enviar: no cambia; null: quita el area
    area_id: int | None | UnsetType = UNSET
    acceso: Acceso | None = None
    miembro_ids: list[int] | None = None

class ProyectoRespuesta(Struct):
    id: int
    nombre: str
    descripcion: str | None
    estado: str
    fecha_vencimiento: datetime | None
    cliente_id: int | None
    usuario_id: int | None
    created_at: datetime
    updated_at: datetime
    tipo: str = "proyecto"
    color: str | None = None
    area_id: int | None = None
    acceso: str = "todos"
    miembro_ids: list[int] = []

class Asignable(Struct):
    """Persona a la que se le pueden asignar tareas de un proyecto (puede verlo)."""
    id: int
    nombre: str
    avatar_url: str | None = None
