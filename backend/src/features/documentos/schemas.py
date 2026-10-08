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
    hash: str | None = None


class DocumentoActualizar(Struct):
    nombre: str | None = None
    tipo: str | None = None
    ruta: str | None = None
    carpeta_id: int | None = None
    hash: str | None = None


class DocumentoRespuesta(Struct):
    id: int
    nombre: str
    ruta: str
    version_actual: int
    restringido: bool
    proyecto_id: int
    tipo: str | None
    usuario_id: int | None
    carpeta_id: int | None
    hash: str | None
    created_at: datetime
    updated_at: datetime
    # Datos calculados para el listado: quien subio la ultima version y peso del archivo en bytes
    modificado_por: str | None = None
    tamano: int | None = None


class DocumentoAcceso(Struct):
    """Visibilidad de un documento: restringido solo lo ven los administradores y usuario_ids."""
    restringido: bool
    usuario_ids: list[int] = []


class DocumentoSubida(Struct):
    archivo: UploadFile
    nombre: str
    proyecto_id: int
    carpeta_id: int


class DocumentoVersionSubida(Struct):
    archivo: UploadFile
    nombre: str | None = None
    tipo: str | None = None
    notas: str | None = None


class ResultadoContenido(Struct):
    """Documento cuyo contenido coincide con la busqueda, con el pasaje donde se encontro."""
    documento_id: int
    fragmento: str
    similitud: float
    # "exacta" (el texto aparece tal cual) o "semantica" (coincide por significado)
    coincidencia: str
