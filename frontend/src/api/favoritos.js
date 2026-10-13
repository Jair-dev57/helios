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
  const response = await client.get('/recientes', { params: { proyecto_id: proyectoId, limite: 20 } });
  return response.data;
};

export const registrarVisto = async (documentoId) => {
  await client.post(`/documentos/${documentoId}/visto`);
};

// Menu Archivos: carpetas y documentos con estrella en todos los proyectos y espacios (ObjetoCompartido)
export const obtenerFavoritosGlobal = async () => {
  const response = await client.get('/favoritos/todo');
  return response.data;
};

// Menu Archivos: documentos abiertos hace poco en todos los proyectos y espacios, con visto_at
export const obtenerRecientesGlobal = async () => {
  const response = await client.get('/recientes/todo');
  return response.data;
};

// Mis proyectos: ids de los proyectos con estrella, el ultimo marcado primero
export const obtenerProyectosFavoritos = async () => {
  const response = await client.get('/proyectos/favoritos');
  return response.data;
};

// [{ proyecto_id, visto_at }] de los proyectos abiertos hace poco
export const obtenerProyectosRecientes = async () => {
  const response = await client.get('/proyectos/recientes');
  return response.data;
};

export const registrarProyectoVisto = async (proyectoId) => {
  await client.post(`/proyectos/${proyectoId}/visto`);
};
