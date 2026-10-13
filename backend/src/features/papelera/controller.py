import msgspec
from litestar import Controller, Request, delete, get, post
from litestar.exceptions import NotFoundException
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.permisos import requerir_admin, requerir_seccion, id_usuario
from src.features.documentos.services import documentos_ocultos
from src.features.papelera.schemas import ElementoPapelera, ElementoPapeleraGlobal, PapeleraVaciada, Restaurado, TipoElemento
from src.features.papelera.services import eliminar_definitivamente, listar, listar_global, obtener, restaurar, vaciar
from src.features.espacios.services import proyectos_sin_acceso, requerir_acceso


async def _elemento_visible(db: AsyncSession, request: Request, tipo: TipoElemento, elemento_id: int):
    """El elemento de la papelera si el usuario puede verlo (los documentos restringidos ajenos dan 404)."""
    elemento = await obtener(db, tipo, elemento_id)
    if not elemento or (tipo == "documento" and elemento.id in await documentos_ocultos(db, request, incluir_papelera=False)):
        raise NotFoundException(detail="No esta en la papelera")
    await requerir_acceso(db, request, elemento.proyecto_id)
    return elemento


class PapeleraController(Controller):
    path = "/papelera"
    tags = ["Papelera"]

    @get()
    async def listar(self, request: Request, db_session: AsyncSession, proyecto_id: int) -> list[ElementoPapelera]:
        await requerir_seccion(db_session, request, "documentos")
        await requerir_acceso(db_session, request, proyecto_id)
        ocultos = await documentos_ocultos(db_session, request, incluir_papelera=False)
        elementos = await listar(db_session, proyecto_id, ocultos)
        return [msgspec.convert(e, ElementoPapelera) for e in elementos]

    @get("/todo")
    async def listar_todo(self, request: Request, db_session: AsyncSession) -> list[ElementoPapeleraGlobal]:
        """Papelera del menu Archivos: lo borrado en todos los proyectos y espacios del usuario."""
        await requerir_seccion(db_session, request, "archivos")
        await requerir_seccion(db_session, request, "documentos")
        ocultos = await documentos_ocultos(db_session, request, incluir_papelera=False)
        elementos = await listar_global(db_session, ocultos, await proyectos_sin_acceso(db_session, request))
        return [msgspec.convert(e, ElementoPapeleraGlobal) for e in elementos]

    @post("/{tipo:str}/{elemento_id:int}/restaurar", status_code=200)
    async def restaurar(
        self, request: Request, db_session: AsyncSession, tipo: TipoElemento, elemento_id: int
    ) -> Restaurado:
        """Cualquiera con acceso a documentos puede restaurar."""
        await requerir_seccion(db_session, request, "documentos")
        elemento = await _elemento_visible(db_session, request, tipo, elemento_id)
        return Restaurado(carpeta_id=await restaurar(db_session, elemento, id_usuario(request)))

    @delete("/{tipo:str}/{elemento_id:int}")
    async def eliminar(self, request: Request, db_session: AsyncSession, tipo: TipoElemento, elemento_id: int) -> None:
        """Eliminar para siempre: solo administradores."""
        await requerir_admin(db_session, request)
        elemento = await _elemento_visible(db_session, request, tipo, elemento_id)
        await eliminar_definitivamente(db_session, elemento, id_usuario(request))

    @post("/vaciar", status_code=200)
    async def vaciar(self, request: Request, db_session: AsyncSession, proyecto_id: int) -> PapeleraVaciada:
        """Eliminar para siempre todo lo de la papelera del proyecto: solo administradores."""
        await requerir_admin(db_session, request)
        await requerir_acceso(db_session, request, proyecto_id)
        return PapeleraVaciada(elementos=await vaciar(db_session, proyecto_id, id_usuario(request)))
