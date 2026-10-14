import client from './client';

export const obtenerHistorial = async (proyectoId) => {
  const { data } = await client.get('/historial', { params: { proyecto_id: proyectoId } });
  return data;
};

// Ultimos movimientos de todos los proyectos
export const obtenerActividadGlobal = async (limite = 6) => {
  const { data } = await client.get('/historial', { params: { limite } });
  return data;
};

// Pagina Actividad e Inicio: tipo ('proyecto' | 'tarea' | 'documento'), soloMias, antesDe (id del ultimo evento
// mostrado) y el rango [desde, hasta) (Date)
export const obtenerActividad = async ({ tipo, soloMias = false, antesDe, desde, hasta, limite = 40 } = {}) => {
  const params = { solo_mias: soloMias, limite };
  if (tipo) params.tipo = tipo;
  if (antesDe) params.antes_de = antesDe;
  if (desde) params.desde = desde.toISOString();
  if (hasta) params.hasta = hasta.toISOString();
  const { data } = await client.get('/historial/actividad', { params });
  return data;
};

// A donde lleva cada evento; lo eliminado ya no tiene a donde ir
export function enlaceEvento(e) {
  if (e.accion === 'eliminado' || !e.proyecto_id) return null;
  if (e.tipo === 'documento') return e.accion === 'papelera' ? null : `/proyectos/${e.proyecto_id}/documentos?doc=${e.entidad_id}`;
  if (e.tipo === 'tarea') return `/proyectos/${e.proyecto_id}/tareas?tarea=${e.entidad_id}`;
  return `/proyectos/${e.proyecto_id}`;
}
