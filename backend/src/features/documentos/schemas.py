from datetime import datetime
from msgspec import Struct
from litestar.datastructures import UploadFile


class DocumentoCrear(Struct):
    nombre: str
    ruta: str
    proyecto_id: int
    tipo: str | None = None
    usuario_id: int | None = None
    carpeta_id: int | None = None


class DocumentoActualizar(Struct):
    nombre: str | None = None
    tipo: str | None = None
    ruta: str | None = None
    carpeta_id: int | None = None


class DocumentoRespuesta(Struct):
    id: int
    nombre: str
    ruta: str
    version_actual: int
    proyecto_id: int
    tipo: str | None
    usuario_id: int | None
    carpeta_id: int | None
    created_at: datetime
    updated_at: datetime


class DocumentoVersionRespuesta(Struct):
    id: int
    numero_version: int
    ruta: str
    documento_id: int
    notas: str | None
    usuario_id: int | None
    created_at: datetime


class DocumentoSubida(Struct):
    archivo: UploadFile
    nombre: str
    proyecto_id: int
    carpeta_id: int | None = None


class DocumentoVersionSubida(Struct):
    archivo: UploadFile
    nombre: str | None = None
    tipo: str | None = None