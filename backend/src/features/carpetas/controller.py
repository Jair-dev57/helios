import tempfile
import zipfile
from pathlib import Path

import anyio
import msgspec
from litestar import Controller, get, post, put, delete, Request
from litestar.background_tasks import BackgroundTask
from litestar.response import File
from litestar.exceptions import ClientException, NotFoundException
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.permisos import requerir_seccion
from src.features.carpetas.schemas import CarpetaCrear, CarpetaActualizar, CarpetaRespuesta
from src.features.carpetas.services import (
    obtener_carpetas,
    obtener_carpeta,
    crear_carpeta,
    actualizar_carpeta,
    contenido_para_zip,
)
from src.features.documentos.controller import SIN_CACHE
from src.features.documentos.extraccion import _ruta_local
from src.features.documentos.services import bloqueados_por_otros, documentos_ocultos
from src.features.papelera.services import subarbol, mover_carpeta as mover_carpeta_a_papelera


def _armar_zip(entradas: list[tuple[str, str | None]]) -> Path:
    """Escribe el ZIP en un archivo temporal (se borra despues de enviarlo)."""
    with tempfile.NamedTemporaryFile(suffix=".zip", delete=False) as temporal:
        destino = Path(temporal.name)
    with zipfile.ZipFile(destino, "w", zipfile.ZIP_DEFLATED) as zip_:
        for nombre, ruta in entradas:
            if ruta is None:
                zip_.writestr(nombre, "")
            elif (archivo := _ruta_local(ruta)).is_file():
                zip_.write(archivo, nombre)
    return destino


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

    @get("/{carpeta_id:int}/zip")
    async def zip(self, request: Request, db_session: AsyncSession, carpeta_id: int) -> File:
        """Descarga la carpeta con sus subcarpetas y archivos (version actual) en un ZIP."""
        await requerir_seccion(db_session, request, "documentos")
        carpeta = await obtener_carpeta(db_session, carpeta_id)
        if not carpeta:
            raise NotFoundException(detail="Carpeta no encontrada")
        nombre = carpeta.nombre
        entradas = await contenido_para_zip(db_session, carpeta, await documentos_ocultos(db_session, request))
        ruta = await anyio.to_thread.run_sync(_armar_zip, entradas)
        return File(
            path=ruta,
            filename=f"{nombre}.zip",
            headers=SIN_CACHE,
            background=BackgroundTask(ruta.unlink, missing_ok=True),
        )

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
        bloqueados = await bloqueados_por_otros(db_session, await subarbol(db_session, carpeta_id), usuario_id)
        if bloqueados:
            raise ClientException(
                status_code=409,
                detail=f"No se puede borrar: alguien está editando {', '.join(f'«{n}»' for n in bloqueados[:3])}"
                + ("…" if len(bloqueados) > 3 else ""),
            )
        await mover_carpeta_a_papelera(db_session, carpeta, usuario_id)
