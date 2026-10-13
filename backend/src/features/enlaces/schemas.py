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


class EnlaceVigente(Struct):
    documento_id: int | None
    carpeta_id: int | None
    permiso: Permiso
    expira_at: datetime | None
    accesos: int


class Compartidos(Struct):
    """Documentos restringidos compartidos con el usuario y enlaces publicos vigentes de un proyecto."""
    conmigo: list[int]
    enlaces: list[EnlaceVigente]


class ObjetoCompartido(Struct):
    """Documento o carpeta compartida, con el proyecto o espacio donde esta."""
    tipo: Literal["documento", "carpeta"]
    id: int
    nombre: str
    extension: str | None
    color: str | None
    carpeta_id: int | None
    updated_at: datetime
    proyecto_id: int
    proyecto_nombre: str
    proyecto_tipo: str


class EnlaceGlobal(Struct):
    id: int
    token: str
    permiso: Permiso
    tiene_contrasena: bool
    expira_at: datetime | None
    vigente: bool
    created_at: datetime
    creado_por: str | None
    creado_por_mi: bool
    accesos: int
    ultimo_acceso_at: datetime | None
    # Enlaces para solicitar archivos: cuantos llegaron desde que se creo y cuantos en los ultimos 7 dias
    recibidos: int
    recibidos_semana: int
    objeto: ObjetoCompartido


class CompartidosGlobal(Struct):
    conmigo: list[ObjetoCompartido]
    enlaces: list[EnlaceGlobal]


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
