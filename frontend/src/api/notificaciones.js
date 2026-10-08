import client from './client';

// { no_leidas, notificaciones: [{ id, tipo, texto, documento_id, proyecto_id, actor, leida, created_at }] }
export const obtenerNotificaciones = async () => {
  const response = await client.get('/notificaciones');
  return response.data;
};

export const marcarLeida = async (id) => {
  await client.post(`/notificaciones/${id}/leer`);
};

export const marcarTodasLeidas = async () => {
  await client.post('/notificaciones/leer-todas');
};
