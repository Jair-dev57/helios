from litestar import Controller, Request, delete, get, post, put
from litestar.exceptions import NotFoundException, PermissionDeniedException, ValidationException
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.permisos import es_admin, requerir_seccion
from src.features.comentarios import services
from src.features.comentarios.schemas import Comentario, ComentarioTexto
from src.features.documentos.controller import _documento_visible


def _texto_valido(data: ComentarioTexto) -> str:
    texto = data.texto.strip()
    if not texto:
        raise ValidationException(detail="El comentario está vacío")
    if len(texto) > services.LARGO_MAXIMO:
        raise ValidationException(detail=f"El comentario supera los {services.LARGO_MAXIMO} caracteres")
    return texto


async def _comentario_propio(db: AsyncSession, request: Request, comentario_id: int, permitir_admin: bool):
    """El comentario si existe, su documento es visible y es del usuario (o, si se permite, el usuario es admin)."""
    comentario = await services.obtener(db, comentario_id)
    if not comentario:
        raise NotFoundException(detail="Comentario no encontrado")
    await _documento_visible(db, request, comentario.documento_id)
    if comentario.usuario_id != int(request.user["id"]) and not (permitir_admin and await es_admin(db, request)):
        raise PermissionDeniedException(detail="Solo quien escribió el comentario puede cambiarlo")
    return comentario


class ComentarioController(Controller):
    path = "/"
    tags = ["Comentarios"]

    @get("/documentos/{documento_id:int}/comentarios")
    async def listar(self, request: Request, db_session: AsyncSession, documento_id: int) -> list[Comentario]:
        await requerir_seccion(db_session, request, "documentos")
        await _documento_visible(db_session, request, documento_id)
        return [Comentario(**c) for c in await services.listar(db_session, documento_id)]

    @post("/documentos/{documento_id:int}/comentarios")
    async def crear(
        self, request: Request, db_session: AsyncSession, documento_id: int, data: ComentarioTexto
    ) -> Comentario:
        await requerir_seccion(db_session, request, "documentos")
        documento = await _documento_visible(db_session, request, documento_id)
        comentario_id = await services.crear(
            db_session, documento, int(request.user["id"]), request.user.get("nombre") or "Alguien", _texto_valido(data)
        )
        return next(Comentario(**c) for c in await services.listar(db_session, documento_id) if c["id"] == comentario_id)

    @put("/comentarios/{comentario_id:int}")
    async def editar(
        self, request: Request, db_session: AsyncSession, comentario_id: int, data: ComentarioTexto
    ) -> Comentario:
        await requerir_seccion(db_session, request, "documentos")
        comentario = await _comentario_propio(db_session, request, comentario_id, permitir_admin=False)
        documento_id = comentario.documento_id
        await services.editar(db_session, comentario, _texto_valido(data))
        return next(Comentario(**c) for c in await services.listar(db_session, documento_id) if c["id"] == comentario_id)

    @delete("/comentarios/{comentario_id:int}")
    async def eliminar(self, request: Request, db_session: AsyncSession, comentario_id: int) -> None:
        """Lo borra quien lo escribio o un administrador."""
        await requerir_seccion(db_session, request, "documentos")
        comentario = await _comentario_propio(db_session, request, comentario_id, permitir_admin=True)
        await services.eliminar(db_session, comentario)
