"""area de un proyecto

Un proyecto puede pertenecer a un area (un espacio de archivos de tipo 'equipo'): el menu de Proyectos
filtra por area y Mis proyectos agrupa por ella. Al borrar el area, sus proyectos quedan sin area.

- proyectos.area_id -> proyectos.id (ON DELETE SET NULL)

Revision ID: 0011
Revises: 0010
Create Date: 2026-10-13 18:00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0011'
down_revision: Union[str, Sequence[str], None] = '0010'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('proyectos', sa.Column('area_id', sa.Integer(), nullable=True))
    op.create_foreign_key('proyectos_area_id_fkey', 'proyectos', 'proyectos', ['area_id'], ['id'], ondelete='SET NULL')
    op.create_index('ix_proyectos_area_id', 'proyectos', ['area_id'])


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index('ix_proyectos_area_id', table_name='proyectos')
    op.drop_constraint('proyectos_area_id_fkey', 'proyectos', type_='foreignkey')
    op.drop_column('proyectos', 'area_id')
