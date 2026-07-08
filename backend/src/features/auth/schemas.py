from datetime import datetime
from msgspec import Struct

class UsuarioCrear(Struct):
    nombre: str
    email: str
    password: str
    rol: str = "colaborador"

class UsuarioActualizar(Struct):
    nombre: str | None = None
    email: str | None = None
    rol: str | None = None
    activo: bool | None = None

class UsuarioRespuesta(Struct):
    id: int
    nombre: str
    email: str
    rol: str
    activo: bool
    created_at: datetime
    updated_at: datetime

class LoginRequest(Struct):
    email: str
    password: str

class LoginRespuesta(Struct):
    acceso: bool
    mensaje: str
    usuario_id: int | None = None
    nombre: str | None = None
    email: str | None = None
    rol: str | None = None
    access_token: str | None = None