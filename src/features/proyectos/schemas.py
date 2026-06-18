from datetime import datetime
from msgspec import Struct


class ProyectoCrear(Struct):
    nombre: str
    descripcion: str | None = None
    estado: str = "activo"
    fecha_vencimiento: datetime | None = None
    cliente_id: int | None = None
    usuario_id: int | None = None

class ProyectoActualizar(Struct):
    nombre: str | None = None
    descripcion: str | None = None
    estado: str | None = None
    fecha_vencimiento: datetime | None = None
    cliente_id: int | None = None
    usuario_id: int | None = None

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