from __future__ import annotations
from openai import AsyncOpenAI
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from src.core.config import settings
from src.features.busqueda.models import BusquedaEmbeddingModel
from src.features.busqueda.schemas import ResultadoBusqueda
from src.features.tareas.models import TareaModel
from src.features.documentos.models import DocumentoModel

client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
MODELO_EMBEDDING = "text-embedding-3-small"
UMBRAL_SIMILITUD_MINIMA = 0.25


async def generar_embedding(texto: str) -> list[float]:
    """Genera el vector de embedding para un texto usando OpenAI."""
    respuesta = await client.embeddings.create(
        model=MODELO_EMBEDDING,
        input=texto,
    )
    return respuesta.data[0].embedding


async def indexar_entidad(
    db_session: AsyncSession,
    entidad_tipo: str,
    entidad_id: int,
    texto: str,
) -> None:
    """Genera el embedding de una entidad y lo guarda (o actualiza si ya existía)."""
    embedding = await generar_embedding(texto)

    resultado = await db_session.execute(
        select(BusquedaEmbeddingModel).where(
            BusquedaEmbeddingModel.entidad_tipo == entidad_tipo,
            BusquedaEmbeddingModel.entidad_id == entidad_id,
        )
    )
    existente = resultado.scalar_one_or_none()

    if existente:
        existente.texto_indexado = texto
        existente.embedding = embedding
    else:
        db_session.add(
            BusquedaEmbeddingModel(
                entidad_tipo=entidad_tipo,
                entidad_id=entidad_id,
                texto_indexado=texto,
                embedding=embedding,
            )
        )
    await db_session.commit()


async def eliminar_indice(db_session: AsyncSession, entidad_tipo: str, entidad_id: int) -> None:
    """Elimina el embedding de una entidad (ej. cuando se borra el registro original)."""
    resultado = await db_session.execute(
        select(BusquedaEmbeddingModel).where(
            BusquedaEmbeddingModel.entidad_tipo == entidad_tipo,
            BusquedaEmbeddingModel.entidad_id == entidad_id,
        )
    )
    existente = resultado.scalar_one_or_none()
    if existente:
        await db_session.delete(existente)
        await db_session.commit()


async def _proyecto_id_de(db_session: AsyncSession, entidad_tipo: str, entidad_id: int) -> int | None:
    """Resuelve el proyecto_id al que pertenece una tarea o documento, para navegación en frontend."""
    if entidad_tipo == "tarea":
        result = await db_session.execute(select(TareaModel.proyecto_id).where(TareaModel.id == entidad_id))
        return result.scalar_one_or_none()
    if entidad_tipo == "documento":
        result = await db_session.execute(select(DocumentoModel.proyecto_id).where(DocumentoModel.id == entidad_id))
        return result.scalar_one_or_none()
    if entidad_tipo == "proyecto":
        return entidad_id
    return None


async def buscar(db_session: AsyncSession, query: str, limite_por_tipo: int = 5) -> dict[str, list[ResultadoBusqueda]]:
    """Busca por similitud semántica entre todas las entidades indexadas."""
    embedding_query = await generar_embedding(query)

    resultados: dict[str, list[ResultadoBusqueda]] = {
        "proyectos": [],
        "tareas": [],
        "documentos": [],
        "clientes": [],
    }

    for tipo in resultados.keys():
        entidad_tipo_singular = tipo[:-1] if tipo != "clientes" else "cliente"
        stmt = (
            select(
                BusquedaEmbeddingModel,
                BusquedaEmbeddingModel.embedding.cosine_distance(embedding_query).label("distancia"),
            )
            .where(BusquedaEmbeddingModel.entidad_tipo == entidad_tipo_singular)
            .order_by("distancia")
            .limit(limite_por_tipo)
        )
        filas = (await db_session.execute(stmt)).all()
        for fila_modelo, distancia in filas:
            similitud = round(1 - distancia, 4)
            if similitud < UMBRAL_SIMILITUD_MINIMA:
                continue
            proyecto_id = await _proyecto_id_de(db_session, fila_modelo.entidad_tipo, fila_modelo.entidad_id)
            resultados[tipo].append(
                ResultadoBusqueda(
                    entidad_tipo=fila_modelo.entidad_tipo,
                    entidad_id=fila_modelo.entidad_id,
                    titulo=fila_modelo.texto_indexado.split("\n")[0][:100],
                    subtitulo=None,
                    similitud=similitud,
                    proyecto_id=proyecto_id,
                )
            )

    return resultados