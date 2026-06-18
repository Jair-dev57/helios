from __future__ import annotations
from datetime import datetime
from typing import TYPE_CHECKING
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy import String, ForeignKey, DateTime, func
from src.core.db import Base

if TYPE_CHECKING:
    from src.features.clientes.models import ClienteModel
    from src.features.auth.models import UsuarioModel
    from src.features.documentos.models import DocumentoModel

class ProyectoModel(Base):
    __tablename__ = "proyectos"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    nombre: Mapped[str] = mapped_column(String(200))
    descripcion: Mapped[str] = mapped_column(String(500), nullable=True)
    estado: Mapped[str] = mapped_column(String(50), default="activo")
    fecha_vencimiento: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    cliente_id: Mapped[int] = mapped_column(ForeignKey("clientes.id"), nullable=True)
    usuario_id: Mapped[int] = mapped_column(ForeignKey("usuarios.id"), nullable=True)

    cliente: Mapped[ClienteModel] = relationship(back_populates="proyectos")
    usuario: Mapped[UsuarioModel] = relationship(back_populates="proyectos")
    documentos: Mapped[list[DocumentoModel]] = relationship(back_populates="proyecto")