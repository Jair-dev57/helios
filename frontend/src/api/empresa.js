import client from './client';

export const obtenerEmpresaPublica = async () => {
  const response = await client.get('/empresa/publica');
  return response.data; // { nombre, logo_url }
};

export const obtenerEmpresa = async () => {
  const response = await client.get('/empresa');
  return response.data;
};

export const actualizarEmpresa = async (data) => {
  const response = await client.put('/empresa', data);
  return response.data;
};

export const subirLogoEmpresa = async (archivo) => {
  const formData = new FormData();
  formData.append('archivo', archivo);
  const response = await client.post('/empresa/logo', formData);
  return response.data;
};

export const quitarLogoEmpresa = async () => {
  const response = await client.delete('/empresa/logo');
  return response.data;
};
