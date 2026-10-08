"""papelera

Los documentos y carpetas borrados pasan a la papelera: se marcan con la fecha,
quien los borro y un lote comun a todo lo borrado a la vez (una carpeta y su contenido).
Se pueden restaurar o eliminar definitivamente; a los 30 dias se eliminan solos.

Revision ID: 0006
Revises: 0005
Create Date: 2026-10-08 15:00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0006'
down_revision: Union[str, Sequence[str], None] = '0005'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

TABLAS = ('documentos', 'carpetas')


def upgrade() -> None:
    """Upgrade schema."""
    for tabla in TABLAS:
        op.add_column(tabla, sa.Column('eliminado_at', sa.DateTime(timezone=True), nullable=True))
        op.add_column(tabla, sa.Column('eliminado_por', sa.Integer(), nullable=True))
        op.add_column(tabla, sa.Column('papelera_lote', sa.String(length=36), nullable=True))
        op.create_foreign_key(f'{tabla}_eliminado_por_fkey', tabla, 'usuarios', ['eliminado_por'], ['id'], ondelete='SET NULL')
        op.create_index(op.f(f'ix_{tabla}_eliminado_at'), tabla, ['eliminado_at'], unique=False)
        op.create_index(op.f(f'ix_{tabla}_papelera_lote'), tabla, ['papelera_lote'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    for tabla in TABLAS:
        op.drop_index(op.f(f'ix_{tabla}_papelera_lote'), table_name=tabla)
        op.drop_index(op.f(f'ix_{tabla}_eliminado_at'), table_name=tabla)
        op.drop_constraint(f'{tabla}_eliminado_por_fkey', tabla, type_='foreignkey')
        op.drop_column(tabla, 'papelera_lote')
        op.drop_column(tabla, 'eliminado_por')
        op.drop_column(tabla, 'eliminado_at')
