"""Importa todos los modelos para que queden registrados en Base.metadata (app y Alembic)."""
import src.features.auth.models  # noqa: F401
import src.features.busqueda.models  # noqa: F401
import src.features.carpetas.models  # noqa: F401
import src.features.clientes.models  # noqa: F401
import src.features.comentarios.models  # noqa: F401
import src.features.configuracion.models  # noqa: F401
import src.features.documentos.models  # noqa: F401
import src.features.enlaces.models  # noqa: F401
import src.features.etiquetas.models  # noqa: F401
import src.features.favoritos.models  # noqa: F401
import src.features.historial.models  # noqa: F401
import src.features.notificaciones.models  # noqa: F401
import src.features.proyectos.models  # noqa: F401
import src.features.roles.models  # noqa: F401
import src.features.tareas.models  # noqa: F401
