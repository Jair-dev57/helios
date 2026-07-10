from litestar import Litestar
from litestar.static_files import create_static_files_router
from src.core.db import db_plugin
from src.core.security import jwt_auth
from litestar.config.cors import CORSConfig

# modelos - importar para que create_all los registre
import src.features.auth.models
import src.features.clientes.models
import src.features.proyectos.models
import src.features.carpetas.models
import src.features.documentos.models
import src.features.tareas.models

# controllers
from src.features.auth.controller import UsuarioController
from src.features.clientes.controller import ClienteController
from src.features.proyectos.controller import ProyectoController
from src.features.carpetas.controller import CarpetaController
from src.features.documentos.controller import DocumentoController
from src.features.tareas.controller import TareaController
from src.features.dashboard.controller import DashboardController
from src.features.auth.controller import AuthController

cors_config = CORSConfig(allow_origins=["http://localhost:5173"])

static_files_router = create_static_files_router(path="/uploads", directories=["uploads"])

app = Litestar(
    route_handlers=[
        AuthController,
        UsuarioController,
        ClienteController,
        ProyectoController,
        CarpetaController,
        DocumentoController,
        TareaController,
        DashboardController,
        static_files_router,
    ],
    plugins=[db_plugin],
    on_app_init=[jwt_auth.on_app_init],
    cors_config=cors_config,
    debug=True,
)