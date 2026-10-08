from __future__ import annotations
from datetime import datetime
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import ForeignKey, DateTime, UniqueConstraint, func
from src.core.db import Base


class FavoritoModel(Base):
    """Documento o carpeta que un usuario marco con estrella."""
    __tablename__ = "favoritos"
    __table_args__ = (
        UniqueConstraint("usuario_id", "documento_id", name="favoritos_usuario_documento_key"),
        UniqueConstraint("usuario_id", "carpeta_id", name="favoritos_usuario_carpeta_key"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    usuario_id: Mapped[int] = mapped_column(ForeignKey("usuarios.id", ondelete="CASCADE"), index=True)
    documento_id: Mapped[int | None] = mapped_column(ForeignKey("documentos.id", ondelete="CASCADE"), nullable=True)
    carpeta_id: Mapped[int | None] = mapped_column(ForeignKey("carpetas.id", ondelete="CASCADE"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class DocumentoVistoModel(Base):
    """Ultima vez que un usuario abrio un documento (para "Recientes")."""
    __tablename__ = "documentos_vistos"

    usuario_id: Mapped[int] = mapped_column(ForeignKey("usuarios.id", ondelete="CASCADE"), primary_key=True)
    documento_id: Mapped[int] = mapped_column(ForeignKey("documentos.id", ondelete="CASCADE"), primary_key=True)
    visto_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)
