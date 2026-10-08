"""favoritos, recientes, etiquetas y bloqueo

- favoritos: documentos y carpetas con estrella de cada usuario
- documentos_vistos: ultima vez que cada usuario abrio un documento (Recientes)
- etiquetas por proyecto y su relacion con documentos
- bloqueo de documentos para editar (quien y desde cuando)

Revision ID: 0009
Revises: 0008
Create Date: 2026-10-08 22:00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0009'
down_revision: Union[str, Sequence[str], None] = '0008'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('documentos', sa.Column('bloqueado_por_id', sa.Integer(), nullable=True))
    op.add_column('documentos', sa.Column('bloqueado_at', sa.DateTime(timezone=True), nullable=True))
    op.create_foreign_key('documentos_bloqueado_por_id_fkey', 'documentos', 'usuarios', ['bloqueado_por_id'], ['id'], ondelete='SET NULL')

    op.create_table('favoritos',
    sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
    sa.Column('usuario_id', sa.Integer(), nullable=False),
    sa.Column('documento_id', sa.Integer(), nullable=True),
    sa.Column('carpeta_id', sa.Integer(), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['carpeta_id'], ['carpetas.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['documento_id'], ['documentos.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['usuario_id'], ['usuarios.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('usuario_id', 'documento_id', name='favoritos_usuario_documento_key'),
    sa.UniqueConstraint('usuario_id', 'carpeta_id', name='favoritos_usuario_carpeta_key')
    )
    op.create_index(op.f('ix_favoritos_usuario_id'), 'favoritos', ['usuario_id'], unique=False)

    op.create_table('documentos_vistos',
    sa.Column('usuario_id', sa.Integer(), nullable=False),
    sa.Column('documento_id', sa.Integer(), nullable=False),
    sa.Column('visto_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['documento_id'], ['documentos.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['usuario_id'], ['usuarios.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('usuario_id', 'documento_id')
    )
    op.create_index(op.f('ix_documentos_vistos_visto_at'), 'documentos_vistos', ['visto_at'], unique=False)

    op.create_table('etiquetas',
    sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
    sa.Column('proyecto_id', sa.Integer(), nullable=False),
    sa.Column('nombre', sa.String(length=40), nullable=False),
    sa.Column('color', sa.String(length=7), nullable=False),
    sa.ForeignKeyConstraint(['proyecto_id'], ['proyectos.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('proyecto_id', 'nombre', name='etiquetas_proyecto_nombre_key')
    )
    op.create_index(op.f('ix_etiquetas_proyecto_id'), 'etiquetas', ['proyecto_id'], unique=False)

    op.create_table('documento_etiquetas',
    sa.Column('documento_id', sa.Integer(), nullable=False),
    sa.Column('etiqueta_id', sa.Integer(), nullable=False),
    sa.ForeignKeyConstraint(['documento_id'], ['documentos.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['etiqueta_id'], ['etiquetas.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('documento_id', 'etiqueta_id')
    )
    op.create_index(op.f('ix_documento_etiquetas_etiqueta_id'), 'documento_etiquetas', ['etiqueta_id'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_documento_etiquetas_etiqueta_id'), table_name='documento_etiquetas')
    op.drop_table('documento_etiquetas')
    op.drop_index(op.f('ix_etiquetas_proyecto_id'), table_name='etiquetas')
    op.drop_table('etiquetas')
    op.drop_index(op.f('ix_documentos_vistos_visto_at'), table_name='documentos_vistos')
    op.drop_table('documentos_vistos')
    op.drop_index(op.f('ix_favoritos_usuario_id'), table_name='favoritos')
    op.drop_table('favoritos')
    op.drop_constraint('documentos_bloqueado_por_id_fkey', 'documentos', type_='foreignkey')
    op.drop_column('documentos', 'bloqueado_at')
    op.drop_column('documentos', 'bloqueado_por_id')
