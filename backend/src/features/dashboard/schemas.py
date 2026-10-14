from datetime import date, datetime

from msgspec import Struct


class ProyectoAvance(Struct):
    """Un punto del mapa de proyectos: tiempo usado (inicio → entrega) contra tareas terminadas."""

    id: int
    nombre: str
    inicio: datetime
    entrega: datetime
    tareas: int
    # Terminadas antes del inicio y del final del periodo: la estela de cuanto avanzo
    hechas_al_inicio: int
    hechas_al_final: int


class DiaActividad(Struct):
    dia: date
    acciones: int


class DashboardRespuesta(Struct):
    # Fechas sueltas: el navegador las agrupa por hora o por dia en su zona horaria
    terminadas: list[datetime]
    creadas: list[datetime]
    terminadas_periodo_anterior: int
    # De las terminadas en el periodo con fecha limite, cuantas antes de vencer
    a_tiempo: int
    con_fecha: int
    # Dias de atraso de cada tarea abierta y vencida, hoy (no depende del periodo)
    vencidas: list[int]
    proyectos: list[ProyectoAvance]
    # Acciones por dia del ultimo año (mapa de calor)
    calor: list[DiaActividad]
