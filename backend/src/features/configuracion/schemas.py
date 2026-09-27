from datetime import datetime
from litestar.datastructures import UploadFile
from msgspec import Struct


class EmpresaActualizar(Struct):
    nombre: str | None = None
    nit: str | None = None
    direccion: str | None = None
    telefono: str | None = None
    email_contacto: str | None = None
    sitio_web: str | None = None


class EmpresaRespuesta(Struct):
    id: int
    nombre: str
    logo_url: str | None
    nit: str | None
    direccion: str | None
    telefono: str | None
    email_contacto: str | None
    sitio_web: str | None
    updated_at: datetime


class EmpresaPublica(Struct):
    """Lo minimo para mostrar la marca en el login, sin autenticacion."""
    nombre: str
    logo_url: str | None


class ImagenSubida(Struct):
    archivo: UploadFile
