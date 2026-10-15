import msgspec
from litestar import Controller, get, post, put, delete, Request
from litestar.exceptions import NotFoundException, PermissionDeniedException, ValidationException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from src.core.permisos import es_admin, requerir_seccion, id_usuario
from src.features.espacios.services import ocultos_para, proyectos_sin_acceso, requerir_acceso
from src.features.proyectos.models import ProyectoModel
from src.features.proyectos.schemas import Asignable, ProyectoCrear, ProyectoActualizar, ProyectoRespuesta
from src.features.proyectos.services import (
    obtener_proyectos,
    obtener_proyecto,
    crear_proyecto,
    actualizar_proyecto,
    eliminar_proyecto,
    contenido_proyecto,
    miembros_de,
)


async def _respuestas(db: AsyncSession, proyectos: list[ProyectoModel]) -> list[ProyectoRespuesta]:
    miembros = await miembros_de(db, [p.id for p in proyectos])
    respuestas = []
    for p in proyectos:
        r = msgspec.convert(p, ProyectoRespuesta, from_attributes=True)
        r.miembro_ids = miembros[p.id]
        respuestas.append(r)
    return respuestas


def _validar_acceso(acceso: str, area_id: int | None) -> None:
    if acceso == "equipo" and not area_id:
        raise ValidationException(detail="Elige el equipo que puede ver el proyecto")


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
        sin_acceso = await proyectos_sin_acceso(db_session, request)
        proyectos = [p for p in await obtener_proyectos(db_session) if p.id not in sin_acceso]
        return await _respuestas(db_session, proyectos)

    @get("/{proyecto_id:int}")
    async def obtener(self, request: Request, db_session: AsyncSession, proyecto_id: int) -> ProyectoRespuesta:
        proyecto = await obtener_proyecto(db_session, proyecto_id)
        # Un espacio de archivos se abre con la seccion «archivos» (la pagina redirige a su ruta)
        await requerir_seccion(db_session, request, "archivos" if proyecto and proyecto.tipo != "proyecto" else "proyectos")
        if not proyecto:
            raise NotFoundException(detail="Proyecto no encontrado")
        await requerir_acceso(db_session, request, proyecto_id)
        return (await _respuestas(db_session, [proyecto]))[0]

    @get("/{proyecto_id:int}/asignables")
    async def asignables(self, request: Request, db_session: AsyncSession, proyecto_id: int) -> list[Asignable]:
        """Personas a las que se les pueden asignar tareas del proyecto: las activas que pueden verlo."""
        from src.features.auth.models import UsuarioModel

        await requerir_seccion(db_session, request, "proyectos")
        await _solo_proyectos(db_session, proyecto_id)
        await requerir_acceso(db_session, request, proyecto_id)
        filas = (await db_session.execute(
            select(UsuarioModel).where(UsuarioModel.activo.is_(True)).order_by(UsuarioModel.nombre)
        )).scalars().all()
        return [
            Asignable(id=u.id, nombre=u.nombre, avatar_url=u.avatar_url)
            for u in filas
            if proyecto_id not in await ocultos_para(db_session, u.id, u.es_administrador)
        ]

    @post()
    async def crear(self, request: Request, db_session: AsyncSession, data: ProyectoCrear) -> ProyectoRespuesta:
        await requerir_seccion(db_session, request, "proyectos")
        await _validar_area(db_session, request, data.area_id)
        _validar_acceso(data.acceso, data.area_id)
        usuario_id = id_usuario(request)
        # Quien lo crea es su dueño (siempre lo ve), sin importar lo que mande el cliente
        data.usuario_id = usuario_id
        proyecto = await crear_proyecto(db_session, data, usuario_id)
        return (await _respuestas(db_session, [proyecto]))[0]

    @put("/{proyecto_id:int}")
    async def actualizar(self, request: Request, db_session: AsyncSession, proyecto_id: int, data: ProyectoActualizar) -> ProyectoRespuesta:
        await requerir_seccion(db_session, request, "proyectos")
        await _solo_proyectos(db_session, proyecto_id)
        await requerir_acceso(db_session, request, proyecto_id)
        actual = await obtener_proyecto(db_session, proyecto_id)
        if not actual:
            raise NotFoundException(detail="Proyecto no encontrado")
        if data.area_id is not msgspec.UNSET:
            await _validar_area(db_session, request, data.area_id)
        usuario_id = id_usuario(request)
        # Quien lo ve lo decide quien lo creo (o un administrador); el dueño no cambia al editar
        cambia_acceso = data.acceso not in (None, actual.acceso) or (
            data.miembro_ids is not None
            and set(data.miembro_ids) != set((await miembros_de(db_session, [proyecto_id]))[proyecto_id])
        )
        if cambia_acceso and actual.usuario_id != usuario_id and not await es_admin(db_session, request):
            raise PermissionDeniedException(detail="Solo quien creó el proyecto puede cambiar quién lo ve")
        data.usuario_id = None
        _validar_acceso(data.acceso or actual.acceso, actual.area_id if data.area_id is msgspec.UNSET else data.area_id)
        proyecto = await actualizar_proyecto(db_session, proyecto_id, data, usuario_id)
        if not proyecto:
            raise NotFoundException(detail="Proyecto no encontrado")
        return (await _respuestas(db_session, [proyecto]))[0]

    @get("/{proyecto_id:int}/contenido")
    async def contenido(self, request: Request, db_session: AsyncSession, proyecto_id: int) -> dict[str, int]:
        """Cuantas tareas, archivos y carpetas se perderian al eliminarlo (para confirmar)."""
        await requerir_seccion(db_session, request, "proyectos")
        await _solo_proyectos(db_session, proyecto_id)
        await requerir_acceso(db_session, request, proyecto_id)
        return await contenido_proyecto(db_session, proyecto_id)

    @delete("/{proyecto_id:int}")
    async def eliminar(self, request: Request, db_session: AsyncSession, proyecto_id: int) -> None:
        """Elimina para siempre el proyecto y todo lo que tiene. Solo quien lo creo o un administrador."""
        await requerir_seccion(db_session, request, "proyectos")
        await _solo_proyectos(db_session, proyecto_id)
        await requerir_acceso(db_session, request, proyecto_id)
        usuario_id = id_usuario(request)
        actual = await obtener_proyecto(db_session, proyecto_id)
        if actual and actual.usuario_id != usuario_id and not await es_admin(db_session, request):
            raise PermissionDeniedException(detail="Solo quien creó el proyecto puede eliminarlo")
        eliminado = await eliminar_proyecto(db_session, proyecto_id, usuario_id)
        if not eliminado:
            raise NotFoundException(detail="Proyecto no encontrado")
