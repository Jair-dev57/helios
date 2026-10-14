"""orden de favoritos

Proyectos se maneja como un explorador: los favoritos van fijados en la barra lateral y se ordenan arrastrando.

- favoritos.orden: posicion en la barra lateral; los proyectos que ya eran favoritos toman el orden en que se marcaron

Revision ID: 0014
Revises: 0013
Create Date: 2026-10-14 16:00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0014'
down_revision: Union[str, Sequence[str], None] = '0013'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('favoritos', sa.Column('orden', sa.Integer(), nullable=True))
    op.execute(
        """
        UPDATE favoritos SET orden = sub.n
        FROM (
            SELECT id, row_number() OVER (PARTITION BY usuario_id ORDER BY created_at) AS n
            FROM favoritos WHERE proyecto_id IS NOT NULL
        ) AS sub
        WHERE favoritos.id = sub.id
        """
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('favoritos', 'orden')
