"""permisos por equipos

Los permisos dejan de venir del rol: cada persona tiene el Acceso basico, mas lo que suman sus equipos,
y un interruptor de administrador (acceso total).

- usuarios.es_administrador
- equipo_secciones: secciones que suma cada equipo (espacio de tipo 'equipo')
- acceso_basico: secciones que tiene cualquiera, aunque no este en ningun equipo
- Datos: los roles de administrador pasan a usuarios.es_administrador; cada rol que no lo es pasa a ser un
  equipo (o se une al equipo con su mismo nombre) con sus secciones y sus personas como miembros.
  Las tablas de roles se conservan sin uso.

Revision ID: 0017
Revises: 0016
Create Date: 2026-10-15 18:00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0017'
down_revision: Union[str, Sequence[str], None] = '0016'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

COLORES = ['#3b82f6', '#ec4899', '#14b8a6', '#a855f7', '#f97316', '#22c55e', '#ef4444', '#eab308']
BASICO = ['busqueda', 'mis_tareas', 'calendario', 'archivos', 'documentos']


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('usuarios', sa.Column('es_administrador', sa.Boolean(), nullable=False, server_default='false'))
    op.create_table(
        'equipo_secciones',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('equipo_id', sa.Integer(), sa.ForeignKey('proyectos.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('seccion', sa.String(length=50), nullable=False),
        sa.UniqueConstraint('equipo_id', 'seccion', name='equipo_secciones_equipo_seccion_key'),
    )
    op.create_table('acceso_basico', sa.Column('seccion', sa.String(length=50), primary_key=True))

    con = op.get_bind()
    for seccion in BASICO:
        con.execute(sa.text("INSERT INTO acceso_basico (seccion) VALUES (:s)"), {"s": seccion})
    con.execute(sa.text(
        "UPDATE usuarios SET es_administrador = true "
        "WHERE rol IN (SELECT nombre FROM roles WHERE es_administrador)"
    ))
    roles = con.execute(sa.text("SELECT id, nombre FROM roles WHERE NOT es_administrador ORDER BY nombre")).all()
    for i, (rol_id, nombre) in enumerate(roles):
        equipo_id = con.execute(sa.text(
            "SELECT id FROM proyectos WHERE tipo = 'equipo' AND lower(nombre) = lower(:n)"
        ), {"n": nombre}).scalar()
        if equipo_id is None:
            equipo_id = con.execute(sa.text(
                "INSERT INTO proyectos (nombre, tipo, estado, color, abierto, acceso) "
                "VALUES (:n, 'equipo', 'activo', :c, false, 'todos') RETURNING id"
            ), {"n": nombre, "c": COLORES[i % len(COLORES)]}).scalar()
        con.execute(sa.text(
            "INSERT INTO equipo_secciones (equipo_id, seccion) "
            "SELECT :e, seccion FROM rol_secciones WHERE rol_id = :r ON CONFLICT DO NOTHING"
        ), {"e": equipo_id, "r": rol_id})
        con.execute(sa.text(
            "INSERT INTO espacio_miembros (proyecto_id, usuario_id) "
            "SELECT :e, id FROM usuarios WHERE rol = :n ON CONFLICT DO NOTHING"
        ), {"e": equipo_id, "n": nombre})


def downgrade() -> None:
    """Downgrade schema (los equipos creados desde roles se conservan)."""
    op.drop_table('acceso_basico')
    op.drop_table('equipo_secciones')
    op.drop_column('usuarios', 'es_administrador')
