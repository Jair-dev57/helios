from datetime import datetime
from typing import Literal

from litestar.datastructures import UploadFile
from msgspec import Struct

Permiso = Literal["ver", "subir"]


class EnlaceCrear(Struct):
    """Un enlace comparte un documento o una carpeta (solo uno de los dos). "subir" solo vale para carpetas."""
    documento_id: int | None = None
    carpeta_id: int | None = None
    permiso: Permiso = "ver"
    contrasena: str | None = None
    expira_at: datetime | None = None


class EnlaceRespuesta(Struct):
    id: int
    token: str
    permiso: Permiso
    documento_id: int | None
    carpeta_id: int | None
    tiene_contrasena: bool
    expira_at: datetime | None
    created_at: datetime
    creado_por: str | None
    accesos: int
    ultimo_acceso_at: datetime | None


class DocumentoPublico(Struct):
    id: int
    nombre: str
    tipo: str | None
    tamano: int | None
    carpeta_id: int | None
    updated_at: datetime


class CarpetaPublica(Struct):
    id: int
    nombre: str
    carpeta_padre_id: int | None


class EnlacePublico(Struct):
    """Lo que ve quien abre el enlace. Con contrasena pendiente solo se sabe que hay que pedirla."""
    permiso: Permiso
    tipo: Literal["documento", "carpeta"]
    requiere_contrasena: bool
    expira_at: datetime | None
    nombre: str | None = None
    # Carpeta compartida (raiz de la navegacion)
    carpeta_id: int | None = None
    documento: DocumentoPublico | None = None
    carpetas: list[CarpetaPublica] = []
    documentos: list[DocumentoPublico] = []


class EnvioArchivo(Struct):
    archivo: UploadFile
    remitente: str | None = None


class ArchivoRecibido(Struct):
    nombre: str
