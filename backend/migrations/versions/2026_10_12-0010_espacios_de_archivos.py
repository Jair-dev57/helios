"""espacios de archivos (personal y de equipo)

Un espacio es un proyecto con tipo 'personal' o 'equipo': reutiliza carpetas, documentos, versiones,
papelera, enlaces, etiquetas y comentarios. No aparece en Proyectos, Dashboard ni Calendario.

- proyectos.tipo: 'proyecto' (por defecto), 'personal' o 'equipo'
- proyectos.propietario_id: dueno del espacio personal
- proyectos.color y proyectos.abierto (espacio de equipo visible para todos)
- espacio_miembros: quienes ven un espacio de equipo que no es abierto

Revision ID: 0010
Revises: 0009
Create Date: 2026-10-12 21:00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0010'
down_revision: Union[str, Sequence[str], None] = '0009'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('proyectos', sa.Column('tipo', sa.String(length=20), nullable=False, server_default='proyecto'))
    op.add_column('proyectos', sa.Column('propietario_id', sa.Integer(), nullable=True))
    op.add_column('proyectos', sa.Column('color', sa.String(length=7), nullable=True))
    op.add_column('proyectos', sa.Column('abierto', sa.Boolean(), nullable=False, server_default='false'))
    op.create_foreign_key('proyectos_propietario_id_fkey', 'proyectos', 'usuarios', ['propietario_id'], ['id'], ondelete='CASCADE')
    op.create_index('ix_proyectos_tipo', 'proyectos', ['tipo'])
    # Un solo espacio personal por usuario
    op.create_index(
        'ix_proyectos_personal_unico', 'proyectos', ['propietario_id'], unique=True,
        postgresql_where=sa.text("tipo = 'personal'"),
    )

    op.create_table(
        'espacio_miembros',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('proyecto_id', sa.Integer(), sa.ForeignKey('proyectos.id', ondelete='CASCADE'), nullable=False),
        sa.Column('usuario_id', sa.Integer(), sa.ForeignKey('usuarios.id', ondelete='CASCADE'), nullable=False),
        sa.UniqueConstraint('proyecto_id', 'usuario_id', name='espacio_miembros_proyecto_usuario_key'),
    )
    op.create_index('ix_espacio_miembros_usuario_id', 'espacio_miembros', ['usuario_id'])


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index('ix_espacio_miembros_usuario_id', table_name='espacio_miembros')
    op.drop_table('espacio_miembros')
    op.drop_index('ix_proyectos_personal_unico', table_name='proyectos')
    op.drop_index('ix_proyectos_tipo', table_name='proyectos')
    op.drop_constraint('proyectos_propietario_id_fkey', 'proyectos', type_='foreignkey')
    op.drop_column('proyectos', 'abierto')
    op.drop_column('proyectos', 'color')
    op.drop_column('proyectos', 'propietario_id')
    op.drop_column('proyectos', 'tipo')
