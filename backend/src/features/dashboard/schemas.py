from msgspec import Struct


class TareaResumen(Struct):
    id: int
    titulo: str
    proyecto_id: int
    proyecto_nombre: str
    fecha_vencimiento: str | None
    prioridad: str


class CargaUsuario(Struct):
    usuario_id: int
    nombre: str
    total_tareas: int


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