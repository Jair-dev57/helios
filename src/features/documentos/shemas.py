from datetime import datetime
from msgspec import Struct

class DocumentoCrear(Struct):
    nombre: str
    tipo: str | None = None
    ruta: str
    proyecto_id: int
    usuario_id: int | None = None

class DocumentoActualizar(Struct):
    nombre: str | None = None
    tipo: str | None = None
    ruta: str | None = None

class DocumentoRespuesta(Struct):
    id: int
    nombre: str
    tipo: str | None
    ruta: str
    version_actual: int
    proyecto_id: int
    usuario_id: int | None
    created_at: datetime
    updated_at: datetime

class DocumentoVersionRespuesta(Struct):
    id: int
    numero_version: int
    ruta: str
    notas: str | None
    documento_id: int
    usuario_id: int | None
    created_at: datetime