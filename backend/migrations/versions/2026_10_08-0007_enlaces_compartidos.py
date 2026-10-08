"""enlaces compartidos

Enlaces publicos (sin cuenta) a un documento o una carpeta: para ver y descargar,
o, en una carpeta, para que otros envien archivos sin ver lo que hay dentro.

Revision ID: 0007
Revises: 0006
Create Date: 2026-10-08 18:00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0007'
down_revision: Union[str, Sequence[str], None] = '0006'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table('enlaces_compartidos',
    sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
    sa.Column('token', sa.String(length=64), nullable=False),
    sa.Column('permiso', sa.String(length=20), nullable=False),
    sa.Column('documento_id', sa.Integer(), nullable=True),
    sa.Column('carpeta_id', sa.Integer(), nullable=True),
    sa.Column('proyecto_id', sa.Integer(), nullable=False),
    sa.Column('contrasena_hash', sa.String(length=255), nullable=True),
    sa.Column('expira_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('creado_por', sa.Integer(), nullable=True),
    sa.Column('accesos', sa.Integer(), server_default='0', nullable=False),
    sa.Column('ultimo_acceso_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['carpeta_id'], ['carpetas.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['creado_por'], ['usuarios.id'], ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['documento_id'], ['documentos.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['proyecto_id'], ['proyectos.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_enlaces_compartidos_token'), 'enlaces_compartidos', ['token'], unique=True)
    op.create_index(op.f('ix_enlaces_compartidos_documento_id'), 'enlaces_compartidos', ['documento_id'], unique=False)
    op.create_index(op.f('ix_enlaces_compartidos_carpeta_id'), 'enlaces_compartidos', ['carpeta_id'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_enlaces_compartidos_carpeta_id'), table_name='enlaces_compartidos')
    op.drop_index(op.f('ix_enlaces_compartidos_documento_id'), table_name='enlaces_compartidos')
    op.drop_index(op.f('ix_enlaces_compartidos_token'), table_name='enlaces_compartidos')
    op.drop_table('enlaces_compartidos')
