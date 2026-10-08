from typing import Annotated

import anyio
from litestar import Controller, Request, delete, get, post
from litestar.background_tasks import BackgroundTask
from litestar.enums import RequestEncodingType
from litestar.exceptions import NotFoundException, PermissionDeniedException, ValidationException
from litestar.params import Body, Parameter
from litestar.response import File
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.permisos import requerir_seccion
from src.features.carpetas.controller import _armar_zip
from src.features.carpetas.services import contenido_para_zip, obtener_carpeta
from src.features.documentos.controller import SIN_CACHE, _documento_visible, _guardar_en_disco, _leer_archivo
from src.features.documentos.extraccion import _ruta_local
from src.features.documentos.schemas import DocumentoCrear
from src.features.documentos.services import crear_documento
from src.features.enlaces import services
from src.features.notificaciones.services import notificar
from src.features.enlaces.schemas import (
    ArchivoRecibido,
    CarpetaPublica,
    DocumentoPublico,
    EnlaceCrear,
    EnlacePublico,
    EnlaceRespuesta,
    EnvioArchivo,
)

NO_DISPONIBLE = "Este enlace no existe o ya no está disponible"

# La contrasena del enlace viaja en una cabecera en cada peticion (la pagina publica la guarda en memoria)
Contrasena = Annotated[str | None, Parameter(header="X-Contrasena-Enlace", required=False)]


class EnlaceController(Controller):
    """Gestion de enlaces desde Helios (con sesion)."""
    path = "/enlaces"
    tags = ["Enlaces compartidos"]

    @get()
    async def listar(
        self, request: Request, db_session: AsyncSession, documento_id: int | None = None, carpeta_id: int | None = None
    ) -> list[EnlaceRespuesta]:
        await requerir_seccion(db_session, request, "documentos")
        if (documento_id is None) == (carpeta_id is None):
            raise ValidationException(detail="Indica documento_id o carpeta_id")
        return [EnlaceRespuesta(**e) for e in await services.listar(db_session, documento_id, carpeta_id)]

    @post()
    async def crear(self, request: Request, db_session: AsyncSession, data: EnlaceCrear) -> EnlaceRespuesta:
        await requerir_seccion(db_session, request, "documentos")
        if (data.documento_id is None) == (data.carpeta_id is None):
            raise ValidationException(detail="Un enlace comparte un documento o una carpeta")
        if data.documento_id is not None:
            if data.permiso != "ver":
                raise ValidationException(detail="Solo una carpeta puede recibir archivos")
            documento = await _documento_visible(db_session, request, data.documento_id)
            if documento.restringido:
                raise ValidationException(detail="Los documentos restringidos no se pueden compartir por enlace")
            proyecto_id = documento.proyecto_id
        else:
            carpeta = await obtener_carpeta(db_session, data.carpeta_id)
            if not carpeta:
                raise NotFoundException(detail="Carpeta no encontrada")
            proyecto_id = carpeta.proyecto_id
        usuario_id = int(request.user["id"]) if request.user else None
        enlace = await services.crear(
            db_session,
            proyecto_id=proyecto_id,
            documento_id=data.documento_id,
            carpeta_id=data.carpeta_id,
            permiso=data.permiso,
            contrasena=(data.contrasena or "").strip() or None,
            expira_at=data.expira_at,
            usuario_id=usuario_id,
        )
        creados = await services.listar(db_session, enlace.documento_id, enlace.carpeta_id)
        return EnlaceRespuesta(**next(e for e in creados if e["id"] == enlace.id))

    @delete("/{enlace_id:int}")
    async def revocar(self, request: Request, db_session: AsyncSession, enlace_id: int) -> None:
        await requerir_seccion(db_session, request, "documentos")
        enlace = await services.obtener(db_session, enlace_id)
        if not enlace:
            raise NotFoundException(detail="Enlace no encontrado")
        await services.eliminar(db_session, enlace)


async def _enlace(db: AsyncSession, token: str, contrasena: str | None, permiso: str | None = None):
    """(enlace, objeto) disponible y con la contrasena correcta; si no, 404 o 403."""
    resuelto = await services.resolver(db, token)
    if not resuelto or (permiso and resuelto[0].permiso != permiso):
        raise NotFoundException(detail=NO_DISPONIBLE)
    if not services.contrasena_valida(resuelto[0], contrasena):
        raise PermissionDeniedException(detail="Contraseña incorrecta")
    return resuelto


def _descarga(ruta: str, nombre: str, tipo: str | None) -> File:
    archivo = _ruta_local(ruta)
    if not archivo.is_file():
        raise NotFoundException(detail="El archivo no está en el servidor")
    return File(path=archivo, filename=f"{nombre}.{tipo}" if tipo else nombre, headers=SIN_CACHE)


