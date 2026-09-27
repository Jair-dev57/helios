import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const client = axios.create({
  baseURL: API_URL,
});

// URL absoluta de un archivo publico del backend (logo de la empresa, avatares)
export const urlPublica = (ruta) => (ruta ? `${API_URL}${ruta}` : null);

// Mensaje de error que devuelve el backend, o uno por defecto
export const mensajeError = (err, porDefecto) => err?.response?.data?.detail || porDefecto;

// Interceptor para agregar token
client.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Interceptor para manejar 401 (token expirado o invalido)
client.interceptors.response.use(
  (response) => response,
  (error) => {
    // En el login un 401 significa credenciales invalidas, no sesion expirada
    if (error.response?.status === 401 && !error.config?.url?.includes('/auth/login')) {
      localStorage.removeItem('access_token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default client;