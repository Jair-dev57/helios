import msgspec
from litestar import Controller, get, post, put, delete
from litestar.exceptions import NotFoundException
from sqlalchemy.ext.asyncio import AsyncSession

from src.features.carpetas.schemas import CarpetaCrear, CarpetaActualizar, CarpetaRespuesta
from src.features.carpetas.services import (
    obtener_carpetas,
    obtener_carpeta,
    crear_carpeta,
    actualizar_carpeta,
    eliminar_carpeta,
)


class CarpetaController(Controller):
    path = "/carpetas"
    tags = ["Carpetas"]

    @get()
    async def listar(self, db_session: AsyncSession, proyecto_id: int | None = None) -> list[CarpetaRespuesta]:
        carpetas = await obtener_carpetas(db_session, proyecto_id)
        return [msgspec.convert(c, CarpetaRespuesta, from_attributes=True) for c in carpetas]

    @get("/{carpeta_id:int}")
    async def obtener(self, db_session: AsyncSession, carpeta_id: int) -> CarpetaRespuesta:
        carpeta = await obtener_carpeta(db_session, carpeta_id)
        if not carpeta:
            raise NotFoundException(detail="Carpeta no encontrada")
        return msgspec.convert(carpeta, CarpetaRespuesta, from_attributes=True)

    @post()
    async def crear(self, db_session: AsyncSession, data: CarpetaCrear) -> CarpetaRespuesta:
        carpeta = await crear_carpeta(db_session, data)
        return msgspec.convert(carpeta, CarpetaRespuesta, from_attributes=True)

    @put("/{carpeta_id:int}")
    async def actualizar(self, db_session: AsyncSession, carpeta_id: int, data: CarpetaActualizar) -> CarpetaRespuesta:
        carpeta = await actualizar_carpeta(db_session, carpeta_id, data)
        if not carpeta:
            raise NotFoundException(detail="Carpeta no encontrada")
        return msgspec.convert(carpeta, CarpetaRespuesta, from_attributes=True)

    @delete("/{carpeta_id:int}")
    async def eliminar(self, db_session: AsyncSession, carpeta_id: int) -> None:
        eliminada = await eliminar_carpeta(db_session, carpeta_id)
        if not eliminada:
            raise NotFoundException(detail="Carpeta no encontrada")