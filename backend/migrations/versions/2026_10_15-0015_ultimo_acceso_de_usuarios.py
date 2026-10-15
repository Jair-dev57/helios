"""ultimo acceso de usuarios

La pestaña Usuarios de Configuración muestra cuándo entró cada usuario por última vez.

- usuarios.ultimo_acceso: se actualiza en cada inicio de sesión; NULL si nunca ha entrado

Revision ID: 0015
Revises: 0014
Create Date: 2026-10-15 10:00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0015'
down_revision: Union[str, Sequence[str], None] = '0014'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('usuarios', sa.Column('ultimo_acceso', sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('usuarios', 'ultimo_acceso')
