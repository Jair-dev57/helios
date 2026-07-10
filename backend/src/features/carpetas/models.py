from __future__ import annotations
from datetime import datetime
from typing import TYPE_CHECKING
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy import String, ForeignKey, DateTime, func
from src.core.db import Base

if TYPE_CHECKING:
    from src.features.proyectos.models import ProyectoModel


class CarpetaModel(Base):
    __tablename__ = "carpetas"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    nombre: Mapped[str] = mapped_column(String(150))
    proyecto_id: Mapped[int] = mapped_column(ForeignKey("proyectos.id"))
    carpeta_padre_id: Mapped[int] = mapped_column(ForeignKey("carpetas.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    proyecto: Mapped["ProyectoModel"] = relationship()
    subcarpetas: Mapped[list["CarpetaModel"]] = relationship(
        back_populates="carpeta_padre", cascade="all, delete-orphan"
    )
    carpeta_padre: Mapped["CarpetaModel"] = relationship(
        back_populates="subcarpetas", remote_side=[id]
    )