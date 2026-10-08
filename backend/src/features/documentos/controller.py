import hashlib
import uuid
from pathlib import Path
from typing import Annotated

import msgspec
from litestar import Controller, get, post, put, delete, Request
from litestar.enums import RequestEncodingType
from litestar.exceptions import NotFoundException, ValidationException
from litestar.response import File
from litestar.params import Body
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.permisos import requerir_admin, requerir_seccion
from src.features.documentos.schemas import (
    DocumentoCrear,
    DocumentoAcceso,
    DocumentoActualizar,
    DocumentoRespuesta,
    DocumentoSubida,
    DocumentoVersionSubida,
    ResultadoContenido,
)
from src.features.documentos.services import (
    obtener_documentos,
    obtener_documento,
    crear_documento,
    actualizar_documento,
    eliminar_documento,
    datos_listado,
    ids_documentos_en_carpeta,
    documentos_ocultos,
    obtener_accesos,
    cambiar_acceso,
)
from src.features.busqueda.services import buscar_en_documentos
from src.features.documentos.extraccion import _ruta_local

UPLOAD_DIR = Path("uploads/documentos")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

EXTENSIONES_PERMITIDAS = {
    ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx",
    ".txt", ".csv", ".png", ".jpg", ".jpeg",
}


async def _leer_archivo(archivo) -> tuple[bytes, str, str]:
    """Contenido, extension y hash SHA-256 de un archivo subido. Rechaza los tipos no permitidos."""
    extension = Path(archivo.filename).suffix.lower()
    if extension not in EXTENSIONES_PERMITIDAS:
        raise ValidationException(detail=f"Tipo de archivo no permitido: {extension}")
    contenido = await archivo.read()
    return contenido, extension, hashlib.sha256(contenido).hexdigest()


def _guardar_en_disco(contenido: bytes, extension: str) -> str:
    """Guarda el archivo con un nombre unico y devuelve su ruta publica."""
    nombre_archivo = f"{uuid.uuid4()}{extension}"
    (UPLOAD_DIR / nombre_archivo).write_bytes(contenido)
    return f"/uploads/documentos/{nombre_archivo}"


async def _respuestas_listado(db: AsyncSession, documentos) -> list[DocumentoRespuesta]:
    datos = await datos_listado(db, documentos)
    respuestas = []
    for d in documentos:
        modificado_por, tamano = datos[d.id]
        respuesta = msgspec.convert(d, DocumentoRespuesta, from_attributes=True)
        respuestas.append(msgspec.structs.replace(respuesta, modificado_por=modificado_por, tamano=tamano))
    return respuestas


async def _documento_visible(db: AsyncSession, request: Request, documento_id: int):
    """El documento si el usuario puede verlo. Si esta restringido para el, responde 404 como si no existiera."""
    documento = await obtener_documento(db, documento_id)
    if not documento or documento.id in await documentos_ocultos(db, request):
        raise NotFoundException(detail="Documento no encontrado")
    return documento


