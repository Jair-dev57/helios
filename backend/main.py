from pathlib import Path

from litestar import Litestar
from litestar.config.cors import CORSConfig
from litestar.static_files import create_static_files_router

import src.core.modelos  # noqa: F401 - registra los modelos en Base.metadata
from src.core.config import settings
from src.core.db import db_plugin
from src.core.security import jwt_auth

# controllers
from src.features.auth.controller import AuthController, UsuarioController
from src.features.busqueda.controller import BusquedaController
from src.features.carpetas.controller import CarpetaController
from src.features.clientes.controller import ClienteController
from src.features.configuracion.controller import EmpresaController
from src.features.dashboard.controller import DashboardController
from src.features.documentos.controller import DocumentoController
from src.features.enlaces.controller import CompartidoController, EnlaceController
from src.features.historial.controller import HistorialController
from src.features.papelera.controller import PapeleraController
from src.features.proyectos.controller import ProyectoController
from src.features.roles.controller import RolController
from src.features.tareas.controller import ColumnaController, TareaController

cors_config = CORSConfig(
    allow_origins=[origen.strip() for origen in settings.CORS_ORIGINS],
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True,
)

# Los documentos (uploads/) no se sirven como estaticos: se descargan con
# GET /documentos/{id}/archivo, que comprueba si el usuario puede verlos
# Logo de la empresa y avatares: sin token (ver src/core/archivos.py)
Path("publico").mkdir(exist_ok=True)
publico_router = create_static_files_router(path="/publico", directories=["publico"])

app = Litestar(
    route_handlers=[
        AuthController,
        UsuarioController,
        ClienteController,
        ProyectoController,
        CarpetaController,
        DocumentoController,
        EnlaceController,
        CompartidoController,
        TareaController,
        ColumnaController,
        DashboardController,
        BusquedaController,
        HistorialController,
        PapeleraController,
        RolController,
        EmpresaController,
        publico_router,
    ],
    plugins=[db_plugin],
    on_app_init=[jwt_auth.on_app_init],
    cors_config=cors_config,
    debug=settings.DEBUG,
)
