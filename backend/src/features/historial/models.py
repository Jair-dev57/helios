from __future__ import annotations
from datetime import datetime
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import String, Integer, Text, DateTime, func
from src.core.db import Base


class HistorialCambioModel(Base):
    __tablename__ = "historial_cambios"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    entidad_tipo: Mapped[str] = mapped_column(String(20))
    entidad_id: Mapped[int] = mapped_column(Integer)
    entidad_nombre: Mapped[str] = mapped_column(String(255))
    accion: Mapped[str] = mapped_column(String(20))
    cambios: Mapped[str] = mapped_column(Text, nullable=True)
    ruta: Mapped[str] = mapped_column(String(500), nullable=True)
    numero_version: Mapped[int] = mapped_column(Integer, nullable=True)
    proyecto_id: Mapped[int] = mapped_column(Integer, nullable=True)
    usuario_id: Mapped[int] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
