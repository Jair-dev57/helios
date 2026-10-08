"""hash de documentos

Guarda el SHA-256 del archivo de la version actual de cada documento para saber
si un archivo cambio (subidas de carpetas repetidas y, mas adelante, sincronizacion).
Calcula el hash de los documentos que ya existen a partir de su archivo en disco.

Revision ID: 0005
Revises: 0004
Create Date: 2026-10-08 12:00:00

"""
import hashlib
from pathlib import Path
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0005'
down_revision: Union[str, Sequence[str], None] = '0004'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Carpeta backend/, donde viven los archivos subidos (uploads/documentos/...)
BASE_DIR = Path(__file__).resolve().parents[2]


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('documentos', sa.Column('hash', sa.String(length=64), nullable=True))

    conexion = op.get_bind()
    documentos = conexion.execute(sa.text("SELECT id, ruta FROM documentos")).all()
    for documento_id, ruta in documentos:
        archivo = BASE_DIR / ruta.lstrip("/")
        if archivo.is_file():
            conexion.execute(
                sa.text("UPDATE documentos SET hash = :hash WHERE id = :id"),
                {"hash": hashlib.sha256(archivo.read_bytes()).hexdigest(), "id": documento_id},
            )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('documentos', 'hash')
