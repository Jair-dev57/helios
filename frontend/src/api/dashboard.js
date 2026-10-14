import client from './client';

// Metricas del Inicio para [desde, hasta) (Date); la zona del navegador agrupa la actividad por dia
export const obtenerDashboard = async ({ desde, hasta, soloMias = false }) => {
  const { data } = await client.get('/dashboard', {
    params: {
      desde: desde.toISOString(),
      hasta: hasta.toISOString(),
      zona: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      solo_mias: soloMias,
    },
  });
  return data;
};
