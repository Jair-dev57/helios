from litestar import Controller, Request, get
from sqlalchemy.ext.asyncio import AsyncSession

from src.features.busqueda.schemas import RespuestaBusqueda
from src.features.busqueda.services import buscar
from src.features.documentos.services import documentos_ocultos
from src.features.espacios.services import proyectos_sin_acceso


class BusquedaController(Controller):
    path = "/busqueda"
    tags = ["Búsqueda"]  # noqa: RUF012

    @get("/")
    async def buscar_global(self, request: Request, db_session: AsyncSession, q: str) -> RespuestaBusqueda:
        if not q or len(q.strip()) < 2:
            return RespuestaBusqueda(proyectos=[], tareas=[], documentos=[], clientes=[])

        ocultos = await documentos_ocultos(db_session, request)
        resultados = await buscar(db_session, q.strip(), documentos_ocultos=ocultos)
        # Proyectos que no puede ver y sus tareas (sus documentos ya vienen fuera por documentos_ocultos)
        sin_acceso = await proyectos_sin_acceso(db_session, request)
        visibles = lambda lista: [r for r in lista if r.proyecto_id not in sin_acceso]  # noqa: E731
        return RespuestaBusqueda(
            proyectos=[r for r in resultados["proyectos"] if r.entidad_id not in sin_acceso],
            tareas=visibles(resultados["tareas"]),
            documentos=visibles(resultados["documentos"]),
            clientes=resultados["clientes"],
        )
