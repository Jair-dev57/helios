from litestar import Controller, Request, get
from sqlalchemy.ext.asyncio import AsyncSession

from src.features.busqueda.schemas import RespuestaBusqueda
from src.features.busqueda.services import buscar
from src.features.documentos.services import documentos_ocultos


class BusquedaController(Controller):
    path = "/busqueda"
    tags = ["Búsqueda"]  # noqa: RUF012

    @get("/")
    async def buscar_global(self, request: Request, db_session: AsyncSession, q: str) -> RespuestaBusqueda:
        if not q or len(q.strip()) < 2:
            return RespuestaBusqueda(proyectos=[], tareas=[], documentos=[], clientes=[])

        ocultos = await documentos_ocultos(db_session, request)
        resultados = await buscar(db_session, q.strip(), documentos_ocultos=ocultos)
        return RespuestaBusqueda(
            proyectos=resultados["proyectos"],
            tareas=resultados["tareas"],
            documentos=resultados["documentos"],
            clientes=resultados["clientes"],
        )
