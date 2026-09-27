from __future__ import annotations
from datetime import datetime
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import String, DateTime, func
from src.core.db import Base


class EmpresaModel(Base):
    """Datos de la empresa que usa la plataforma. Siempre hay una sola fila."""

    __tablename__ = "empresa"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    nombre: Mapped[str] = mapped_column(String(150), default="Mi empresa")
    logo_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    nit: Mapped[str | None] = mapped_column(String(50), nullable=True)
    direccion: Mapped[str | None] = mapped_column(String(255), nullable=True)
    telefono: Mapped[str | None] = mapped_column(String(30), nullable=True)
    email_contacto: Mapped[str | None] = mapped_column(String(150), nullable=True)
    sitio_web: Mapped[str | None] = mapped_column(String(255), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
