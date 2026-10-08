from __future__ import annotations
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import String, ForeignKey, UniqueConstraint
from src.core.db import Base


class EtiquetaModel(Base):
    """Etiqueta de un proyecto para clasificar documentos ("Acta", "Aprobado"...)."""
    __tablename__ = "etiquetas"
    __table_args__ = (UniqueConstraint("proyecto_id", "nombre", name="etiquetas_proyecto_nombre_key"),)

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    proyecto_id: Mapped[int] = mapped_column(ForeignKey("proyectos.id", ondelete="CASCADE"), index=True)
    nombre: Mapped[str] = mapped_column(String(40))
    color: Mapped[str] = mapped_column(String(7))


class DocumentoEtiquetaModel(Base):
    __tablename__ = "documento_etiquetas"

    documento_id: Mapped[int] = mapped_column(ForeignKey("documentos.id", ondelete="CASCADE"), primary_key=True)
    etiqueta_id: Mapped[int] = mapped_column(ForeignKey("etiquetas.id", ondelete="CASCADE"), primary_key=True, index=True)
