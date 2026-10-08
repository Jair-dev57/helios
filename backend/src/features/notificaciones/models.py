from __future__ import annotations
from datetime import datetime
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import String, ForeignKey, DateTime, func
from src.core.db import Base


class NotificacionModel(Base):
    """Aviso para un usuario: lo mencionaron, comentaron un archivo suyo o le enviaron un archivo por enlace."""
    __tablename__ = "notificaciones"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    usuario_id: Mapped[int] = mapped_column(ForeignKey("usuarios.id", ondelete="CASCADE"), index=True)
    # "mencion" | "comentario" | "recibido"
    tipo: Mapped[str] = mapped_column(String(30))
    texto: Mapped[str] = mapped_column(String(500))
    documento_id: Mapped[int | None] = mapped_column(ForeignKey("documentos.id", ondelete="CASCADE"), nullable=True)
    proyecto_id: Mapped[int | None] = mapped_column(ForeignKey("proyectos.id", ondelete="CASCADE"), nullable=True)
    actor_id: Mapped[int | None] = mapped_column(ForeignKey("usuarios.id", ondelete="SET NULL"), nullable=True)
    leida_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)
