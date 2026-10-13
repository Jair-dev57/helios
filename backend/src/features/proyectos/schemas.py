from datetime import datetime
from typing import Annotated

from msgspec import Meta, Struct

# Color del proyecto en #rrggbb (el menu de Archivos lo muestra junto a su nombre)
Color = Annotated[str, Meta(pattern=r"^#[0-9a-fA-F]{6}$")]


class ProyectoCrear(Struct):
    nombre: str
    descripcion: str | None = None
    estado: str = "activo"
    fecha_vencimiento: datetime | None = None
    cliente_id: int | None = None
    usuario_id: int | None = None
    color: Color | None = None

class ProyectoActualizar(Struct):
    nombre: str | None = None
    descripcion: str | None = None
    estado: str | None = None
    fecha_vencimiento: datetime | None = None
    cliente_id: int | None = None
    usuario_id: int | None = None
    color: Color | None = None

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