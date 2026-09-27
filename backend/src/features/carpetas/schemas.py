from typing import Annotated

import msgspec

# Color en hexadecimal (#rrggbb); si no se envia, la base de datos pone amarillo
ColorHex = Annotated[str, msgspec.Meta(pattern=r"^#[0-9a-fA-F]{6}$")]


class CarpetaCrear(msgspec.Struct):
    nombre: str
    proyecto_id: int
    carpeta_padre_id: int | None = None
    color: ColorHex | None = None


class CarpetaActualizar(msgspec.Struct):
    nombre: str | None = None
    carpeta_padre_id: int | None = None
    color: ColorHex | None = None


class CarpetaRespuesta(msgspec.Struct):
    id: int
    nombre: str
    proyecto_id: int
    color: str
    carpeta_padre_id: int | None = None