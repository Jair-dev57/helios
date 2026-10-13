import client from './client';

// Tareas que vencen y entregas de proyectos entre dos fechas 'AAAA-MM-DD' (incluidas)
export const listarEventos = async (desde, hasta, soloMias = true) => {
  const response = await client.get('/calendario', { params: { desde, hasta, solo_mias: soloMias } });
  return response.data;
};
