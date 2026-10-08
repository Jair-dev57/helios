import client from './client';

export const listarCarpetas = async (proyectoId) => {
  const params = proyectoId ? { proyecto_id: proyectoId } : {};
  const response = await client.get('/carpetas', { params });
  return response.data;
};

export const obtenerCarpeta = async (id) => {
  const response = await client.get(`/carpetas/${id}`);
  return response.data;
};

export const crearCarpeta = async (data) => {
  const response = await client.post('/carpetas', data);
  return response.data;
};

export const actualizarCarpeta = async (id, data) => {
  const response = await client.put(`/carpetas/${id}`, data);
  return response.data;
};

export const eliminarCarpeta = async (id) => {
  await client.delete(`/carpetas/${id}`);
};
// La carpeta con sus subcarpetas y la version actual de cada archivo, en un ZIP (Blob)
export const descargarZipCarpeta = async (id) => {
  const response = await client.get(`/carpetas/${id}/zip`, { responseType: 'blob' });
  return response.data;
};
