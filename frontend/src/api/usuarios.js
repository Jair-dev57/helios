import client from './client';

export const listarUsuarios = async () => {
  const response = await client.get('/usuarios');
  return response.data;
};

export const obtenerUsuario = async (id) => {
  const response = await client.get(`/usuarios/${id}`);
  return response.data;
};

export const crearUsuario = async (data) => {
  const response = await client.post('/usuarios', data);
  return response.data;
};

export const actualizarUsuario = async (id, data) => {
  const response = await client.put(`/usuarios/${id}`, data);
  return response.data;
};

export const eliminarUsuario = async (id) => {
  await client.delete(`/usuarios/${id}`);
};

export const subirAvatarUsuario = async (id, archivo) => {
  const formData = new FormData();
  formData.append('archivo', archivo);
  const response = await client.post(`/usuarios/${id}/avatar`, formData);
  return response.data;
};
