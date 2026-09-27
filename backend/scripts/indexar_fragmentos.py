"""Genera los fragmentos de busqueda de los documentos que aun no los tienen.

Uso (desde backend/):  uv run python -m scripts.indexar_fragmentos [--todos]
--todos rehace los fragmentos de todos los documentos, no solo de los que faltan.
"""
import asyncio
import sys

from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

import main  # noqa: F401 - registra todos los modelos
from src.core.config import settings
from src.core.db import Base
from src.features.busqueda.models import DocumentoFragmentoModel
from src.features.busqueda.services import indexar_fragmentos
from src.features.documentos.extraccion import extraer_contenido
from src.features.documentos.models import DocumentoModel
from src.features.documentos.services import LIMITE_PALABRAS_FRAGMENTOS


async def principal(todos: bool) -> None:
    engine = create_async_engine(settings.DATABASE_URL)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    sesion = async_sessionmaker(engine, expire_on_commit=False)
    async with sesion() as db:
        consulta = select(DocumentoModel.id, DocumentoModel.proyecto_id, DocumentoModel.nombre,
                          DocumentoModel.ruta, DocumentoModel.tipo)
        if not todos:
            con_fragmentos = select(DocumentoFragmentoModel.documento_id).distinct()
            consulta = consulta.where(DocumentoModel.id.not_in(con_fragmentos))
        documentos = (await db.execute(consulta)).all()
        print(f"{len(documentos)} documento(s) por indexar")
        for i, (doc_id, proyecto_id, nombre, ruta, tipo) in enumerate(documentos, 1):
            contenido = extraer_contenido(ruta, tipo or "", LIMITE_PALABRAS_FRAGMENTOS)
            await indexar_fragmentos(db, doc_id, proyecto_id, nombre, contenido)
            print(f"[{i}/{len(documentos)}] {nombre}: {'ok' if contenido else 'sin texto extraible'}")
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(principal("--todos" in sys.argv))