class CompartidoController(Controller):
    """Pagina publica de un enlace: sin sesion (excluida de la autenticacion en security.py)."""
    path = "/compartido/{token:str}"
    tags = ["Enlaces compartidos"]

    @get()
    async def ver(self, db_session: AsyncSession, token: str, contrasena: Contrasena) -> EnlacePublico:
        resuelto = await services.resolver(db_session, token)
        if not resuelto:
            raise NotFoundException(detail=NO_DISPONIBLE)
        enlace, objeto = resuelto
        es_documento = enlace.documento_id is not None
        base = {
            "permiso": enlace.permiso,
            "tipo": "documento" if es_documento else "carpeta",
            "expira_at": enlace.expira_at,
        }
        if enlace.contrasena_hash and not contrasena:
            return EnlacePublico(**base, requiere_contrasena=True)
        if not services.contrasena_valida(enlace, contrasena):
            raise PermissionDeniedException(detail="Contraseña incorrecta")

        if es_documento:
            respuesta = EnlacePublico(
                **base, requiere_contrasena=False, nombre=objeto.nombre,
                documento=DocumentoPublico(**services.datos_documento(objeto)),
            )
        elif enlace.permiso == "subir":
            # Quien solo puede enviar archivos no ve lo que hay en la carpeta
            respuesta = EnlacePublico(**base, requiere_contrasena=False, nombre=objeto.nombre, carpeta_id=objeto.id)
        else:
            carpetas, documentos = await services.contenido_carpeta(db_session, objeto)
            respuesta = EnlacePublico(
                **base, requiere_contrasena=False, nombre=objeto.nombre, carpeta_id=objeto.id,
                carpetas=[CarpetaPublica(**c) for c in carpetas],
                documentos=[DocumentoPublico(**d) for d in documentos],
            )
        # Al final: el commit expira los objetos leidos arriba
        await services.registrar_acceso(db_session, enlace)
        return respuesta

    @get("/archivo")
    async def archivo(self, db_session: AsyncSession, token: str, contrasena: Contrasena) -> File:
        """Archivo de un enlace a un documento."""
        enlace, objeto = await _enlace(db_session, token, contrasena, "ver")
        if enlace.documento_id is None:
            raise NotFoundException(detail=NO_DISPONIBLE)
        return _descarga(objeto.ruta, objeto.nombre, objeto.tipo)

    @get("/documentos/{documento_id:int}/archivo")
    async def archivo_de_carpeta(
        self, db_session: AsyncSession, token: str, documento_id: int, contrasena: Contrasena
    ) -> File:
        """Un archivo dentro de una carpeta compartida."""
        enlace, objeto = await _enlace(db_session, token, contrasena, "ver")
        documento = None if enlace.carpeta_id is None else await services.documento_en_carpeta(db_session, objeto, documento_id)
        if not documento:
            raise NotFoundException(detail="Archivo no encontrado")
        return _descarga(documento.ruta, documento.nombre, documento.tipo)

    @get("/zip")
    async def zip(self, db_session: AsyncSession, token: str, contrasena: Contrasena) -> File:
        """La carpeta compartida completa en un ZIP."""
        enlace, objeto = await _enlace(db_session, token, contrasena, "ver")
        if enlace.carpeta_id is None:
            raise NotFoundException(detail=NO_DISPONIBLE)
        nombre = objeto.nombre
        entradas = await contenido_para_zip(db_session, objeto, await services.no_publicos(db_session))
        ruta = await anyio.to_thread.run_sync(_armar_zip, entradas)
        return File(path=ruta, filename=f"{nombre}.zip", headers=SIN_CACHE, background=BackgroundTask(ruta.unlink, missing_ok=True))

    @post("/subir", status_code=201)
    async def subir(
        self,
        db_session: AsyncSession,
        token: str,
        contrasena: Contrasena,
        data: Annotated[EnvioArchivo, Body(media_type=RequestEncodingType.MULTI_PART)],
    ) -> ArchivoRecibido:
        """Recibe un archivo en una carpeta con enlace para solicitar archivos. Nunca reemplaza uno existente."""
        enlace, carpeta = await _enlace(db_session, token, contrasena, "subir")
        creador_id, carpeta_nombre = enlace.creado_por, carpeta.nombre
        contenido, extension, hash_archivo = await _leer_archivo(data.archivo)
        tipo = extension.lstrip(".")
        nombre_original = data.archivo.filename.rsplit("/", 1)[-1]
        base = nombre_original[: -len(extension)] if extension else nombre_original
        carpeta_id, proyecto_id = carpeta.id, carpeta.proyecto_id
        nombre = await services.nombre_libre(db_session, carpeta_id, base.strip() or "archivo", tipo)
        documento = await crear_documento(db_session, DocumentoCrear(
            nombre=nombre,
            ruta=_guardar_en_disco(contenido, extension),
            proyecto_id=proyecto_id,
            tipo=tipo,
            carpeta_id=carpeta_id,
            hash=hash_archivo,
        ))
        remitente = (data.remitente or "").strip()[:100] or None
        documento_id = documento.id
        await services.registrar_recibido(db_session, documento, remitente)
        if creador_id:
            await notificar(
                db_session, {creador_id}, "recibido",
                f"{remitente or 'Alguien'} envió «{nombre}.{tipo}» a «{carpeta_nombre}» por enlace",
                documento_id=documento_id, proyecto_id=proyecto_id,
            )
        return ArchivoRecibido(nombre=f"{nombre}.{tipo}")
