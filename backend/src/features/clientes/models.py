from __future__ import annotations
from datetime import datetime
from typing import TYPE_CHECKING
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy import String, DateTime, func
from src.core.db import Base

if TYPE_CHECKING:
    from src.features.proyectos.models import ProyectoModel

class ClienteModel(Base):
    __tablename__ = "clientes"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    nombre: Mapped[str] = mapped_column(String(150))
    email: Mapped[str] = mapped_column(String(150), nullable=True)
    telefono: Mapped[str] = mapped_column(String(20), nullable=True)
    empresa: Mapped[str] = mapped_column(String(150), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    proyectos: Mapped[list[ProyectoModel]] = relationship(back_populates="cliente")