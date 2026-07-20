from datetime import datetime
import msgspec


class TareaCrear(msgspec.Struct):
    titulo: str
    proyecto_id: int
    descripcion: str | None = None
    estado: str = "por_hacer"
    prioridad: str = "media"
    orden: int = 0
    fecha_vencimiento: datetime | None = None
    usuario_asignado_id: int | None = None


class TareaActualizar(msgspec.Struct):
    titulo: str | None = None
    descripcion: str | None = None
    estado: str | None = None
    prioridad: str | None = None
    orden: int | None = None
    fecha_vencimiento: datetime | None = None
    usuario_asignado_id: int | None = None


class TareaRespuesta(msgspec.Struct):
    id: int
    titulo: str
    estado: str
    prioridad: str
    orden: int
    proyecto_id: int
    descripcion: str | None = None
    fecha_vencimiento: datetime | None = None
    usuario_asignado_id: int | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None
    documentos_count: int = 0

class TareaDocumentoAgregar(msgspec.Struct):
    documento_id: int


class DocumentoDeTarea(msgspec.Struct):
    documento_id: int
    nombre: str
    tipo: str | None
    version_actual: int