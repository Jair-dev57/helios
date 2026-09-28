from msgspec import Struct


class TareaResumen(Struct):
    id: int
    titulo: str
    proyecto_id: int
    proyecto_nombre: str
    fecha_vencimiento: str | None
    prioridad: str
    usuario_asignado_id: int | None = None


class CargaUsuario(Struct):
    usuario_id: int
    nombre: str
    total_tareas: int
    tareas_vencidas: int = 0


class ProyectoEnRiesgo(Struct):
    proyecto_id: int
    nombre: str
    tareas_vencidas: int


class DashboardRespuesta(Struct):
    proyectos_activos: int
    tareas_abiertas: int
    total_documentos: int
    tareas_vencidas: list[TareaResumen]
    tareas_por_vencer: list[TareaResumen]
    distribucion_estados: dict[str, int]
    carga_por_usuario: list[CargaUsuario]
    proyectos_en_riesgo: list[ProyectoEnRiesgo]
    tareas_sin_asignar: int = 0