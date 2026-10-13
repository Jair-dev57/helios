from __future__ import annotations
from datetime import datetime
from typing import TYPE_CHECKING
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy import Boolean, String, ForeignKey, DateTime, func
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
    # 'proyecto', o un espacio de archivos: 'personal' (de propietario_id) o 'equipo' (miembros o abierto a todos)
    tipo: Mapped[str] = mapped_column(String(20), default="proyecto", server_default="proyecto", index=True)
    propietario_id: Mapped[int | None] = mapped_column(ForeignKey("usuarios.id", ondelete="CASCADE"), nullable=True)
    color: Mapped[str | None] = mapped_column(String(7), nullable=True)
    abierto: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    # Area (espacio de tipo 'equipo') a la que pertenece un proyecto
    area_id: Mapped[int | None] = mapped_column(ForeignKey("proyectos.id", ondelete="SET NULL"), nullable=True, index=True)

    cliente_id: Mapped[int] = mapped_column(ForeignKey("clientes.id"), nullable=True)
    usuario_id: Mapped[int] = mapped_column(ForeignKey("usuarios.id"), nullable=True)

    cliente: Mapped[ClienteModel] = relationship(back_populates="proyectos")
    usuario: Mapped[UsuarioModel] = relationship(back_populates="proyectos", foreign_keys=[usuario_id])
    documentos: Mapped[list[DocumentoModel]] = relationship(back_populates="proyecto")