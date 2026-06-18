from litestar import Litestar
from src.core.db import db_plugin

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

app = Litestar(
    route_handlers=[
        UsuarioController,
        ClienteController,
        ProyectoController,
        DocumentoController,
    ],
    plugins=[db_plugin]
)