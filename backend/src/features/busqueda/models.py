from __future__ import annotations

from datetime import datetime

from pgvector.sqlalchemy import Vector
from sqlalchemy import DateTime, Integer, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from src.core.db import Base


class BusquedaEmbeddingModel(Base):
    __tablename__ = "busqueda_embeddings"
    __table_args__ = (
        UniqueConstraint("entidad_tipo", "entidad_id", name="busqueda_embeddings_entidad_tipo_entidad_id_key"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    entidad_tipo: Mapped[str] = mapped_column(String(20))
    entidad_id: Mapped[int] = mapped_column(Integer)
    texto_indexado: Mapped[str] = mapped_column(String)
    embedding: Mapped[list[float]] = mapped_column(Vector(1536))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())