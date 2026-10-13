import msgspec
from litestar import Controller, get, post, put, delete, Request
from litestar.exceptions import NotFoundException, ValidationException
from sqlalchemy.ext.asyncio import AsyncSession
from src.core.permisos import requerir_seccion, id_usuario
from src.features.espacios.services import requerir_acceso
from src.features.proyectos.schemas import ProyectoCrear, ProyectoActualizar, ProyectoRespuesta
from src.features.proyectos.services import (
    obtener_proyectos,
    obtener_proyecto,
    crear_proyecto,
    actualizar_proyecto,
    eliminar_proyecto
)


async def _solo_proyectos(db: AsyncSession, proyecto_id: int) -> None:
    """Los espacios de archivos se editan desde /espacios, no como proyectos."""
    proyecto = await obtener_proyecto(db, proyecto_id)
    if proyecto and proyecto.tipo != "proyecto":
        raise NotFoundException(detail="Proyecto no encontrado")


async def _validar_area(db: AsyncSession, request: Request, area_id: int | None) -> None:
    """El area de un proyecto debe ser un espacio de tipo 'equipo' que el usuario pueda ver."""
    if not area_id:
        return
    area = await obtener_proyecto(db, area_id)
    if not area or area.tipo != "equipo":
        raise ValidationException(detail="Área no válida")
    await requerir_acceso(db, request, area_id)


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
        proyecto = await obtener_proyecto(db_session, proyecto_id)
        # Un espacio de archivos se abre con la seccion «archivos» (la pagina redirige a su ruta)
        await requerir_seccion(db_session, request, "archivos" if proyecto and proyecto.tipo != "proyecto" else "proyectos")
        if not proyecto:
            raise NotFoundException(detail="Proyecto no encontrado")
        await requerir_acceso(db_session, request, proyecto_id)
        return msgspec.convert(proyecto, ProyectoRespuesta, from_attributes=True)

    @post()
    async def crear(self, request: Request, db_session: AsyncSession, data: ProyectoCrear) -> ProyectoRespuesta:
        await requerir_seccion(db_session, request, "proyectos")
        await _validar_area(db_session, request, data.area_id)
        usuario_id = id_usuario(request)
        proyecto = await crear_proyecto(db_session, data, usuario_id)
        return msgspec.convert(proyecto, ProyectoRespuesta, from_attributes=True)

    @put("/{proyecto_id:int}")
    async def actualizar(self, request: Request, db_session: AsyncSession, proyecto_id: int, data: ProyectoActualizar) -> ProyectoRespuesta:
        await requerir_seccion(db_session, request, "proyectos")
        await _solo_proyectos(db_session, proyecto_id)
        if data.area_id is not msgspec.UNSET:
            await _validar_area(db_session, request, data.area_id)
        usuario_id = id_usuario(request)
        proyecto = await actualizar_proyecto(db_session, proyecto_id, data, usuario_id)
        if not proyecto:
            raise NotFoundException(detail="Proyecto no encontrado")
        return msgspec.convert(proyecto, ProyectoRespuesta, from_attributes=True)

    @delete("/{proyecto_id:int}")
    async def eliminar(self, request: Request, db_session: AsyncSession, proyecto_id: int) -> None:
        await requerir_seccion(db_session, request, "proyectos")
        await _solo_proyectos(db_session, proyecto_id)
        usuario_id = id_usuario(request)
        eliminado = await eliminar_proyecto(db_session, proyecto_id, usuario_id)
        if not eliminado:
            raise NotFoundException(detail="Proyecto no encontrado")
