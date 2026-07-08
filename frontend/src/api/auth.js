import client from './client';

export const login = async (email, password) => {
  const response = await client.post('/auth/login', { email, password });
  return response.data; // { acceso, mensaje, usuario_id, nombre, email, rol, access_token }
};

export const getMe = async () => {
  const response = await client.get('/auth/me');
  return response.data; // { id, nombre, email, rol, activo, created_at, updated_at }
};

export const logout = () => {
  localStorage.removeItem('access_token');
};