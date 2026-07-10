import client from './client';

export const listarUsuarios = async () => {
  const response = await client.get('/usuarios');
  return response.data;
};

export const obtenerUsuario = async (id) => {
  const response = await client.get(`/usuarios/${id}`);
  return response.data;
};