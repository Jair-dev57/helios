import client from './client';

export const listarTareas = async (proyectoId) => {
  const params = proyectoId ? { proyecto_id: proyectoId } : {};
  const response = await client.get('/tareas', { params });
  return response.data;
};

export const obtenerTarea = async (id) => {
  const response = await client.get(`/tareas/${id}`);
  return response.data;
};

export const crearTarea = async (data) => {
  const response = await client.post('/tareas', data);
  return response.data;
};

export const actualizarTarea = async (id, data) => {
  const response = await client.put(`/tareas/${id}`, data);
  return response.data;
};

export const eliminarTarea = async (id) => {
  await client.delete(`/tareas/${id}`);
};

export const listarDocumentosDeTarea = async (tareaId) => {
  const response = await client.get(`/tareas/${tareaId}/documentos`);
  return response.data;
};

export const agregarDocumentoATarea = async (tareaId, documentoId) => {
  await client.post(`/tareas/${tareaId}/documentos`, { documento_id: documentoId });
};

export const quitarDocumentoDeTarea = async (tareaId, documentoId) => {
  await client.delete(`/tareas/${tareaId}/documentos/${documentoId}`);
};
// Guarda el orden completo de una columna (y mueve ahi las tareas que venian de otra)
export const ordenarTareas = async (columnaId, tareaIds) => {
  await client.put('/tareas/orden', { columna_id: columnaId, tarea_ids: tareaIds });
};

// Sin proyecto devuelve las columnas de todos los proyectos
export const listarColumnas = async (proyectoId) => {
  const params = proyectoId ? { proyecto_id: proyectoId } : {};
  const response = await client.get('/columnas', { params });
  return response.data;
};

export const crearColumna = async (data) => {
  const response = await client.post('/columnas', data);
  return response.data;
};

export const actualizarColumna = async (id, data) => {
  const response = await client.put(`/columnas/${id}`, data);
  return response.data;
};

export const ordenarColumnas = async (proyectoId, columnaIds) => {
  const response = await client.put('/columnas/orden', { proyecto_id: proyectoId, columna_ids: columnaIds });
  return response.data;
};

// Si la columna tiene tareas, `moverA` es la columna que las recibe
export const eliminarColumna = async (id, moverA) => {
  await client.delete(`/columnas/${id}`, { params: moverA ? { mover_a: moverA } : {} });
};
