import client from './client';

// Los Favoritos de la barra lateral de Proyectos se recargan cuando se marca, quita u ordena uno
export const EVENTO_FAVORITOS_PROYECTOS = 'favoritos-proyectos:cambio';
const avisarFavoritosProyectos = () => window.dispatchEvent(new Event(EVENTO_FAVORITOS_PROYECTOS));

// { documentos: [ids], carpetas: [ids] } con estrella del usuario en el proyecto
export const obtenerFavoritos = async (proyectoId) => {
  const response = await client.get('/favoritos', { params: { proyecto_id: proyectoId } });
  return response.data;
};

// objetivo: { documento_id }, { carpeta_id } o { proyecto_id }
export const marcarFavorito = async (objetivo, favorito) => {
  await client.put('/favoritos', { ...objetivo, favorito });
  if (objetivo.proyecto_id) avisarFavoritosProyectos();
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

// Proyectos: ids de los proyectos con estrella, en el orden de la barra lateral
export const obtenerProyectosFavoritos = async () => {
  const response = await client.get('/proyectos/favoritos');
  return response.data;
};

// Orden de los Favoritos de la barra lateral (arrastrar para ordenar)
export const ordenarProyectosFavoritos = async (proyectoIds) => {
  await client.put('/proyectos/favoritos/orden', { proyecto_ids: proyectoIds });
  avisarFavoritosProyectos();
};

// [{ proyecto_id, visto_at }] de los proyectos abiertos hace poco
export const obtenerProyectosRecientes = async () => {
  const response = await client.get('/proyectos/recientes');
  return response.data;
};

export const registrarProyectoVisto = async (proyectoId) => {
  await client.post(`/proyectos/${proyectoId}/visto`);
};
