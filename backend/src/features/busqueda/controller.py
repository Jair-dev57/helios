from litestar import Controller, get
from sqlalchemy.ext.asyncio import AsyncSession

from src.features.busqueda.schemas import RespuestaBusqueda
from src.features.busqueda.services import buscar


class BusquedaController(Controller):
    path = "/busqueda"
    tags = ["Búsqueda"]  # noqa: RUF012

    @get("/")
    async def buscar_global(self, db_session: AsyncSession, q: str) -> RespuestaBusqueda:
        if not q or len(q.strip()) < 2:
            return RespuestaBusqueda(proyectos=[], tareas=[], documentos=[], clientes=[])

        resultados = await buscar(db_session, q.strip())
        return RespuestaBusqueda(
            proyectos=resultados["proyectos"],
            tareas=resultados["tareas"],
            documentos=resultados["documentos"],
            clientes=resultados["clientes"],
        )
