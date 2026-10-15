"""acceso de proyectos

Cada proyecto decide quien lo ve: todo el equipo, los miembros de un equipo (su area), personas elegidas
o solo quien lo creo. Las personas elegidas se guardan en espacio_miembros, como los miembros de un equipo.

- proyectos.acceso: 'todos' | 'equipo' | 'personas' | 'solo'; los que ya existen quedan en 'todos'

Revision ID: 0016
Revises: 0015
Create Date: 2026-10-15 16:00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0016'
down_revision: Union[str, Sequence[str], None] = '0015'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('proyectos', sa.Column('acceso', sa.String(length=20), nullable=False, server_default='todos'))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('proyectos', 'acceso')
