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
