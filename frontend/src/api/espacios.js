import client from './client';

// { personal, equipo: [...] }: el espacio personal se crea la primera vez
// Avisa al menu lateral que se creo, edito o elimino un espacio
export const EVENTO_ESPACIOS = 'espacios:cambio';
const avisarCambio = () => window.dispatchEvent(new Event(EVENTO_ESPACIOS));

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
  avisarCambio();
  return response.data;
};

export const actualizarEspacio = async (id, data) => {
  const response = await client.put(`/espacios/${id}`, data);
  avisarCambio();
  return response.data;
};

export const eliminarEspacio = async (id) => {
  await client.delete(`/espacios/${id}`);
  avisarCambio();
};

// Ruta de un espacio en la app (los enlaces a /proyectos/:id de un espacio se redirigen aqui)
export const rutaEspacio = (espacio) => (espacio.tipo === 'personal' ? '/archivos' : `/archivos/equipo/${espacio.id}`);

// Donde abrir un documento o carpeta segun este en un proyecto, en Mis archivos o en un area.
// objeto: { tipo: 'documento' | 'carpeta', id, proyecto_id, proyecto_tipo }
export const rutaObjeto = (objeto) => {
  const base = objeto.proyecto_tipo === 'personal' ? '/archivos'
    : objeto.proyecto_tipo === 'equipo' ? `/archivos/equipo/${objeto.proyecto_id}`
      : `/proyectos/${objeto.proyecto_id}/documentos`;
  return `${base}?${objeto.tipo === 'carpeta' ? 'carpeta' : 'doc'}=${objeto.id}`;
};

// Clave de un documento o carpeta («d:ID» / «c:ID»): la misma de los Favoritos de la barra lateral
export const claveObjeto = (objeto) => `${objeto.tipo === 'documento' ? 'd' : 'c'}:${objeto.id}`;

// Nombre del lugar: "Mis archivos", el del espacio o el del proyecto
export const nombreLugar = (objeto) => (objeto.proyecto_tipo === 'personal' ? 'Mis archivos' : objeto.proyecto_nombre);
