import uuid
from pathlib import Path
from typing import Annotated

import msgspec
from litestar import Controller, get, post, put, delete, Request
from litestar.enums import RequestEncodingType
from litestar.exceptions import NotFoundException, ValidationException
from litestar.params import Body
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.permisos import requerir_seccion
from src.features.documentos.schemas import (
    DocumentoCrear,
    DocumentoActualizar,
    DocumentoRespuesta,
    DocumentoSubida,
    DocumentoVersionSubida,
)
from src.features.documentos.services import (
    obtener_documentos,
    obtener_documento,
    crear_documento,
    actualizar_documento,
    eliminar_documento,
    datos_listado,
)

UPLOAD_DIR = Path("uploads/documentos")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

EXTENSIONES_PERMITIDAS = {
    ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx",
    ".txt", ".csv", ".png", ".jpg", ".jpeg",
}


async def _respuestas_listado(db: AsyncSession, documentos) -> list[DocumentoRespuesta]:
    datos = await datos_listado(db, documentos)
    respuestas = []
    for d in documentos:
        modificado_por, tamano = datos[d.id]
        respuesta = msgspec.convert(d, DocumentoRespuesta, from_attributes=True)
        respuestas.append(msgspec.structs.replace(respuesta, modificado_por=modificado_por, tamano=tamano))
    return respuestas


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
        documentos = await obtener_documentos(db_session, proyecto_id, carpeta_id, sin_carpeta)
        return await _respuestas_listado(db_session, documentos)

    @get("/{documento_id:int}")
    async def obtener(self, request: Request, db_session: AsyncSession, documento_id: int) -> DocumentoRespuesta:
        await requerir_seccion(db_session, request, "documentos")
        documento = await obtener_documento(db_session, documento_id)
        if not documento:
            raise NotFoundException(detail="Documento no encontrado")
        return msgspec.convert(documento, DocumentoRespuesta, from_attributes=True)

    @post("/upload")
    async def subir(
        self,
        request: Request,
        db_session: AsyncSession,
        data: Annotated[DocumentoSubida, Body(media_type=RequestEncodingType.MULTI_PART)],
    ) -> DocumentoRespuesta:
        await requerir_seccion(db_session, request, "documentos")
        extension = Path(data.archivo.filename).suffix.lower()
        if extension not in EXTENSIONES_PERMITIDAS:
            raise ValidationException(detail=f"Tipo de archivo no permitido: {extension}")

        nombre_archivo = f"{uuid.uuid4()}{extension}"
        ruta_disco = UPLOAD_DIR / nombre_archivo
        contenido = await data.archivo.read()
        ruta_disco.write_bytes(contenido)

        usuario_id = int(request.user["id"]) if request.user else None

        documento_data = DocumentoCrear(
            nombre=data.nombre,
            ruta=f"/uploads/documentos/{nombre_archivo}",
            proyecto_id=data.proyecto_id,
            tipo=extension.lstrip("."),
            carpeta_id=data.carpeta_id,
            usuario_id=usuario_id,
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
        documento = await obtener_documento(db_session, documento_id)
        if not documento:
            raise NotFoundException(detail="Documento no encontrado")

        extension = Path(data.archivo.filename).suffix.lower()
        if extension not in EXTENSIONES_PERMITIDAS:
            raise ValidationException(detail=f"Tipo de archivo no permitido: {extension}")

        nombre_archivo = f"{uuid.uuid4()}{extension}"
        ruta_disco = UPLOAD_DIR / nombre_archivo
        contenido = await data.archivo.read()
        ruta_disco.write_bytes(contenido)

        usuario_id = int(request.user["id"]) if request.user else None

        update_data = DocumentoActualizar(
            nombre=data.nombre,
            tipo=data.tipo or extension.lstrip("."),
            ruta=f"/uploads/documentos/{nombre_archivo}",
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
        documento = await actualizar_documento(db_session, documento_id, data)
        if not documento:
            raise NotFoundException(detail="Documento no encontrado")
        return msgspec.convert(documento, DocumentoRespuesta, from_attributes=True)

    @delete("/{documento_id:int}")
    async def eliminar(self, request: Request, db_session: AsyncSession, documento_id: int) -> None:
        await requerir_seccion(db_session, request, "documentos")
        eliminado = await eliminar_documento(db_session, documento_id)
        if not eliminado:
            raise NotFoundException(detail="Documento no encontrado")
