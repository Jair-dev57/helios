import client from './client';

// [{ id, nombre, color, documentos }]
export const listarEtiquetas = async (proyectoId) => {
  const response = await client.get('/etiquetas', { params: { proyecto_id: proyectoId } });
  return response.data;
};

export const crearEtiqueta = async (data) => {
  const response = await client.post('/etiquetas', data);
  return response.data;
};

export const actualizarEtiqueta = async (id, data) => {
  await client.put(`/etiquetas/${id}`, data);
};

export const eliminarEtiqueta = async (id) => {
  await client.delete(`/etiquetas/${id}`);
};

// Reemplaza las etiquetas del documento; devuelve las que quedaron
export const asignarEtiquetas = async (documentoId, etiquetaIds) => {
  const response = await client.put(`/documentos/${documentoId}/etiquetas`, { etiqueta_ids: etiquetaIds });
  return response.data;
};
