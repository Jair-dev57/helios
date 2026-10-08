import msgspec
from litestar import Controller, Request, delete, get, post
from litestar.exceptions import NotFoundException
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.permisos import requerir_admin, requerir_seccion
from src.features.documentos.services import documentos_ocultos
from src.features.papelera.schemas import ElementoPapelera, PapeleraVaciada, Restaurado, TipoElemento
from src.features.papelera.services import eliminar_definitivamente, listar, obtener, restaurar, vaciar


def _usuario_id(request: Request) -> int | None:
    return int(request.user["id"]) if request.user else None


async def _elemento_visible(db: AsyncSession, request: Request, tipo: TipoElemento, elemento_id: int):
    """El elemento de la papelera si el usuario puede verlo (los documentos restringidos ajenos dan 404)."""
    elemento = await obtener(db, tipo, elemento_id)
    if not elemento or (tipo == "documento" and elemento.id in await documentos_ocultos(db, request, incluir_papelera=False)):
        raise NotFoundException(detail="No esta en la papelera")
    return elemento


class PapeleraController(Controller):
    path = "/papelera"
    tags = ["Papelera"]

    @get()
    async def listar(self, request: Request, db_session: AsyncSession, proyecto_id: int) -> list[ElementoPapelera]:
        await requerir_seccion(db_session, request, "documentos")
        ocultos = await documentos_ocultos(db_session, request, incluir_papelera=False)
        elementos = await listar(db_session, proyecto_id, ocultos)
        return [msgspec.convert(e, ElementoPapelera) for e in elementos]

    @post("/{tipo:str}/{elemento_id:int}/restaurar", status_code=200)
    async def restaurar(
        self, request: Request, db_session: AsyncSession, tipo: TipoElemento, elemento_id: int
    ) -> Restaurado:
        """Cualquiera con acceso a documentos puede restaurar."""
        await requerir_seccion(db_session, request, "documentos")
        elemento = await _elemento_visible(db_session, request, tipo, elemento_id)
        return Restaurado(carpeta_id=await restaurar(db_session, elemento, _usuario_id(request)))

    @delete("/{tipo:str}/{elemento_id:int}")
    async def eliminar(self, request: Request, db_session: AsyncSession, tipo: TipoElemento, elemento_id: int) -> None:
        """Eliminar para siempre: solo administradores."""
        await requerir_admin(db_session, request)
        elemento = await _elemento_visible(db_session, request, tipo, elemento_id)
        await eliminar_definitivamente(db_session, elemento, _usuario_id(request))

    @post("/vaciar", status_code=200)
    async def vaciar(self, request: Request, db_session: AsyncSession, proyecto_id: int) -> PapeleraVaciada:
        """Eliminar para siempre todo lo de la papelera del proyecto: solo administradores."""
        await requerir_admin(db_session, request)
        return PapeleraVaciada(elementos=await vaciar(db_session, proyecto_id, _usuario_id(request)))
