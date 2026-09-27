from __future__ import annotations
import re

from openai import AsyncOpenAI
from sqlalchemy import delete, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from src.core.config import settings
from src.features.busqueda.models import BusquedaEmbeddingModel, DocumentoFragmentoModel
from src.features.busqueda.schemas import ResultadoBusqueda
from src.features.tareas.models import TareaModel
from src.features.documentos.models import DocumentoModel

client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
MODELO_EMBEDDING = "text-embedding-3-small"
UMBRAL_SIMILITUD_MINIMA = 0.25
# El modelo acepta max 8192 tokens; en datos tabulares/numericos un token puede ser ~1.5 caracteres
LIMITE_CARACTERES_EMBEDDING = 12000

# Busqueda dentro del contenido de los documentos
TAMANO_FRAGMENTO = 1000  # caracteres aprox. por fragmento
SOLAPE_FRAGMENTO = 200  # se repite el final del fragmento anterior para no partir una idea en dos
MAX_FRAGMENTOS_POR_DOCUMENTO = 300
LOTE_EMBEDDINGS = 100
UMBRAL_SIMILITUD_FRAGMENTO = 0.3
LARGO_RECORTE = 240


async def generar_embedding(texto: str) -> list[float]:
    """Genera el vector de embedding para un texto usando OpenAI."""
    respuesta = await client.embeddings.create(
        model=MODELO_EMBEDDING,
        input=texto[:LIMITE_CARACTERES_EMBEDDING],
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

# ---------- Busqueda dentro del contenido de los documentos ----------

def fragmentar(texto: str) -> list[str]:
    """Parte el texto en fragmentos de ~TAMANO_FRAGMENTO caracteres que se solapan entre si."""
    fragmentos: list[str] = []
    actual: list[str] = []
    largo = 0
    hay_nuevas = False
    for palabra in texto.split():
        actual.append(palabra)
        largo += len(palabra) + 1
        hay_nuevas = True
        if largo >= TAMANO_FRAGMENTO:
            fragmentos.append(" ".join(actual))
            solape: list[str] = []
            largo_solape = 0
            for p in reversed(actual):
                if largo_solape >= SOLAPE_FRAGMENTO:
                    break
                solape.insert(0, p)
                largo_solape += len(p) + 1
            actual, largo, hay_nuevas = solape, largo_solape, False
    if actual and hay_nuevas:
        fragmentos.append(" ".join(actual))
    return fragmentos


async def indexar_fragmentos(
    db_session: AsyncSession,
    documento_id: int,
    proyecto_id: int,
    nombre: str,
    contenido: str | None,
) -> None:
    """Reemplaza los fragmentos de un documento por los de su contenido actual."""
    await db_session.execute(delete(DocumentoFragmentoModel).where(DocumentoFragmentoModel.documento_id == documento_id))
    fragmentos = fragmentar(contenido)[:MAX_FRAGMENTOS_POR_DOCUMENTO] if contenido else []
    for inicio in range(0, len(fragmentos), LOTE_EMBEDDINGS):
        lote = fragmentos[inicio:inicio + LOTE_EMBEDDINGS]
        # El nombre del archivo da contexto al fragmento ("Contrato prestaciones: ... 30 dias ...")
        respuesta = await client.embeddings.create(model=MODELO_EMBEDDING, input=[f"{nombre}: {f}" for f in lote])
        for i, (texto, dato) in enumerate(zip(lote, respuesta.data)):
            db_session.add(DocumentoFragmentoModel(
                documento_id=documento_id,
                proyecto_id=proyecto_id,
                orden=inicio + i,
                texto=texto,
                embedding=dato.embedding,
            ))
    await db_session.commit()


def _recorte(texto: str, query: str) -> str:
    """Devuelve la parte del fragmento mas cercana a lo buscado, para mostrarla como vista previa."""
    minusculas = texto.lower()
    posicion = minusculas.find(query.lower())
    if posicion < 0:
        palabras = [p for p in re.findall(r"\w+", query.lower()) if len(p) > 3]
        posiciones = [minusculas.find(p) for p in palabras if p in minusculas]
        posicion = min(posiciones) if posiciones else 0
    inicio = max(0, posicion - LARGO_RECORTE // 3)
    if inicio > 0:
        espacio = texto.find(" ", inicio)
        inicio = espacio + 1 if 0 <= espacio < posicion else inicio
    fin = min(len(texto), inicio + LARGO_RECORTE)
    return ("…" if inicio > 0 else "") + texto[inicio:fin].strip() + ("…" if fin < len(texto) else "")


async def buscar_en_documentos(
    db_session: AsyncSession,
    proyecto_id: int,
    query: str,
    documento_ids: list[int] | None = None,
    limite: int = 20,
) -> list[dict]:
    """Busca en el contenido de los documentos de un proyecto.

    Combina coincidencia literal (sirve para datos exactos: NIT, numeros, nombres propios)
    con similitud semantica (sirve para preguntas: "cuanto dura el contrato").
    Devuelve un resultado por documento con el fragmento que mejor coincide.
    """
    if documento_ids is not None and not documento_ids:
        return []

    def filtrar(stmt):
        stmt = stmt.where(DocumentoFragmentoModel.proyecto_id == proyecto_id)
        if documento_ids is not None:
            stmt = stmt.where(DocumentoFragmentoModel.documento_id.in_(documento_ids))
        return stmt

    mejores: dict[int, dict] = {}

    patron = "%" + query.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%"
    literales = (await db_session.execute(filtrar(
        select(DocumentoFragmentoModel.documento_id, DocumentoFragmentoModel.texto)
        .where(DocumentoFragmentoModel.texto.ilike(patron, escape="\\"))
        .order_by(DocumentoFragmentoModel.orden)
        .limit(200)
    ))).all()
    for documento_id, texto in literales:
        if documento_id not in mejores:
            mejores[documento_id] = {"texto": texto, "similitud": 1.0, "coincidencia": "exacta"}

    embedding_query = await generar_embedding(query)
    distancia = DocumentoFragmentoModel.embedding.cosine_distance(embedding_query).label("distancia")
    semanticos = (await db_session.execute(filtrar(
        select(DocumentoFragmentoModel.documento_id, DocumentoFragmentoModel.texto, distancia)
        .order_by(distancia)
        .limit(60)
    ))).all()
    for documento_id, texto, dist in semanticos:
        similitud = round(1 - dist, 4)
        if similitud < UMBRAL_SIMILITUD_FRAGMENTO or documento_id in mejores:
            continue
        mejores[documento_id] = {"texto": texto, "similitud": similitud, "coincidencia": "semantica"}

    resultados = [
        {
            "documento_id": documento_id,
            "fragmento": _recorte(m["texto"], query),
            "similitud": m["similitud"],
            "coincidencia": m["coincidencia"],
        }
        for documento_id, m in mejores.items()
    ]
    resultados.sort(key=lambda r: r["similitud"], reverse=True)
    return resultados[:limite]
