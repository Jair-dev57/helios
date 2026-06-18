from __future__ import annotations
from datetime import datetime
from typing import TYPE_CHECKING
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy import String, ForeignKey, Integer, Text, DateTime, func
from src.core.db import Base

if TYPE_CHECKING:
    from src.features.proyectos.models import ProyectoModel
    from src.features.auth.models import UsuarioModel

class DocumentoModel(Base):
    __tablename__ = "documentos"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    nombre: Mapped[str] = mapped_column(String(255))
    tipo: Mapped[str] = mapped_column(String(50), nullable=True)
    ruta: Mapped[str] = mapped_column(String(500))
    version_actual: Mapped[int] = mapped_column(Integer, default=1)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    proyecto_id: Mapped[int] = mapped_column(ForeignKey("proyectos.id"))
    usuario_id: Mapped[int] = mapped_column(ForeignKey("usuarios.id"), nullable=True)

    proyecto: Mapped[ProyectoModel] = relationship(back_populates="documentos")
    usuario: Mapped[UsuarioModel] = relationship(back_populates="documentos")
    versiones: Mapped[list[DocumentoVersionModel]] = relationship(back_populates="documento")


class DocumentoVersionModel(Base):
    __tablename__ = "documento_versiones"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    numero_version: Mapped[int] = mapped_column(Integer)
    ruta: Mapped[str] = mapped_column(String(500))
    notas: Mapped[str] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    documento_id: Mapped[int] = mapped_column(ForeignKey("documentos.id"))
    usuario_id: Mapped[int] = mapped_column(ForeignKey("usuarios.id"), nullable=True)

    documento: Mapped[DocumentoModel] = relationship(back_populates="versiones")