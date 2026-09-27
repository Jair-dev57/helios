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

export const subirDocumento = async (formData) => {
  const response = await client.post('/documentos/upload', formData);
  return response.data;
};

export const subirVersionDocumento = async (id, formData) => {
  const response = await client.post(`/documentos/${id}/version`, formData);
  return response.data;
};

// Los archivos en /uploads requieren el token, por eso se descargan con el cliente y no con una URL directa
export const descargarArchivoDocumento = async (ruta) => {
  const response = await client.get(ruta, { responseType: 'blob' });
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
