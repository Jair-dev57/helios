from __future__ import annotations
from datetime import datetime
from typing import TYPE_CHECKING
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy import String, Integer, Boolean, ForeignKey, DateTime, func
from src.core.db import Base

if TYPE_CHECKING:
    from src.features.proyectos.models import ProyectoModel
    from src.features.auth.models import UsuarioModel


class TareaColumnaModel(Base):
    """Columna del tablero de tareas de un proyecto (Por hacer, En progreso, ...)."""

    __tablename__ = "tarea_columnas"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    proyecto_id: Mapped[int] = mapped_column(ForeignKey("proyectos.id", ondelete="CASCADE"), index=True)
    nombre: Mapped[str] = mapped_column(String(50))
    color: Mapped[str] = mapped_column(String(7), default="#9096A8")
    orden: Mapped[int] = mapped_column(Integer, default=0)
    # Las tareas en la columna final cuentan como terminadas (dashboard, avance del proyecto)
    es_final: Mapped[bool] = mapped_column(Boolean, default=False)


class TareaModel(Base):
    __tablename__ = "tareas"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    titulo: Mapped[str] = mapped_column(String(200))
    descripcion: Mapped[str] = mapped_column(String(500), nullable=True)
    prioridad: Mapped[str] = mapped_column(String(20), default="media")
    orden: Mapped[int] = mapped_column(Integer, default=0)
    fecha_vencimiento: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    proyecto_id: Mapped[int] = mapped_column(ForeignKey("proyectos.id"))
    columna_id: Mapped[int] = mapped_column(ForeignKey("tarea_columnas.id"), index=True)
    usuario_asignado_id: Mapped[int] = mapped_column(ForeignKey("usuarios.id"), nullable=True)

    proyecto: Mapped["ProyectoModel"] = relationship()
    usuario_asignado: Mapped["UsuarioModel"] = relationship()


class TareaDocumentoModel(Base):
    __tablename__ = "tarea_documentos"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    tarea_id: Mapped[int] = mapped_column(ForeignKey("tareas.id"))
    documento_id: Mapped[int] = mapped_column(ForeignKey("documentos.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())