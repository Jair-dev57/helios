from __future__ import annotations
from datetime import datetime
from typing import TYPE_CHECKING
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy import String, Boolean, DateTime, func
from src.core.db import Base

if TYPE_CHECKING:
    from src.features.proyectos.models import ProyectoModel
    from src.features.documentos.models import DocumentoModel

class UsuarioModel(Base):
    __tablename__ = "usuarios"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    nombre: Mapped[str] = mapped_column(String(100))
    email: Mapped[str] = mapped_column(String(150), unique=True)
    username: Mapped[str | None] = mapped_column(String(30), unique=True, nullable=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    activo: Mapped[bool] = mapped_column(Boolean, default=True)
    # Acceso total, sin importar sus equipos (los permisos vienen del Acceso basico y de sus equipos)
    es_administrador: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    avatar_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    telefono: Mapped[str | None] = mapped_column(String(30), nullable=True)
    cargo: Mapped[str | None] = mapped_column(String(100), nullable=True)
    ultimo_acceso: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    proyectos: Mapped[list[ProyectoModel]] = relationship(back_populates="usuario", foreign_keys="ProyectoModel.usuario_id")
    documentos: Mapped[list[DocumentoModel]] = relationship(back_populates="usuario", foreign_keys="DocumentoModel.usuario_id")