import client from './client';

export const listarProyectos = async () => {
  const response = await client.get('/proyectos');
  return response.data;
};

export const obtenerProyecto = async (id) => {
  const response = await client.get(`/proyectos/${id}`);
  return response.data;
};

export const crearProyecto = async (data) => {
  const response = await client.post('/proyectos', data);
  return response.data;
};

export const actualizarProyecto = async (id, data) => {
  const response = await client.put(`/proyectos/${id}`, data);
  return response.data;
};

export const eliminarProyecto = async (id) => {
  await client.delete(`/proyectos/${id}`);
};