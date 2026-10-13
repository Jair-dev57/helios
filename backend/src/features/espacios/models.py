from sqlalchemy import ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from src.core.db import Base


class EspacioMiembroModel(Base):
    """Quien puede ver un espacio de archivos de equipo que no esta abierto a todos."""
    __tablename__ = "espacio_miembros"
    __table_args__ = (UniqueConstraint("proyecto_id", "usuario_id", name="espacio_miembros_proyecto_usuario_key"),)

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    proyecto_id: Mapped[int] = mapped_column(ForeignKey("proyectos.id", ondelete="CASCADE"))
    usuario_id: Mapped[int] = mapped_column(ForeignKey("usuarios.id", ondelete="CASCADE"), index=True)
