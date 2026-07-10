import msgspec


class CarpetaCrear(msgspec.Struct):
    nombre: str
    proyecto_id: int
    carpeta_padre_id: int | None = None


class CarpetaActualizar(msgspec.Struct):
    nombre: str | None = None
    carpeta_padre_id: int | None = None


class CarpetaRespuesta(msgspec.Struct):
    id: int
    nombre: str
    proyecto_id: int
    carpeta_padre_id: int | None = None