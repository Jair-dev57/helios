import msgspec
from litestar import Controller, get, post, put, delete, Request
from litestar.exceptions import NotFoundException
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.permisos import requerir_seccion
from src.features.carpetas.schemas import CarpetaCrear, CarpetaActualizar, CarpetaRespuesta
from src.features.carpetas.services import (
    obtener_carpetas,
    obtener_carpeta,
    crear_carpeta,
    actualizar_carpeta,
)
from src.features.papelera.services import mover_carpeta as mover_carpeta_a_papelera


class CarpetaController(Controller):
    path = "/carpetas"
    tags = ["Carpetas"]

    @get()
    async def listar(self, request: Request, db_session: AsyncSession, proyecto_id: int | None = None) -> list[CarpetaRespuesta]:
        await requerir_seccion(db_session, request, "documentos")
        carpetas = await obtener_carpetas(db_session, proyecto_id)
        return [msgspec.convert(c, CarpetaRespuesta, from_attributes=True) for c in carpetas]

    @get("/{carpeta_id:int}")
    async def obtener(self, request: Request, db_session: AsyncSession, carpeta_id: int) -> CarpetaRespuesta:
        await requerir_seccion(db_session, request, "documentos")
        carpeta = await obtener_carpeta(db_session, carpeta_id)
        if not carpeta:
            raise NotFoundException(detail="Carpeta no encontrada")
        return msgspec.convert(carpeta, CarpetaRespuesta, from_attributes=True)

    @post()
    async def crear(self, request: Request, db_session: AsyncSession, data: CarpetaCrear) -> CarpetaRespuesta:
        await requerir_seccion(db_session, request, "documentos")
        carpeta = await crear_carpeta(db_session, data)
        return msgspec.convert(carpeta, CarpetaRespuesta, from_attributes=True)

    @put("/{carpeta_id:int}")
    async def actualizar(self, request: Request, db_session: AsyncSession, carpeta_id: int, data: CarpetaActualizar) -> CarpetaRespuesta:
        await requerir_seccion(db_session, request, "documentos")
        carpeta = await actualizar_carpeta(db_session, carpeta_id, data)
        if not carpeta:
            raise NotFoundException(detail="Carpeta no encontrada")
        return msgspec.convert(carpeta, CarpetaRespuesta, from_attributes=True)

    @delete("/{carpeta_id:int}")
    async def eliminar(self, request: Request, db_session: AsyncSession, carpeta_id: int) -> None:
        """Manda la carpeta a la papelera junto con sus subcarpetas y archivos."""
        await requerir_seccion(db_session, request, "documentos")
        carpeta = await obtener_carpeta(db_session, carpeta_id)
        if not carpeta:
            raise NotFoundException(detail="Carpeta no encontrada")
        usuario_id = int(request.user["id"]) if request.user else None
        await mover_carpeta_a_papelera(db_session, carpeta, usuario_id)
