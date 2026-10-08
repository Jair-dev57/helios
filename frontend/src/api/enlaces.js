import client from './client';

// Enlaces de un documento o una carpeta: objetivo = { documento_id } o { carpeta_id }
export const listarEnlaces = async (objetivo) => {
  const response = await client.get('/enlaces', { params: objetivo });
  return response.data;
};

// data: { documento_id | carpeta_id, permiso: 'ver' | 'subir', contrasena?, expira_at? }
export const crearEnlace = async (data) => {
  const response = await client.post('/enlaces', data);
  return response.data;
};

export const revocarEnlace = async (id) => {
  await client.delete(`/enlaces/${id}`);
};

// Direccion publica del enlace (la abre cualquiera, sin cuenta)
export const urlEnlace = (token) => `${window.location.origin}/s/${token}`;
