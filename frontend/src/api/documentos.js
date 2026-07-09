import client from './client';

export const listarDocumentos = async () => {
  const response = await client.get('/documentos');
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

export const actualizarDocumento = async (id, data) => {
  const response = await client.put(`/documentos/${id}`, data);
  return response.data;
};

export const eliminarDocumento = async (id) => {
  await client.delete(`/documentos/${id}`);
};