from litestar import Litestar
from litestar.config.cors import CORSConfig
from src.core.db import db_plugin
from src.core.security import jwt_auth

# modelos - importar para que create_all los registre
import src.features.auth.models
import src.features.clientes.models
import src.features.proyectos.models
import src.features.documentos.models

# controllers
from src.features.auth.controller import UsuarioController
from src.features.clientes.controller import ClienteController
from src.features.proyectos.controller import ProyectoController
from src.features.documentos.controller import DocumentoController
from src.features.auth.controller import AuthController

cors_config = CORSConfig(allow_origins=["http://localhost:5173"])

app = Litestar(
    route_handlers=[
        AuthController,
        UsuarioController,
        ClienteController,
        ProyectoController,
        DocumentoController,
    ],
    plugins=[db_plugin],
    middleware=[jwt_auth.middleware],
    cors_config=cors_config,
    debug=True,
)