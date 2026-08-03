import msgspec


class ResultadoBusqueda(msgspec.Struct):
    entidad_tipo: str
    entidad_id: int
    titulo: str
    subtitulo: str | None
    similitud: float
    proyecto_id: int | None = None


class RespuestaBusqueda(msgspec.Struct):
    proyectos: list[ResultadoBusqueda]
    tareas: list[ResultadoBusqueda]
    documentos: list[ResultadoBusqueda]
    clientes: list[ResultadoBusqueda]
