"""comentarios y notificaciones

Comentarios sobre documentos (con @menciones) y avisos para los usuarios:
menciones, comentarios en sus archivos y archivos recibidos por enlace.

Revision ID: 0008
Revises: 0007
Create Date: 2026-10-08 20:00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0008'
down_revision: Union[str, Sequence[str], None] = '0007'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table('comentarios',
    sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
    sa.Column('documento_id', sa.Integer(), nullable=False),
    sa.Column('usuario_id', sa.Integer(), nullable=True),
    sa.Column('texto', sa.Text(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('editado_at', sa.DateTime(timezone=True), nullable=True),
    sa.ForeignKeyConstraint(['documento_id'], ['documentos.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['usuario_id'], ['usuarios.id'], ondelete='SET NULL'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_comentarios_documento_id'), 'comentarios', ['documento_id'], unique=False)
    op.create_table('notificaciones',
    sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
    sa.Column('usuario_id', sa.Integer(), nullable=False),
    sa.Column('tipo', sa.String(length=30), nullable=False),
    sa.Column('texto', sa.String(length=500), nullable=False),
    sa.Column('documento_id', sa.Integer(), nullable=True),
    sa.Column('proyecto_id', sa.Integer(), nullable=True),
    sa.Column('actor_id', sa.Integer(), nullable=True),
    sa.Column('leida_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['actor_id'], ['usuarios.id'], ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['documento_id'], ['documentos.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['proyecto_id'], ['proyectos.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['usuario_id'], ['usuarios.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_notificaciones_usuario_id'), 'notificaciones', ['usuario_id'], unique=False)
    op.create_index(op.f('ix_notificaciones_created_at'), 'notificaciones', ['created_at'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_notificaciones_created_at'), table_name='notificaciones')
    op.drop_index(op.f('ix_notificaciones_usuario_id'), table_name='notificaciones')
    op.drop_table('notificaciones')
    op.drop_index(op.f('ix_comentarios_documento_id'), table_name='comentarios')
    op.drop_table('comentarios')
