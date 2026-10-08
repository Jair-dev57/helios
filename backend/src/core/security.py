from dataclasses import dataclass
from datetime import timedelta
from typing import Optional
from litestar.connection import ASGIConnection
from litestar.security.jwt import JWTAuth, Token
from passlib.context import CryptContext
from src.core.config import settings


@dataclass
class UsuarioToken(Token):
    email: Optional[str] = None
    rol: Optional[str] = None
    nombre: Optional[str] = None


async def retrieve_user_handler(token: UsuarioToken, connection: ASGIConnection):
    if not token.sub:
        return None
    extras = token.extras or {}
    return {
        "id": int(token.sub),
        "email": extras.get("email"),
        "rol": extras.get("rol"),
        "nombre": extras.get("nombre"),
    }


pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


jwt_auth = JWTAuth[dict](
    token_secret=settings.JWT_SECRET,
    default_token_expiration=timedelta(minutes=settings.JWT_EXPIRATION_MINUTES),
    auth_header="Authorization",
    retrieve_user_handler=retrieve_user_handler,
    token_cls=UsuarioToken,
    # /compartido: paginas de los enlaces publicos (comprueban su propio token y contrasena)
    exclude=["/auth/login", "/empresa/publica", "/publico", "/compartido/", "/schema"],
)
