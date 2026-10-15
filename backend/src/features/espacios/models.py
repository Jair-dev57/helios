from sqlalchemy import ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from src.core.db import Base


class EspacioMiembroModel(Base):
    """Quien puede ver un espacio de archivos de equipo que no esta abierto a todos,
    o un proyecto compartido con personas elegidas (acceso 'personas')."""
    __tablename__ = "espacio_miembros"
    __table_args__ = (UniqueConstraint("proyecto_id", "usuario_id", name="espacio_miembros_proyecto_usuario_key"),)

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    proyecto_id: Mapped[int] = mapped_column(ForeignKey("proyectos.id", ondelete="CASCADE"))
    usuario_id: Mapped[int] = mapped_column(ForeignKey("usuarios.id", ondelete="CASCADE"), index=True)


class EquipoSeccionModel(Base):
    """Secciones que un equipo suma a sus miembros, ademas del Acceso basico."""
    __tablename__ = "equipo_secciones"
    __table_args__ = (UniqueConstraint("equipo_id", "seccion", name="equipo_secciones_equipo_seccion_key"),)

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    equipo_id: Mapped[int] = mapped_column(ForeignKey("proyectos.id", ondelete="CASCADE"), index=True)
    seccion: Mapped[str] = mapped_column(String(50))


class AccesoBasicoModel(Base):
    """Secciones que tiene cualquier persona, aunque no este en ningun equipo."""
    __tablename__ = "acceso_basico"

    seccion: Mapped[str] = mapped_column(String(50), primary_key=True)
