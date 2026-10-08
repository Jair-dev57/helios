from litestar import Controller, Request, get, post, put
from litestar.exceptions import ValidationException
from msgspec import Struct
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.permisos import requerir_seccion
from src.features.carpetas.services import obtener_carpeta
from src.features.documentos.controller import _documento_visible
from src.features.documentos.services import documentos_ocultos
from src.features.favoritos import services


class Favoritos(Struct):
    documentos: list[int]
    carpetas: list[int]


class MarcaFavorito(Struct):
    favorito: bool
    documento_id: int | None = None
    carpeta_id: int | None = None


class FavoritoController(Controller):
    """Favoritos (estrella) y archivos abiertos recientemente: de cada usuario."""
    path = "/"
    tags = ["Favoritos y recientes"]

    @get("/favoritos")
    async def favoritos(self, request: Request, db_session: AsyncSession, proyecto_id: int) -> Favoritos:
        await requerir_seccion(db_session, request, "documentos")
        documentos, carpetas = await services.favoritos(db_session, int(request.user["id"]), proyecto_id)
        ocultos = await documentos_ocultos(db_session, request)
        return Favoritos(documentos=[d for d in documentos if d not in ocultos], carpetas=carpetas)

    @put("/favoritos", status_code=204)
    async def marcar(self, request: Request, db_session: AsyncSession, data: MarcaFavorito) -> None:
        await requerir_seccion(db_session, request, "documentos")
        if (data.documento_id is None) == (data.carpeta_id is None):
            raise ValidationException(detail="Indica documento_id o carpeta_id")
        if data.documento_id is not None:
            await _documento_visible(db_session, request, data.documento_id)
        elif not await obtener_carpeta(db_session, data.carpeta_id):
            raise ValidationException(detail="Carpeta no encontrada")
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
        ocultos = await documentos_ocultos(db_session, request)
        return await services.recientes(db_session, int(request.user["id"]), proyecto_id, ocultos, min(limite, 20))
