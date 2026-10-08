import client from './client';

export const listarComentarios = async (documentoId) => {
  const response = await client.get(`/documentos/${documentoId}/comentarios`);
  return response.data;
};

// Las menciones van en el texto como @[Nombre](usuario_id)
export const crearComentario = async (documentoId, texto) => {
  const response = await client.post(`/documentos/${documentoId}/comentarios`, { texto });
  return response.data;
};

export const editarComentario = async (id, texto) => {
  const response = await client.put(`/comentarios/${id}`, { texto });
  return response.data;
};

export const eliminarComentario = async (id) => {
  await client.delete(`/comentarios/${id}`);
};
