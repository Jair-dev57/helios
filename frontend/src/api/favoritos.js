import client from './client';

// { documentos: [ids], carpetas: [ids] } con estrella del usuario en el proyecto
export const obtenerFavoritos = async (proyectoId) => {
  const response = await client.get('/favoritos', { params: { proyecto_id: proyectoId } });
  return response.data;
};

// objetivo: { documento_id } o { carpeta_id }
export const marcarFavorito = async (objetivo, favorito) => {
  await client.put('/favoritos', { ...objetivo, favorito });
};

// Ids de los documentos que el usuario abrio hace poco, el mas reciente primero
export const obtenerRecientes = async (proyectoId) => {
  const response = await client.get('/recientes', { params: { proyecto_id: proyectoId } });
  return response.data;
};

export const registrarVisto = async (documentoId) => {
  await client.post(`/documentos/${documentoId}/visto`);
};
