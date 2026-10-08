import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// Cliente propio, sin sesion: la pagina publica no debe enviar el token de quien tenga Helios abierto
// ni redirigir al login ante un error
const publico = axios.create({ baseURL: API_URL });

const cabeceras = (contrasena) => (contrasena ? { 'X-Contrasena-Enlace': contrasena } : {});

export const verEnlace = async (token, contrasena) => {
  const response = await publico.get(`/compartido/${token}`, { headers: cabeceras(contrasena) });
  return response.data;
};

// documentoId solo en enlaces a carpetas (archivo dentro de la carpeta)
export const descargarDeEnlace = async (token, contrasena, documentoId) => {
  const ruta = documentoId ? `/compartido/${token}/documentos/${documentoId}/archivo` : `/compartido/${token}/archivo`;
  const response = await publico.get(ruta, { headers: cabeceras(contrasena), responseType: 'blob' });
  return response.data;
};

export const descargarZipDeEnlace = async (token, contrasena) => {
  const response = await publico.get(`/compartido/${token}/zip`, { headers: cabeceras(contrasena), responseType: 'blob' });
  return response.data;
};

export const enviarAEnlace = async (token, contrasena, archivo, remitente, onUploadProgress) => {
  const formData = new FormData();
  formData.append('archivo', archivo);
  if (remitente) formData.append('remitente', remitente);
  const response = await publico.post(`/compartido/${token}/subir`, formData, {
    headers: cabeceras(contrasena),
    onUploadProgress,
  });
  return response.data;
};
