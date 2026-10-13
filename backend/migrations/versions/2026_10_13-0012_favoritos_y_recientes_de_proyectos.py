"""favoritos y recientes de proyectos

Mis proyectos tiene Favoritos y Recientes como Archivos.

- favoritos.proyecto_id: proyecto con estrella (uno por usuario)
- proyectos_vistos: ultima vez que cada usuario abrio un proyecto

Revision ID: 0012
Revises: 0011
Create Date: 2026-10-13 19:00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0012'
down_revision: Union[str, Sequence[str], None] = '0011'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('favoritos', sa.Column('proyecto_id', sa.Integer(), nullable=True))
    op.create_foreign_key('favoritos_proyecto_id_fkey', 'favoritos', 'proyectos', ['proyecto_id'], ['id'], ondelete='CASCADE')
    op.create_unique_constraint('favoritos_usuario_proyecto_key', 'favoritos', ['usuario_id', 'proyecto_id'])

    op.create_table('proyectos_vistos',
    sa.Column('usuario_id', sa.Integer(), nullable=False),
    sa.Column('proyecto_id', sa.Integer(), nullable=False),
    sa.Column('visto_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['proyecto_id'], ['proyectos.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['usuario_id'], ['usuarios.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('usuario_id', 'proyecto_id')
    )
    op.create_index(op.f('ix_proyectos_vistos_visto_at'), 'proyectos_vistos', ['visto_at'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_proyectos_vistos_visto_at'), table_name='proyectos_vistos')
    op.drop_table('proyectos_vistos')
    op.drop_constraint('favoritos_usuario_proyecto_key', 'favoritos', type_='unique')
    op.drop_constraint('favoritos_proyecto_id_fkey', 'favoritos', type_='foreignkey')
    op.drop_column('favoritos', 'proyecto_id')
