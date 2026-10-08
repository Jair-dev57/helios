from __future__ import annotations
from datetime import datetime
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import Text, ForeignKey, DateTime, func
from src.core.db import Base


class ComentarioModel(Base):
    """Comentario sobre un documento. Las menciones van en el texto como @[Nombre](usuario_id)."""
    __tablename__ = "comentarios"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    documento_id: Mapped[int] = mapped_column(ForeignKey("documentos.id", ondelete="CASCADE"), index=True)
    usuario_id: Mapped[int | None] = mapped_column(ForeignKey("usuarios.id", ondelete="SET NULL"), nullable=True)
    texto: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    editado_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
