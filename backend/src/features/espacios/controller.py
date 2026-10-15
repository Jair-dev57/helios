import re

import msgspec
from litestar import Controller, Request, delete, get, post, put
from litestar.exceptions import ClientException, NotFoundException, ValidationException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.permisos import id_usuario, requerir_admin, requerir_seccion
from src.features.carpetas.models import CarpetaModel
from src.features.documentos.models import DocumentoModel
from src.features.espacios import services
from src.features.espacios.schemas import AccesoBasico, Espacio, EspacioActualizar, EspacioCrear, Espacios
from src.features.proyectos.models import ProyectoModel

COLOR = re.compile(r"^#[0-9a-fA-F]{6}$")


def _validar(nombre: str | None, color: str | None) -> None:
    if nombre is not None and not nombre.strip():
        raise ValidationException(detail="El espacio necesita un nombre")
    if nombre is not None and len(nombre.strip()) > 80:
        raise ValidationException(detail="El nombre puede tener máximo 80 caracteres")
    if color and not COLOR.match(color):
        raise ValidationException(detail="Color no válido")


async def _uno(db: AsyncSession, espacio: ProyectoModel) -> Espacio:
    return msgspec.convert((await services.respuestas(db, [espacio]))[0], Espacio)


class EspacioController(Controller):
    """Mis archivos (espacio personal) y espacios de equipo por area."""
    path = "/espacios"
    tags = ["Espacios de archivos"]

    @get()
    async def listar(self, request: Request, db_session: AsyncSession) -> Espacios:
        await requerir_seccion(db_session, request, "archivos")
        personal = await services.espacio_personal(db_session, id_usuario(request))
        equipo = await services.espacios_de_equipo(db_session, await services.proyectos_sin_acceso(db_session, request))
        datos = await services.respuestas(db_session, [personal, *equipo])
        return Espacios(
            personal=msgspec.convert(datos[0], Espacio),
            equipo=[msgspec.convert(d, Espacio) for d in datos[1:]],
        )

    @get("/{espacio_id:int}")
    async def obtener(self, request: Request, db_session: AsyncSession, espacio_id: int) -> Espacio:
        await requerir_seccion(db_session, request, "archivos")
        espacio = await services.obtener_espacio(db_session, espacio_id)
        if not espacio:
            raise NotFoundException(detail="Espacio no encontrado")
        await services.requerir_acceso(db_session, request, espacio_id)
        return await _uno(db_session, espacio)

    @post()
    async def crear(self, request: Request, db_session: AsyncSession, data: EspacioCrear) -> Espacio:
        """Solo un administrador crea espacios de equipo."""
        await requerir_admin(db_session, request)
        _validar(data.nombre, data.color)
        espacio = ProyectoModel(
            nombre=data.nombre.strip(), descripcion=(data.descripcion or "").strip() or None, color=data.color,
            abierto=data.abierto, tipo="equipo", estado="activo", usuario_id=id_usuario(request),
        )
        db_session.add(espacio)
        await db_session.flush()
        await services.guardar_miembros(db_session, espacio.id, data.miembro_ids)
        await services.guardar_secciones(db_session, espacio.id, data.secciones)
        await db_session.commit()
        await db_session.refresh(espacio)
        return await _uno(db_session, espacio)

    @put("/{espacio_id:int}")
    async def actualizar(self, request: Request, db_session: AsyncSession, espacio_id: int, data: EspacioActualizar) -> Espacio:
        await requerir_admin(db_session, request)
        espacio = await services.obtener_espacio(db_session, espacio_id)
        if not espacio or espacio.tipo != "equipo":
            raise NotFoundException(detail="Espacio no encontrado")
        _validar(data.nombre, data.color)
        if data.nombre is not None:
            espacio.nombre = data.nombre.strip()
        if data.descripcion is not None:
            espacio.descripcion = data.descripcion.strip() or None
        if data.color is not None:
            espacio.color = data.color or None
        if data.abierto is not None:
            espacio.abierto = data.abierto
        if data.miembro_ids is not None:
            await services.guardar_miembros(db_session, espacio.id, data.miembro_ids)
        if data.secciones is not None:
            await services.guardar_secciones(db_session, espacio.id, data.secciones)
        await db_session.commit()
        await db_session.refresh(espacio)
        return await _uno(db_session, espacio)

    @delete("/{espacio_id:int}")
    async def eliminar(self, request: Request, db_session: AsyncSession, espacio_id: int) -> None:
        """Solo se borra un espacio de equipo vacío (sin carpetas ni archivos, tampoco en la papelera)."""
        await requerir_admin(db_session, request)
        espacio = await services.obtener_espacio(db_session, espacio_id)
        if not espacio or espacio.tipo != "equipo":
            raise NotFoundException(detail="Espacio no encontrado")
        carpetas = (await db_session.execute(
            select(func.count(CarpetaModel.id)).where(CarpetaModel.proyecto_id == espacio_id)
        )).scalar_one()
        documentos = (await db_session.execute(
            select(func.count(DocumentoModel.id)).where(DocumentoModel.proyecto_id == espacio_id)
        )).scalar_one()
        if carpetas or documentos:
            raise ClientException(status_code=409, detail="Vacía el espacio (y su papelera) antes de eliminarlo")
        await db_session.delete(espacio)
        await db_session.commit()


class AccesoBasicoController(Controller):
    """Lo que tiene cualquier persona, aunque no este en ningun equipo."""
    path = "/acceso-basico"
    tags = ["Espacios de archivos"]

    @get()
    async def obtener(self, request: Request, db_session: AsyncSession) -> AccesoBasico:
        return AccesoBasico(secciones=await services.acceso_basico(db_session))

    @put()
    async def actualizar(self, request: Request, db_session: AsyncSession, data: AccesoBasico) -> AccesoBasico:
        await requerir_admin(db_session, request)
        return AccesoBasico(secciones=await services.guardar_acceso_basico(db_session, data.secciones))
