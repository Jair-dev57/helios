from sqlalchemy.orm import Mapped, mapped_column
from src.core.db import Base

class ProyectoModel(Base):
    __tablename__ = "proyectos"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    nombre: Mapped[str]
    estado: Mapped[str]