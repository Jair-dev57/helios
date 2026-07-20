import client from './client';

export const listarTareas = async (proyectoId) => {
  const params = proyectoId ? { proyecto_id: proyectoId } : {};
  const response = await client.get('/tareas', { params });
  return response.data;
};

export const obtenerTarea = async (id) => {
  const response = await client.get(`/tareas/${id}`);
  return response.data;
};

export const crearTarea = async (data) => {
  const response = await client.post('/tareas', data);
  return response.data;
};

export const actualizarTarea = async (id, data) => {
  const response = await client.put(`/tareas/${id}`, data);
  return response.data;
};

export const eliminarTarea = async (id) => {
  await client.delete(`/tareas/${id}`);
};

export const listarDocumentosDeTarea = async (tareaId) => {
  const response = await client.get(`/tareas/${tareaId}/documentos`);
  return response.data;
};

export const agregarDocumentoATarea = async (tareaId, documentoId) => {
  await client.post(`/tareas/${tareaId}/documentos`, { documento_id: documentoId });
};

export const quitarDocumentoDeTarea = async (tareaId, documentoId) => {
  await client.delete(`/tareas/${tareaId}/documentos/${documentoId}`);
};