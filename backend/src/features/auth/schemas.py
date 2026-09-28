from datetime import datetime
from litestar.datastructures import UploadFile
from msgspec import Struct

class UsuarioCrear(Struct):
    nombre: str
    email: str
    password: str
    rol: str = "colaborador"
    username: str | None = None
    telefono: str | None = None
    cargo: str | None = None

class UsuarioActualizar(Struct):
    """Edicion de un usuario por parte del administrador (password = restablecer contraseña)."""
    nombre: str | None = None
    email: str | None = None
    rol: str | None = None
    activo: bool | None = None
    username: str | None = None
    telefono: str | None = None
    cargo: str | None = None
    password: str | None = None

class PerfilActualizar(Struct):
    """Lo que cada usuario puede cambiar de su propio perfil."""
    nombre: str | None = None
    username: str | None = None
    telefono: str | None = None
    cargo: str | None = None

class CambioPassword(Struct):
    password_actual: str
    password_nueva: str

class ImagenSubida(Struct):
    archivo: UploadFile

class UsuarioRespuesta(Struct):
    id: int
    nombre: str
    email: str
    rol: str
    activo: bool
    created_at: datetime
    updated_at: datetime
    username: str | None = None
    avatar_url: str | None = None
    telefono: str | None = None
    cargo: str | None = None

class MiUsuarioRespuesta(UsuarioRespuesta):
    """El usuario autenticado, con lo que el frontend necesita saber de su rol."""
    es_administrador: bool = False

class LoginRequest(Struct):
    usuario: str  # email o nombre de usuario
    password: str

class LoginRespuesta(Struct):
    acceso: bool
    mensaje: str
    usuario_id: int | None = None
    nombre: str | None = None
    email: str | None = None
    rol: str | None = None
    username: str | None = None
    avatar_url: str | None = None
    es_administrador: bool = False
    access_token: str | None = None
