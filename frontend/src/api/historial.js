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

// Pagina Actividad: tipo ('proyecto' | 'tarea' | 'documento'), soloMias y antesDe (id del ultimo evento mostrado)
export const obtenerActividad = async ({ tipo, soloMias = false, antesDe, limite = 40 } = {}) => {
  const params = { solo_mias: soloMias, limite };
  if (tipo) params.tipo = tipo;
  if (antesDe) params.antes_de = antesDe;
  const { data } = await client.get('/historial/actividad', { params });
  return data;
};
