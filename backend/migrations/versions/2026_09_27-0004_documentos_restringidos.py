"""documentos restringidos

Un administrador puede restringir un documento para que solo lo vean los
administradores y los usuarios a los que se lo comparta (documento_accesos).

Revision ID: 0004
Revises: 0003
Create Date: 2026-09-27 21:00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0004'
down_revision: Union[str, Sequence[str], None] = '0003'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('documentos', sa.Column('restringido', sa.Boolean(), server_default='false', nullable=False))
    op.create_table('documento_accesos',
    sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
    sa.Column('documento_id', sa.Integer(), nullable=False),
    sa.Column('usuario_id', sa.Integer(), nullable=False),
    sa.ForeignKeyConstraint(['documento_id'], ['documentos.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['usuario_id'], ['usuarios.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('documento_id', 'usuario_id', name='documento_accesos_documento_usuario_key')
    )
    op.create_index(op.f('ix_documento_accesos_documento_id'), 'documento_accesos', ['documento_id'], unique=False)
    op.create_index(op.f('ix_documento_accesos_usuario_id'), 'documento_accesos', ['usuario_id'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_documento_accesos_usuario_id'), table_name='documento_accesos')
    op.drop_index(op.f('ix_documento_accesos_documento_id'), table_name='documento_accesos')
    op.drop_table('documento_accesos')
    op.drop_column('documentos', 'restringido')
