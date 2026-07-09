import uuid
from pathlib import Path
from typing import Annotated

import msgspec
from litestar import Controller, get, post, put, delete
from litestar.enums import RequestEncodingType
from litestar.exceptions import NotFoundException, ValidationException
from litestar.params import Body
from sqlalchemy.ext.asyncio import AsyncSession

from src.features.documentos.schemas import (
    DocumentoCrear,
    DocumentoActualizar,
    DocumentoRespuesta,
    DocumentoSubida,
)
from src.features.documentos.services import (
    obtener_documentos,
    obtener_documento,
    crear_documento,
    actualizar_documento,
    eliminar_documento,
)

UPLOAD_DIR = Path("uploads/documentos")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

EXTENSIONES_PERMITIDAS = {
    ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx",
    ".txt", ".csv", ".png", ".jpg", ".jpeg",
}


class DocumentoController(Controller):
    path = "/documentos"
    tags = ["Documentos"]

    @get()
    async def listar(self, db_session: AsyncSession) -> list[DocumentoRespuesta]:
        documentos = await obtener_documentos(db_session)
        return [msgspec.convert(d, DocumentoRespuesta, from_attributes=True) for d in documentos]

    @get("/{documento_id:int}")
    async def obtener(self, db_session: AsyncSession, documento_id: int) -> DocumentoRespuesta:
        documento = await obtener_documento(db_session, documento_id)
        if not documento:
            raise NotFoundException(detail="Documento no encontrado")
        return msgspec.convert(documento, DocumentoRespuesta, from_attributes=True)

    @post("/upload")
    async def subir(
        self,
        db_session: AsyncSession,
        data: Annotated[DocumentoSubida, Body(media_type=RequestEncodingType.MULTI_PART)],
    ) -> DocumentoRespuesta:
        extension = Path(data.archivo.filename).suffix.lower()
        if extension not in EXTENSIONES_PERMITIDAS:
            raise ValidationException(detail=f"Tipo de archivo no permitido: {extension}")

        nombre_archivo = f"{uuid.uuid4()}{extension}"
        ruta_disco = UPLOAD_DIR / nombre_archivo
        contenido = await data.archivo.read()
        ruta_disco.write_bytes(contenido)

        documento_data = DocumentoCrear(
            nombre=data.nombre,
            ruta=f"/uploads/documentos/{nombre_archivo}",
            proyecto_id=data.proyecto_id,
            tipo=extension.lstrip("."),
        )
        documento = await crear_documento(db_session, documento_data)
        return msgspec.convert(documento, DocumentoRespuesta, from_attributes=True)

    @post()
    async def crear(self, db_session: AsyncSession, data: DocumentoCrear) -> DocumentoRespuesta:
        documento = await crear_documento(db_session, data)
        return msgspec.convert(documento, DocumentoRespuesta, from_attributes=True)

    @put("/{documento_id:int}")
    async def actualizar(self, db_session: AsyncSession, documento_id: int, data: DocumentoActualizar) -> DocumentoRespuesta:
        documento = await actualizar_documento(db_session, documento_id, data)
        if not documento:
            raise NotFoundException(detail="Documento no encontrado")
        return msgspec.convert(documento, DocumentoRespuesta, from_attributes=True)

    @delete("/{documento_id:int}")
    async def eliminar(self, db_session: AsyncSession, documento_id: int) -> None:
        eliminado = await eliminar_documento(db_session, documento_id)
        if not eliminado:
            raise NotFoundException(detail="Documento no encontrado")