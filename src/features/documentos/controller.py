from litestar import Controller, get, post, put, delete
from litestar.exceptions import NotFoundException
from sqlalchemy.ext.asyncio import AsyncSession
from src.features.documentos.schemas import DocumentoCrear, DocumentoActualizar, DocumentoRespuesta
from src.features.documentos.services import (
    obtener_documentos,
    obtener_documento,
    crear_documento,
    actualizar_documento,
    eliminar_documento
)

class DocumentoController(Controller):
    path = "/documentos"

    @get()
    async def listar(self, db_session: AsyncSession) -> list[DocumentoRespuesta]:
        return await obtener_documentos(db_session)

    @get("/{documento_id:int}")
    async def obtener(self, db_session: AsyncSession, documento_id: int) -> DocumentoRespuesta:
        documento = await obtener_documento(db_session, documento_id)
        if not documento:
            raise NotFoundException(detail="Documento no encontrado")
        return documento

    @post()
    async def crear(self, db_session: AsyncSession, data: DocumentoCrear) -> DocumentoRespuesta:
        return await crear_documento(db_session, data)

    @put("/{documento_id:int}")
    async def actualizar(self, db_session: AsyncSession, documento_id: int, data: DocumentoActualizar) -> DocumentoRespuesta:
        documento = await actualizar_documento(db_session, documento_id, data)
        if not documento:
            raise NotFoundException(detail="Documento no encontrado")
        return documento

    @delete("/{documento_id:int}")
    async def eliminar(self, db_session: AsyncSession, documento_id: int) -> None:
        eliminado = await eliminar_documento(db_session, documento_id)
        if not eliminado:
            raise NotFoundException(detail="Documento no encontrado")