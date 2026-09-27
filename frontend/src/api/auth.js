import client from './client';

// `usuario` puede ser el email o el nombre de usuario
export const login = async (usuario, password) => {
  const response = await client.post('/auth/login', { usuario, password });
  return response.data; // { acceso, mensaje, usuario_id, nombre, email, rol, username, avatar_url, access_token }
};

export const getMe = async () => {
  const response = await client.get('/auth/me');
  return response.data; // { id, nombre, email, rol, activo, username, avatar_url, telefono, cargo, ... }
};

export const getMisSecciones = async () => {
  const response = await client.get('/auth/me/secciones');
  return response.data; // ["dashboard", "clientes", ...]
};

export const actualizarPerfil = async (data) => {
  const response = await client.put('/auth/me', data);
  return response.data;
};

export const cambiarPassword = async (passwordActual, passwordNueva) => {
  await client.put('/auth/me/password', {
    password_actual: passwordActual,
    password_nueva: passwordNueva,
  });
};

export const subirAvatar = async (archivo) => {
  const formData = new FormData();
  formData.append('archivo', archivo);
  const response = await client.post('/auth/me/avatar', formData);
  return response.data;
};

export const quitarAvatar = async () => {
  const response = await client.delete('/auth/me/avatar');
  return response.data;
};

export const logout = () => {
  localStorage.removeItem('access_token');
};
