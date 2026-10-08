import client from './client';

// Raices de la papelera del proyecto: [{ tipo, id, nombre, extension, ubicacion, eliminado_at, expira_at, ... }]
export const listarPapelera = async (proyectoId) => {
  const response = await client.get('/papelera', { params: { proyecto_id: proyectoId } });
  return response.data;
};

// tipo: 'carpeta' | 'documento'. Devuelve { carpeta_id } donde quedo lo restaurado
export const restaurarDePapelera = async (tipo, id) => {
  const response = await client.post(`/papelera/${tipo}/${id}/restaurar`);
  return response.data;
};

// Solo administradores: no se puede deshacer
export const eliminarDePapelera = async (tipo, id) => {
  await client.delete(`/papelera/${tipo}/${id}`);
};

export const vaciarPapelera = async (proyectoId) => {
  const response = await client.post('/papelera/vaciar', null, { params: { proyecto_id: proyectoId } });
  return response.data;
};
