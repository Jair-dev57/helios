import client from './client';

export const obtenerDashboard = async () => {
  const response = await client.get('/dashboard');
  return response.data;
};