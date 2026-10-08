from __future__ import annotations
from datetime import datetime
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import String, Integer, ForeignKey, DateTime, func
from src.core.db import Base


class EnlaceCompartidoModel(Base):
    """Enlace publico (sin cuenta) a un documento o a una carpeta.

    permiso "ver": ver y descargar (en una carpeta, tambien su contenido y el ZIP).
    permiso "subir": solo una carpeta; quien tiene el enlace puede enviar archivos pero no ve lo que hay.
    """
    __tablename__ = "enlaces_compartidos"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    token: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    permiso: Mapped[str] = mapped_column(String(20))
    documento_id: Mapped[int | None] = mapped_column(ForeignKey("documentos.id", ondelete="CASCADE"), nullable=True, index=True)
    carpeta_id: Mapped[int | None] = mapped_column(ForeignKey("carpetas.id", ondelete="CASCADE"), nullable=True, index=True)
    proyecto_id: Mapped[int] = mapped_column(ForeignKey("proyectos.id", ondelete="CASCADE"))
    contrasena_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)
    expira_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    creado_por: Mapped[int | None] = mapped_column(ForeignKey("usuarios.id", ondelete="SET NULL"), nullable=True)
    accesos: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    ultimo_acceso_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
