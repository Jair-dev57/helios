from datetime import datetime
from typing import Literal

from msgspec import Struct

TipoElemento = Literal["carpeta", "documento"]


class ElementoPapelera(Struct):
    """Algo borrado: un documento o una carpeta con todo lo que tenia dentro."""
    tipo: TipoElemento
    id: int
    nombre: str
    # Extension del documento (las carpetas no tienen)
    extension: str | None
    # Color de la carpeta (los documentos no tienen)
    color: str | None
    # Carpeta donde estaba, ej: "Ingenieria / Planos"
    ubicacion: str
    eliminado_at: datetime
    # Cuando se eliminara definitivamente si nadie lo restaura
    expira_at: datetime
    eliminado_por: str | None
    archivos: int
    tamano: int | None
    restringido: bool


class Restaurado(Struct):
    # Carpeta donde quedo lo restaurado (la propia carpeta si se restauro una carpeta), para abrirla
    carpeta_id: int | None


class PapeleraVaciada(Struct):
    elementos: int
