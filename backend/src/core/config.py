import os
from pathlib import Path
from dotenv import load_dotenv

# Ruta absoluta al .env en la raíz del backend
BASE_DIR = Path(__file__).resolve().parent.parent.parent
load_dotenv(BASE_DIR / ".env")


class Settings:
    DATABASE_URL: str = os.getenv("DATABASE_URL")
    JWT_SECRET: str = os.getenv("JWT_SECRET", "cambiar_esta_clave_en_produccion")
    JWT_EXPIRATION_MINUTES: int = int(os.getenv("JWT_EXPIRATION_MINUTES", 30))

    def validar(self) -> None:
        faltantes = [
            nombre for nombre in ("DATABASE_URL", "JWT_SECRET")
            if not getattr(self, nombre)
        ]
        if faltantes:
            raise RuntimeError(
                f"Faltan variables de entorno: {', '.join(faltantes)}. "
                f"Verifica que exista {BASE_DIR / '.env'}"
            )


settings = Settings()
settings.validar()