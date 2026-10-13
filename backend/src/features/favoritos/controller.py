from datetime import datetime

import msgspec
from litestar import Controller, Request, get, post, put
from litestar.exceptions import NotFoundException, ValidationException
from msgspec import Struct
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.permisos import requerir_seccion
from src.features.carpetas.services import obtener_carpeta
from src.features.documentos.controller import _documento_visible
from src.features.documentos.services import documentos_ocultos
from src.features.enlaces.schemas import ObjetoCompartido
from src.features.favoritos import services
from src.features.proyectos.services import obtener_proyecto
from src.features.espacios.services import proyectos_sin_acceso, requerir_acceso


class Favoritos(Struct):
    documentos: list[int]
    carpetas: list[int]


class MarcaFavorito(Struct):
    favorito: bool
    documento_id: int | None = None
    carpeta_id: int | None = None
    proyecto_id: int | None = None


class ProyectoReciente(Struct):
    proyecto_id: int
    visto_at: datetime


async def _proyecto_visible(db: AsyncSession, request: Request, proyecto_id: int) -> None:
    """Proyecto (no espacio de archivos) al que el usuario tiene acceso."""
    proyecto = await obtener_proyecto(db, proyecto_id)
    if not proyecto or proyecto.tipo != "proyecto":
        raise NotFoundException(detail="Proyecto no encontrado")
    await requerir_acceso(db, request, proyecto_id)


class ObjetoReciente(ObjetoCompartido, kw_only=True):
    visto_at: datetime


class FavoritoController(Controller):
    """Favoritos (estrella) y abiertos recientemente, de archivos y de proyectos: de cada usuario."""
    path = "/"
    tags = ["Favoritos y recientes"]

    @get("/favoritos")
    async def favoritos(self, request: Request, db_session: AsyncSession, proyecto_id: int) -> Favoritos:
        await requerir_seccion(db_session, request, "documentos")
        await requerir_acceso(db_session, request, proyecto_id)
        documentos, carpetas = await services.favoritos(db_session, int(request.user["id"]), proyecto_id)
        ocultos = await documentos_ocultos(db_session, request)
        return Favoritos(documentos=[d for d in documentos if d not in ocultos], carpetas=carpetas)

    @get("/favoritos/todo")
    async def favoritos_todo(self, request: Request, db_session: AsyncSession) -> list[ObjetoCompartido]:
        """Favoritos del menu Archivos: carpetas y documentos con estrella en todos los proyectos y espacios."""
        await requerir_seccion(db_session, request, "archivos")
        await requerir_seccion(db_session, request, "documentos")
        objetos = await services.favoritos_global(
            db_session, int(request.user["id"]),
            await documentos_ocultos(db_session, request), await proyectos_sin_acceso(db_session, request),
        )
        return msgspec.convert(objetos, list[ObjetoCompartido])

    @put("/favoritos", status_code=204)
    async def marcar(self, request: Request, db_session: AsyncSession, data: MarcaFavorito) -> None:
        if sum(x is not None for x in (data.documento_id, data.carpeta_id, data.proyecto_id)) != 1:
            raise ValidationException(detail="Indica documento_id, carpeta_id o proyecto_id")
        if data.proyecto_id is not None:
            await requerir_seccion(db_session, request, "proyectos")
            await _proyecto_visible(db_session, request, data.proyecto_id)
            await services.marcar(db_session, int(request.user["id"]), None, None, data.favorito, data.proyecto_id)
            return
        await requerir_seccion(db_session, request, "documentos")
        if data.documento_id is not None:
            await _documento_visible(db_session, request, data.documento_id)
        else:
            carpeta = await obtener_carpeta(db_session, data.carpeta_id)
            if not carpeta:
                raise ValidationException(detail="Carpeta no encontrada")
            await requerir_acceso(db_session, request, carpeta.proyecto_id)
        await services.marcar(db_session, int(request.user["id"]), data.documento_id, data.carpeta_id, data.favorito)

    @post("/documentos/{documento_id:int}/visto", status_code=204)
    async def visto(self, request: Request, db_session: AsyncSession, documento_id: int) -> None:
        """Se llama al abrir un documento en el visor."""
        await requerir_seccion(db_session, request, "documentos")
        await _documento_visible(db_session, request, documento_id)
        await services.registrar_visto(db_session, int(request.user["id"]), documento_id)

    @get("/recientes")
    async def recientes(self, request: Request, db_session: AsyncSession, proyecto_id: int, limite: int = 6) -> list[int]:
        await requerir_seccion(db_session, request, "documentos")
        await requerir_acceso(db_session, request, proyecto_id)
        ocultos = await documentos_ocultos(db_session, request)
        return await services.recientes(db_session, int(request.user["id"]), proyecto_id, ocultos, min(limite, 20))

    @get("/recientes/todo")
    async def recientes_todo(self, request: Request, db_session: AsyncSession, limite: int = 50) -> list[ObjetoReciente]:
        """Recientes del menu Archivos: documentos abiertos en todos los proyectos y espacios."""
        await requerir_seccion(db_session, request, "archivos")
        await requerir_seccion(db_session, request, "documentos")
        objetos = await services.recientes_global(
            db_session, int(request.user["id"]),
            await documentos_ocultos(db_session, request), await proyectos_sin_acceso(db_session, request), min(limite, 100),
        )
        return msgspec.convert(objetos, list[ObjetoReciente])

    @get("/proyectos/favoritos")
    async def proyectos_favoritos(self, request: Request, db_session: AsyncSession) -> list[int]:
        """Favoritos de Mis proyectos: ids de los proyectos con estrella."""
        await requerir_seccion(db_session, request, "proyectos")
        return await services.proyectos_favoritos(db_session, int(request.user["id"]))

    @post("/proyectos/{proyecto_id:int}/visto", status_code=204)
    async def proyecto_visto(self, request: Request, db_session: AsyncSession, proyecto_id: int) -> None:
        """Se llama al abrir un proyecto."""
        await requerir_seccion(db_session, request, "proyectos")
        await _proyecto_visible(db_session, request, proyecto_id)
        await services.registrar_proyecto_visto(db_session, int(request.user["id"]), proyecto_id)

    @get("/proyectos/recientes")
    async def proyectos_recientes(self, request: Request, db_session: AsyncSession, limite: int = 30) -> list[ProyectoReciente]:
        """Recientes de Mis proyectos: proyectos abiertos, el mas reciente primero."""
        await requerir_seccion(db_session, request, "proyectos")
        filas = await services.proyectos_recientes(db_session, int(request.user["id"]), min(limite, 100))
        return msgspec.convert(filas, list[ProyectoReciente])
