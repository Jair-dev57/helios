"""fecha de terminada de tareas

El Inicio mide el ritmo (tareas terminadas por dia) y las entregas a tiempo.

- tareas.terminada_at: cuando la tarea entro a la columna final; None si esta abierta.
  Las que ya estan terminadas toman su ultima modificacion como aproximacion.

Revision ID: 0013
Revises: 0012
Create Date: 2026-10-14 10:00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0013'
down_revision: Union[str, Sequence[str], None] = '0012'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('tareas', sa.Column('terminada_at', sa.DateTime(timezone=True), nullable=True))
    op.create_index(op.f('ix_tareas_terminada_at'), 'tareas', ['terminada_at'], unique=False)
    op.execute(
        """
        UPDATE tareas SET terminada_at = tareas.updated_at
        FROM tarea_columnas
        WHERE tarea_columnas.id = tareas.columna_id AND tarea_columnas.es_final
        """
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_tareas_terminada_at'), table_name='tareas')
    op.drop_column('tareas', 'terminada_at')
