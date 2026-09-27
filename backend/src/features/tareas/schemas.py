from datetime import datetime
import msgspec


class TareaCrear(msgspec.Struct):
    titulo: str
    proyecto_id: int
    columna_id: int | None = None  # Sin columna va a la primera del proyecto
    descripcion: str | None = None
    prioridad: str = "media"
    orden: int = 0
    fecha_vencimiento: datetime | None = None
    usuario_asignado_id: int | None = None


class TareaActualizar(msgspec.Struct):
    titulo: str | None = None
    descripcion: str | None = None
    columna_id: int | None = None
    prioridad: str | None = None
    orden: int | None = None
    fecha_vencimiento: datetime | None = None
    usuario_asignado_id: int | None = None


class TareaRespuesta(msgspec.Struct):
    id: int
    titulo: str
    columna_id: int
    prioridad: str
    orden: int
    proyecto_id: int
    descripcion: str | None = None
    fecha_vencimiento: datetime | None = None
    usuario_asignado_id: int | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None
    documentos_count: int = 0
    terminada: bool = False


class TareasOrden(msgspec.Struct):
    """Orden completo de una columna tras arrastrar una tarea."""
    columna_id: int
    tarea_ids: list[int]


class TareaDocumentoAgregar(msgspec.Struct):
    documento_id: int


class DocumentoDeTarea(msgspec.Struct):
    documento_id: int
    nombre: str
    tipo: str | None
    version_actual: int


class ColumnaCrear(msgspec.Struct):
    proyecto_id: int
    nombre: str
    color: str = "#9096A8"


class ColumnaActualizar(msgspec.Struct):
    nombre: str | None = None
    color: str | None = None
    es_final: bool | None = None


class ColumnasOrden(msgspec.Struct):
    proyecto_id: int
    columna_ids: list[int]


class ColumnaRespuesta(msgspec.Struct):
    id: int
    proyecto_id: int
    nombre: str
    color: str
    orden: int
    es_final: bool
