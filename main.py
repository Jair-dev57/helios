from litestar import Litestar
from src.core.db import db_plugin 
from src.features.proyectos.controller import ProyectoController


app = Litestar(
    route_handlers=[ProyectoController],
    plugins=[db_plugin]
)