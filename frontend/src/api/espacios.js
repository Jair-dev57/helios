import client from './client';

// { personal, equipo: [...] }: el espacio personal se crea la primera vez
export const listarEspacios = async () => {
  const response = await client.get('/espacios');
  return response.data;
};

export const obtenerEspacio = async (id) => {
  const response = await client.get(`/espacios/${id}`);
  return response.data;
};

// Solo administradores. data: { nombre, descripcion?, color?, abierto, miembro_ids }
export const crearEspacio = async (data) => {
  const response = await client.post('/espacios', data);
  return response.data;
};

export const actualizarEspacio = async (id, data) => {
  const response = await client.put(`/espacios/${id}`, data);
  return response.data;
};

export const eliminarEspacio = async (id) => {
  await client.delete(`/espacios/${id}`);
};

// Ruta de un espacio en la app (los enlaces a /proyectos/:id de un espacio se redirigen aqui)
export const rutaEspacio = (espacio) => (espacio.tipo === 'personal' ? '/archivos' : `/archivos/equipo/${espacio.id}`);
