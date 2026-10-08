import re
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.features.comentarios.models import ComentarioModel
from src.features.notificaciones.services import notificar, usuarios_que_pueden_ver

# Mencion dentro del texto: @[Nombre](usuario_id)
MENCION = re.compile(r"@\[([^\]\n]{1,100})\]\((\d+)\)")
LARGO_MAXIMO = 4000


def mencionados(texto: str) -> set[int]:
    return {int(m.group(2)) for m in MENCION.finditer(texto)}


def _resumen(texto: str, largo: int = 80) -> str:
    """El texto con las menciones como @Nombre, recortado para el aviso."""
    plano = " ".join(MENCION.sub(lambda m: f"@{m.group(1)}", texto).split())
    return plano if len(plano) <= largo else plano[: largo - 1] + "…"


async def listar(db: AsyncSession, documento_id: int) -> list[dict]:
    from src.features.auth.models import UsuarioModel

    filas = (await db.execute(
        select(ComentarioModel, UsuarioModel.nombre, UsuarioModel.avatar_url)
        .outerjoin(UsuarioModel, ComentarioModel.usuario_id == UsuarioModel.id)
        .where(ComentarioModel.documento_id == documento_id)
        .order_by(ComentarioModel.created_at)
    )).all()
    return [
        {
            "id": c.id, "documento_id": c.documento_id, "usuario_id": c.usuario_id, "autor": nombre,
            "autor_avatar_url": avatar, "texto": c.texto, "created_at": c.created_at, "editado_at": c.editado_at,
        }
        for c, nombre, avatar in filas
    ]


async def obtener(db: AsyncSession, comentario_id: int) -> ComentarioModel | None:
    return await db.get(ComentarioModel, comentario_id)


async def crear(db: AsyncSession, documento, usuario_id: int, autor: str, texto: str) -> int:
    """Guarda el comentario y avisa: a los mencionados y a quienes participan del archivo
    (quien lo subio y quienes ya comentaron). Nadie recibe aviso de un archivo que no puede ver."""
    datos = (documento.id, documento.nombre, documento.proyecto_id, documento.usuario_id)
    participantes = set((await db.execute(
        select(ComentarioModel.usuario_id).where(ComentarioModel.documento_id == documento.id)
    )).scalars().all()) | {datos[3]}
    pueden_ver_mencionados = await usuarios_que_pueden_ver(db, documento, mencionados(texto))
    pueden_ver_participantes = await usuarios_que_pueden_ver(db, documento, {p for p in participantes if p})

    comentario = ComentarioModel(documento_id=datos[0], usuario_id=usuario_id, texto=texto)
    db.add(comentario)
    await db.flush()
    comentario_id = comentario.id
    await db.commit()

    resumen = _resumen(texto)
    await notificar(
        db, pueden_ver_mencionados, "mencion", f"{autor} te mencionó en «{datos[1]}»: {resumen}",
        documento_id=datos[0], proyecto_id=datos[2], actor_id=usuario_id,
    )
    await notificar(
        db, pueden_ver_participantes - pueden_ver_mencionados, "comentario",
        f"{autor} comentó en «{datos[1]}»: {resumen}",
        documento_id=datos[0], proyecto_id=datos[2], actor_id=usuario_id,
    )
    return comentario_id


async def editar(db: AsyncSession, comentario: ComentarioModel, texto: str) -> None:
    comentario.texto = texto
    comentario.editado_at = datetime.now(timezone.utc)
    await db.commit()


async def eliminar(db: AsyncSession, comentario: ComentarioModel) -> None:
    await db.delete(comentario)
    await db.commit()


async def conteo_por_documento(db: AsyncSession, documento_ids: list[int]) -> dict[int, int]:
    from sqlalchemy import func

    if not documento_ids:
        return {}
    return dict((await db.execute(
        select(ComentarioModel.documento_id, func.count(ComentarioModel.id))
        .where(ComentarioModel.documento_id.in_(documento_ids))
        .group_by(ComentarioModel.documento_id)
    )).all())
