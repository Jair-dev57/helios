import client from './client';

export const obtenerHistorial = async (proyectoId) => {
  const { data } = await client.get('/historial', { params: { proyecto_id: proyectoId } });
  return data;
};
