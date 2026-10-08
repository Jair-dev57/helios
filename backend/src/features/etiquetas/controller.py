from typing import Annotated

import msgspec
from litestar import Controller, Request, delete, get, post, put
from litestar.exceptions import ClientException, NotFoundException, ValidationException
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.permisos import requerir_seccion
from src.features.documentos.services import documentos_ocultos
from src.features.etiquetas import services

ColorHex = Annotated[str, msgspec.Meta(pattern=r"^#[0-9a-fA-F]{6}$")]
Nombre = Annotated[str, msgspec.Meta(min_length=1, max_length=40)]


class Etiqueta(msgspec.Struct):
    id: int
    proyecto_id: int
    nombre: str
    color: str
    # Documentos visibles con esta etiqueta
    documentos: int


class EtiquetaCrear(msgspec.Struct):
    proyecto_id: int
    nombre: Nombre
    color: ColorHex


class EtiquetaActualizar(msgspec.Struct):
    nombre: Nombre | None = None
    color: ColorHex | None = None


def _nombre_limpio(nombre: str) -> str:
    limpio = " ".join(nombre.split())
    if not limpio:
        raise ValidationException(detail="La etiqueta necesita un nombre")
    return limpio


class EtiquetaController(Controller):
    path = "/etiquetas"
    tags = ["Etiquetas"]

    @get()
    async def listar(self, request: Request, db_session: AsyncSession, proyecto_id: int) -> list[Etiqueta]:
        await requerir_seccion(db_session, request, "documentos")
        ocultos = await documentos_ocultos(db_session, request)
        return [Etiqueta(**e) for e in await services.listar(db_session, proyecto_id, ocultos)]

    @post()
    async def crear(self, request: Request, db_session: AsyncSession, data: EtiquetaCrear) -> Etiqueta:
        await requerir_seccion(db_session, request, "documentos")
        nombre = _nombre_limpio(data.nombre)
        if await services.nombre_ocupado(db_session, data.proyecto_id, nombre):
            raise ClientException(status_code=409, detail=f"Ya existe la etiqueta «{nombre}»")
        return Etiqueta(**await services.crear(db_session, data.proyecto_id, nombre, data.color))

    @put("/{etiqueta_id:int}", status_code=204)
    async def actualizar(self, request: Request, db_session: AsyncSession, etiqueta_id: int, data: EtiquetaActualizar) -> None:
        await requerir_seccion(db_session, request, "documentos")
        etiqueta = await services.obtener(db_session, etiqueta_id)
        if not etiqueta:
            raise NotFoundException(detail="Etiqueta no encontrada")
        nombre = _nombre_limpio(data.nombre) if data.nombre is not None else None
        if nombre and await services.nombre_ocupado(db_session, etiqueta.proyecto_id, nombre, excepto=etiqueta_id):
            raise ClientException(status_code=409, detail=f"Ya existe la etiqueta «{nombre}»")
        await services.actualizar(db_session, etiqueta, nombre, data.color)

    @delete("/{etiqueta_id:int}")
    async def eliminar(self, request: Request, db_session: AsyncSession, etiqueta_id: int) -> None:
        """Quita la etiqueta de todos los documentos (los documentos no se tocan)."""
        await requerir_seccion(db_session, request, "documentos")
        etiqueta = await services.obtener(db_session, etiqueta_id)
        if not etiqueta:
            raise NotFoundException(detail="Etiqueta no encontrada")
        await services.eliminar(db_session, etiqueta)
