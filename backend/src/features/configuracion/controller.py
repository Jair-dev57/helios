from typing import Annotated

import msgspec
from litestar import Controller, get, put, post, delete, Request
from litestar.enums import RequestEncodingType
from litestar.params import Body
from sqlalchemy.ext.asyncio import AsyncSession
from src.core.permisos import requerir_seccion
from src.features.configuracion.schemas import (
    EmpresaActualizar,
    EmpresaRespuesta,
    EmpresaPublica,
    ImagenSubida,
)
from src.features.configuracion.services import (
    obtener_empresa,
    actualizar_empresa,
    cambiar_logo,
    quitar_logo,
)


class EmpresaController(Controller):
    path = "/empresa"
    tags = ["Configuración"]

    @get("/publica")
    async def publica(self, db_session: AsyncSession) -> EmpresaPublica:
        """Nombre y logo de la empresa; no requiere sesion (se usa en el login)."""
        empresa = await obtener_empresa(db_session)
        return EmpresaPublica(nombre=empresa.nombre, logo_url=empresa.logo_url)

    @get()
    async def obtener(self, db_session: AsyncSession) -> EmpresaRespuesta:
        empresa = await obtener_empresa(db_session)
        return msgspec.convert(empresa, EmpresaRespuesta, from_attributes=True)

    @put()
    async def actualizar(self, request: Request, db_session: AsyncSession, data: EmpresaActualizar) -> EmpresaRespuesta:
        await requerir_seccion(db_session, request, "configuracion")
        empresa = await actualizar_empresa(db_session, data)
        return msgspec.convert(empresa, EmpresaRespuesta, from_attributes=True)

    @post("/logo")
    async def subir_logo(
        self,
        request: Request,
        db_session: AsyncSession,
        data: Annotated[ImagenSubida, Body(media_type=RequestEncodingType.MULTI_PART)],
    ) -> EmpresaRespuesta:
        await requerir_seccion(db_session, request, "configuracion")
        empresa = await cambiar_logo(db_session, data.archivo)
        return msgspec.convert(empresa, EmpresaRespuesta, from_attributes=True)

    @delete("/logo", status_code=200)
    async def eliminar_logo(self, request: Request, db_session: AsyncSession) -> EmpresaRespuesta:
        await requerir_seccion(db_session, request, "configuracion")
        empresa = await quitar_logo(db_session)
        return msgspec.convert(empresa, EmpresaRespuesta, from_attributes=True)
