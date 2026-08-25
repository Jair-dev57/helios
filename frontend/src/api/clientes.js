import client from './client';

export const listarClientes = async () => {
  const response = await client.get('/clientes');
  return response.data;
};

export const obtenerCliente = async (id) => {
  const response = await client.get(`/clientes/${id}`);
  return response.data;
};

export const crearCliente = async (data) => {
  const response = await client.post('/clientes', data);
  return response.data;
};

export const actualizarCliente = async (id, data) => {
  const response = await client.put(`/clientes/${id}`, data);
  return response.data;
};

export const toggleActivoCliente = async (id) => {
  const response = await client.patch(`/clientes/${id}/toggle-activo`);
  return response.data;
};
