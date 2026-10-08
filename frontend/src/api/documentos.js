import client from './client';

export const listarDocumentos = async (proyectoId, carpetaId) => {
  const params = {};
  if (proyectoId) params.proyecto_id = proyectoId;
  if (carpetaId === null) {
    params.sin_carpeta = true;
  } else if (carpetaId !== undefined) {
    params.carpeta_id = carpetaId;
  }
  const response = await client.get('/documentos', { params });
  return response.data;
};

export const obtenerDocumento = async (id) => {
  const response = await client.get(`/documentos/${id}`);
  return response.data;
};

// config admite onUploadProgress y signal (para mostrar el avance y cancelar)
export const subirDocumento = async (formData, config) => {
  const response = await client.post('/documentos/upload', formData, config);
  return response.data;
};

// Si el archivo es identico a la version actual el backend no crea version (version_actual no cambia)
export const subirVersionDocumento = async (id, formData, config) => {
  const response = await client.post(`/documentos/${id}/version`, formData, config);
  return response.data;
};

// El archivo se descarga con el cliente (lleva el token) y el backend comprueba si el usuario puede verlo
export const descargarArchivoDocumento = async (id) => {
  const response = await client.get(`/documentos/${id}/archivo`, { responseType: 'blob' });
  return response.data;
};

// Solo administradores: { restringido, usuario_ids }
export const obtenerAccesoDocumento = async (id) => {
  const response = await client.get(`/documentos/${id}/acceso`);
  return response.data;
};

export const actualizarAccesoDocumento = async (id, data) => {
  const response = await client.put(`/documentos/${id}/acceso`, data);
  return response.data;
};

export const actualizarDocumento = async (id, data) => {
  const response = await client.put(`/documentos/${id}`, data);
  return response.data;
};

export const eliminarDocumento = async (id) => {
  await client.delete(`/documentos/${id}`);
};

// Busca informacion dentro del contenido de los archivos (IA + coincidencia literal).
// Con carpetaId limita la busqueda a esa carpeta y sus subcarpetas.
export const buscarEnDocumentos = async (proyectoId, query, carpetaId, signal) => {
  const params = { proyecto_id: proyectoId, q: query };
  if (carpetaId != null) params.carpeta_id = carpetaId;
  const response = await client.get('/documentos/buscar', { params, signal });
  return response.data;
};
