import msgspec
from litestar import Controller, get, post, put, delete, Request
from litestar.exceptions import NotFoundException
from sqlalchemy.ext.asyncio import AsyncSession
from src.core.permisos import requerir_seccion
from src.features.proyectos.schemas import ProyectoCrear, ProyectoActualizar, ProyectoRespuesta
from src.features.proyectos.services import (
    obtener_proyectos,
    obtener_proyecto,
    crear_proyecto,
    actualizar_proyecto,
    eliminar_proyecto
)


class ProyectoController(Controller):
    path = "/proyectos"
    tags = ["Proyectos"]

    @get()
    async def listar(self, request: Request, db_session: AsyncSession) -> list[ProyectoRespuesta]:
        await requerir_seccion(db_session, request, "proyectos")
        proyectos = await obtener_proyectos(db_session)
        return [msgspec.convert(p, ProyectoRespuesta, from_attributes=True) for p in proyectos]

    @get("/{proyecto_id:int}")
    async def obtener(self, request: Request, db_session: AsyncSession, proyecto_id: int) -> ProyectoRespuesta:
        await requerir_seccion(db_session, request, "proyectos")
        proyecto = await obtener_proyecto(db_session, proyecto_id)
        if not proyecto:
            raise NotFoundException(detail="Proyecto no encontrado")
        return msgspec.convert(proyecto, ProyectoRespuesta, from_attributes=True)

    @post()
    async def crear(self, request: Request, db_session: AsyncSession, data: ProyectoCrear) -> ProyectoRespuesta:
        await requerir_seccion(db_session, request, "proyectos")
        usuario_id = int(request.user["id"]) if request.user else None
        proyecto = await crear_proyecto(db_session, data, usuario_id)
        return msgspec.convert(proyecto, ProyectoRespuesta, from_attributes=True)

    @put("/{proyecto_id:int}")
    async def actualizar(self, request: Request, db_session: AsyncSession, proyecto_id: int, data: ProyectoActualizar) -> ProyectoRespuesta:
        await requerir_seccion(db_session, request, "proyectos")
        usuario_id = int(request.user["id"]) if request.user else None
        proyecto = await actualizar_proyecto(db_session, proyecto_id, data, usuario_id)
        if not proyecto:
            raise NotFoundException(detail="Proyecto no encontrado")
        return msgspec.convert(proyecto, ProyectoRespuesta, from_attributes=True)

    @delete("/{proyecto_id:int}")
    async def eliminar(self, request: Request, db_session: AsyncSession, proyecto_id: int) -> None:
        await requerir_seccion(db_session, request, "proyectos")
        usuario_id = int(request.user["id"]) if request.user else None
        eliminado = await eliminar_proyecto(db_session, proyecto_id, usuario_id)
        if not eliminado:
            raise NotFoundException(detail="Proyecto no encontrado")
