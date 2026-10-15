"""quitar roles

Los permisos vienen del Acceso basico, de los equipos y de usuarios.es_administrador (0017): los roles ya no
se usan. Se borran sus tablas y la columna usuarios.rol, y la seccion «roles» pasa a llamarse «equipos».

Revision ID: 0018
Revises: 0017
Create Date: 2026-10-15 19:00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0018'
down_revision: Union[str, Sequence[str], None] = '0017'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.execute("UPDATE equipo_secciones SET seccion = 'equipos' WHERE seccion = 'roles'")
    op.execute("UPDATE acceso_basico SET seccion = 'equipos' WHERE seccion = 'roles'")
    op.drop_table('rol_secciones')
    op.drop_table('roles')
    op.drop_column('usuarios', 'rol')


def downgrade() -> None:
    """Downgrade schema (vuelve la estructura, vacia: los roles no se recuperan)."""
    op.add_column('usuarios', sa.Column('rol', sa.String(length=50), nullable=True))
    op.create_table(
        'roles',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('nombre', sa.String(length=50), nullable=False, unique=True),
        sa.Column('es_administrador', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
    )
    op.create_table(
        'rol_secciones',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('rol_id', sa.Integer(), sa.ForeignKey('roles.id', ondelete='CASCADE'), nullable=False),
        sa.Column('seccion', sa.String(length=50), nullable=False),
        sa.UniqueConstraint('rol_id', 'seccion', name='rol_secciones_rol_id_seccion_key'),
    )
    op.execute("UPDATE equipo_secciones SET seccion = 'roles' WHERE seccion = 'equipos'")
    op.execute("UPDATE acceso_basico SET seccion = 'roles' WHERE seccion = 'equipos'")
