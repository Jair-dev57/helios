import msgspec

class ProyectoCreate(msgspec.Struct):
    nombre: str
    estado: str

class ProyectoResponse(msgspec.Struct):
    id: int
    nombre: str
    estado: str
    