import client from './client';

export const buscarGlobal = async (query) => {
  const { data } = await client.get('/busqueda', { params: { q: query } });
  return data;
};
