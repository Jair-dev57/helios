import client from './client';

export const listarRoles = async () => {
  const { data } = await client.get('/roles');
  return data;
};

export const crearRol = async (data) => {
  const response = await client.post('/roles', data);
  return response.data;
};

export const actualizarRol = async (id, data) => {
  const response = await client.put(`/roles/${id}`, data);
  return response.data;
};

export const eliminarRol = async (id) => {
  await client.delete(`/roles/${id}`);
};

export const listarSeccionesDisponibles = async () => {
  const { data } = await client.get('/roles/secciones-disponibles');
  return data;
};

export const obtenerSeccionesRol = async (rolId) => {
  const { data } = await client.get(`/roles/${rolId}/secciones`);
  return data.secciones;
};

export const actualizarSeccionesRol = async (rolId, secciones) => {
  const { data } = await client.put(`/roles/${rolId}/secciones`, { secciones });
  return data.secciones;
};
