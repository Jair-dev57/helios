"""columnas de tareas por proyecto

Cada proyecto recibe las columnas que antes eran fijas y cada tarea pasa de
`estado` (texto) a `columna_id`.

Revision ID: 0003
Revises: 0002
Create Date: 2026-09-27 18:30:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0003'
down_revision: Union[str, Sequence[str], None] = '0002'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# (estado anterior, nombre, color, es_final), en orden
COLUMNAS = [
    ("por_hacer", "Por hacer", "#9096A8", False),
    ("en_progreso", "En progreso", "#C08A2E", False),
    ("en_revision", "En revisión", "#5B6FB0", False),
    ("hecho", "Hecho", "#1A7F4B", True),
]


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table('tarea_columnas',
    sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
    sa.Column('proyecto_id', sa.Integer(), nullable=False),
    sa.Column('nombre', sa.String(length=50), nullable=False),
    sa.Column('color', sa.String(length=7), nullable=False),
    sa.Column('orden', sa.Integer(), nullable=False),
    sa.Column('es_final', sa.Boolean(), nullable=False),
    sa.ForeignKeyConstraint(['proyecto_id'], ['proyectos.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_tarea_columnas_proyecto_id'), 'tarea_columnas', ['proyecto_id'], unique=False)

    # Columnas por defecto para cada proyecto existente
    for orden, (_, nombre, color, es_final) in enumerate(COLUMNAS):
        op.execute(sa.text(
            "INSERT INTO tarea_columnas (proyecto_id, nombre, color, orden, es_final) "
            "SELECT id, :nombre, :color, :orden, :es_final FROM proyectos"
        ).bindparams(nombre=nombre, color=color, orden=orden, es_final=es_final))

    op.add_column('tareas', sa.Column('columna_id', sa.Integer(), nullable=True))
    for estado, nombre, _, _ in COLUMNAS:
        op.execute(sa.text(
            "UPDATE tareas t SET columna_id = c.id FROM tarea_columnas c "
            "WHERE c.proyecto_id = t.proyecto_id AND c.nombre = :nombre AND t.estado = :estado"
        ).bindparams(nombre=nombre, estado=estado))
    # Un estado desconocido cae en la primera columna del proyecto
    op.execute(
        "UPDATE tareas t SET columna_id = c.id FROM tarea_columnas c "
        "WHERE t.columna_id IS NULL AND c.proyecto_id = t.proyecto_id AND c.orden = 0"
    )

    op.alter_column('tareas', 'columna_id', nullable=False)
    op.create_index(op.f('ix_tareas_columna_id'), 'tareas', ['columna_id'], unique=False)
    op.create_foreign_key('tareas_columna_id_fkey', 'tareas', 'tarea_columnas', ['columna_id'], ['id'])
    op.drop_column('tareas', 'estado')


def downgrade() -> None:
    """Downgrade schema."""
    op.add_column('tareas', sa.Column('estado', sa.String(length=50), nullable=True))
    op.execute(
        "UPDATE tareas t SET estado = CASE WHEN c.es_final THEN 'hecho' "
        "WHEN c.nombre = 'En progreso' THEN 'en_progreso' "
        "WHEN c.nombre = 'En revisión' THEN 'en_revision' ELSE 'por_hacer' END "
        "FROM tarea_columnas c WHERE c.id = t.columna_id"
    )
    op.alter_column('tareas', 'estado', nullable=False)
    op.drop_constraint('tareas_columna_id_fkey', 'tareas', type_='foreignkey')
    op.drop_index(op.f('ix_tareas_columna_id'), table_name='tareas')
    op.drop_column('tareas', 'columna_id')
    op.drop_index(op.f('ix_tarea_columnas_proyecto_id'), table_name='tarea_columnas')
    op.drop_table('tarea_columnas')
