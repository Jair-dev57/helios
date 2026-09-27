import uuid
from pathlib import Path

from litestar.datastructures import UploadFile
from litestar.exceptions import ValidationException

from src.core.config import BASE_DIR

EXTENSIONES_IMAGEN = {".png", ".jpg", ".jpeg", ".webp"}
TAMANO_MAX_IMAGEN = 2 * 1024 * 1024  # 2 MB


async def guardar_imagen(archivo: UploadFile, subcarpeta: str) -> str:
    """Guarda una imagen en publico/<subcarpeta> y devuelve su ruta ('/publico/...').

    Va aparte de /uploads porque los documentos requieren token, mientras que el logo y
    los avatares se muestran con <img> (incluso en el login, sin sesion).
    """
    extension = Path(archivo.filename or "").suffix.lower()
    if extension not in EXTENSIONES_IMAGEN:
        raise ValidationException(detail="Formato de imagen no permitido (usa PNG, JPG o WEBP)")
    contenido = await archivo.read()
    if len(contenido) > TAMANO_MAX_IMAGEN:
        raise ValidationException(detail="La imagen no puede superar 2 MB")

    carpeta = BASE_DIR / "publico" / subcarpeta
    carpeta.mkdir(parents=True, exist_ok=True)
    nombre_archivo = f"{uuid.uuid4()}{extension}"
    (carpeta / nombre_archivo).write_bytes(contenido)
    return f"/publico/{subcarpeta}/{nombre_archivo}"


def eliminar_archivo(ruta_publica: str | None) -> None:
    """Borra del disco un archivo guardado con guardar_imagen (si existe)."""
    if not ruta_publica or not ruta_publica.startswith("/publico/"):
        return
    ruta = BASE_DIR / ruta_publica.lstrip("/")
    ruta.unlink(missing_ok=True)