class DocumentoController(Controller):
    path = "/documentos"
    tags = ["Documentos"]

    @get()
    async def listar(
        self,
        request: Request,
        db_session: AsyncSession,
        proyecto_id: int | None = None,
        carpeta_id: int | None = None,
        sin_carpeta: bool = False,
    ) -> list[DocumentoRespuesta]:
        await requerir_seccion(db_session, request, "documentos")
        ocultos = await documentos_ocultos(db_session, request)
        documentos = await obtener_documentos(db_session, proyecto_id, carpeta_id, sin_carpeta, ocultos)
        return await _respuestas_listado(db_session, documentos)

    @get("/buscar")
    async def buscar_contenido(
        self,
        request: Request,
        db_session: AsyncSession,
        proyecto_id: int,
        q: str,
        carpeta_id: int | None = None,
    ) -> list[ResultadoContenido]:
        """Busca informacion dentro de los archivos del proyecto (o de una carpeta y sus subcarpetas)."""
        await requerir_seccion(db_session, request, "documentos")
        q = q.strip()
        if len(q) < 3:
            return []
        documento_ids = None
        if carpeta_id is not None:
            documento_ids = await ids_documentos_en_carpeta(db_session, proyecto_id, carpeta_id)
        ocultos = await documentos_ocultos(db_session, request)
        resultados = await buscar_en_documentos(db_session, proyecto_id, q, documento_ids, documentos_ocultos=ocultos)
        return [ResultadoContenido(**r) for r in resultados]

    @get("/{documento_id:int}")
    async def obtener(self, request: Request, db_session: AsyncSession, documento_id: int) -> DocumentoRespuesta:
        await requerir_seccion(db_session, request, "documentos")
        documento = await _documento_visible(db_session, request, documento_id)
        return msgspec.convert(documento, DocumentoRespuesta, from_attributes=True)

    @get("/{documento_id:int}/archivo")
    async def archivo(self, request: Request, db_session: AsyncSession, documento_id: int) -> File:
        """Descarga el archivo de la version actual (los archivos no se sirven como estaticos)."""
        await requerir_seccion(db_session, request, "documentos")
        documento = await _documento_visible(db_session, request, documento_id)
        ruta = _ruta_local(documento.ruta)
        if not ruta.is_file():
            raise NotFoundException(detail="El archivo no esta en el servidor")
        nombre = f"{documento.nombre}.{documento.tipo}" if documento.tipo else documento.nombre
        return File(path=ruta, filename=nombre)

    @get("/{documento_id:int}/acceso")
    async def obtener_acceso(self, request: Request, db_session: AsyncSession, documento_id: int) -> DocumentoAcceso:
        await requerir_admin(db_session, request)
        documento = await obtener_documento(db_session, documento_id)
        if not documento:
            raise NotFoundException(detail="Documento no encontrado")
        return DocumentoAcceso(restringido=documento.restringido, usuario_ids=await obtener_accesos(db_session, documento_id))

    @put("/{documento_id:int}/acceso")
    async def actualizar_acceso(
        self, request: Request, db_session: AsyncSession, documento_id: int, data: DocumentoAcceso
    ) -> DocumentoAcceso:
        """Solo un administrador puede restringir un documento o elegir con quien compartirlo."""
        await requerir_admin(db_session, request)
        documento = await obtener_documento(db_session, documento_id)
        if not documento:
            raise NotFoundException(detail="Documento no encontrado")
        usuario_id = int(request.user["id"]) if request.user else None
        usuario_ids = await cambiar_acceso(db_session, documento, data.restringido, data.usuario_ids, usuario_id)
        return DocumentoAcceso(restringido=documento.restringido, usuario_ids=usuario_ids)

    @post("/upload")
    async def subir(
        self,
        request: Request,
        db_session: AsyncSession,
        data: Annotated[DocumentoSubida, Body(media_type=RequestEncodingType.MULTI_PART)],
    ) -> DocumentoRespuesta:
        await requerir_seccion(db_session, request, "documentos")
        contenido, extension, hash_archivo = await _leer_archivo(data.archivo)
        usuario_id = int(request.user["id"]) if request.user else None

        documento_data = DocumentoCrear(
            nombre=data.nombre,
            ruta=_guardar_en_disco(contenido, extension),
            proyecto_id=data.proyecto_id,
            tipo=extension.lstrip("."),
            carpeta_id=data.carpeta_id,
            usuario_id=usuario_id,
            hash=hash_archivo,
        )
        documento = await crear_documento(db_session, documento_data)
        return msgspec.convert(documento, DocumentoRespuesta, from_attributes=True)

    @post("/{documento_id:int}/version")
    async def subir_version(
        self,
        request: Request,
        db_session: AsyncSession,
        documento_id: int,
        data: Annotated[DocumentoVersionSubida, Body(media_type=RequestEncodingType.MULTI_PART)],
    ) -> DocumentoRespuesta:
        await requerir_seccion(db_session, request, "documentos")
        documento = await _documento_visible(db_session, request, documento_id)
        contenido, extension, hash_archivo = await _leer_archivo(data.archivo)
        # Mismo contenido que la version actual: no se crea una version nueva (version_actual no cambia)
        if hash_archivo == documento.hash:
            return msgspec.convert(documento, DocumentoRespuesta, from_attributes=True)

        usuario_id = int(request.user["id"]) if request.user else None

        update_data = DocumentoActualizar(
            nombre=data.nombre,
            tipo=data.tipo or extension.lstrip("."),
            ruta=_guardar_en_disco(contenido, extension),
            hash=hash_archivo,
        )
        documento_actualizado = await actualizar_documento(
            db_session, documento_id, update_data, notas=data.notas, usuario_id=usuario_id
        )
        return msgspec.convert(documento_actualizado, DocumentoRespuesta, from_attributes=True)

    @post()
    async def crear(self, request: Request, db_session: AsyncSession, data: DocumentoCrear) -> DocumentoRespuesta:
        await requerir_seccion(db_session, request, "documentos")
        documento = await crear_documento(db_session, data)
        return msgspec.convert(documento, DocumentoRespuesta, from_attributes=True)

    @put("/{documento_id:int}")
    async def actualizar(self, request: Request, db_session: AsyncSession, documento_id: int, data: DocumentoActualizar) -> DocumentoRespuesta:
        await requerir_seccion(db_session, request, "documentos")
        await _documento_visible(db_session, request, documento_id)
        documento = await actualizar_documento(db_session, documento_id, data)
        if not documento:
            raise NotFoundException(detail="Documento no encontrado")
        return msgspec.convert(documento, DocumentoRespuesta, from_attributes=True)

    @delete("/{documento_id:int}")
    async def eliminar(self, request: Request, db_session: AsyncSession, documento_id: int) -> None:
        await requerir_seccion(db_session, request, "documentos")
        await _documento_visible(db_session, request, documento_id)
        eliminado = await eliminar_documento(db_session, documento_id)
        if not eliminado:
            raise NotFoundException(detail="Documento no encontrado")
