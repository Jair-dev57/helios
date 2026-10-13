import client from './client';

// Enlaces de un documento o una carpeta: objetivo = { documento_id } o { carpeta_id }
export const listarEnlaces = async (objetivo) => {
  const response = await client.get('/enlaces', { params: objetivo });
  return response.data;
};

// { conmigo: [ids de documentos restringidos compartidos conmigo], enlaces: [enlaces publicos vigentes] }
export const obtenerCompartidos = async (proyectoId) => {
  const response = await client.get('/enlaces/compartidos', { params: { proyecto_id: proyectoId } });
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

// Compartidos y Solicitudes del menu Archivos: { conmigo: [objeto], enlaces: [{ ..., objeto }] } de todos los espacios
export const obtenerCompartidosGlobal = async () => {
  const response = await client.get('/enlaces/global');
  return response.data;
};
