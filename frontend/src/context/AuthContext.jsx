import React, { createContext, useState, useEffect } from 'react';
import { login as apiLogin, logout as apiLogout, getMe, getMisSecciones } from '../api/auth';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [secciones, setSecciones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const verificarSesion = async () => {
      const token = localStorage.getItem('access_token');
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const usuario = await getMe();
        setUser(usuario);
        const misSecciones = await getMisSecciones();
        setSecciones(misSecciones);
      } catch (err) {
        localStorage.removeItem('access_token');
        setUser(null);
      } finally {
        setLoading(false);
      }
    };
    verificarSesion();
  }, []);

  const login = async (email, password) => {
    setError(null);
    try {
      const data = await apiLogin(email, password);
      const { access_token, usuario_id, nombre, email: userEmail, rol } = data;
      localStorage.setItem('access_token', access_token);
      const usuario = { id: usuario_id, nombre, email: userEmail, rol };
      setUser(usuario);
      const misSecciones = await getMisSecciones();
      setSecciones(misSecciones);
      return usuario;
    } catch (err) {
      setError('Credenciales invalidas');
      throw err;
    }
  };

  const logout = () => {
    apiLogout();
    setUser(null);
    setSecciones([]);
  };

  const tieneSeccion = (seccion) => secciones.includes(seccion);

  const value = { user, secciones, loading, error, login, logout, tieneSeccion, isAuthenticated: !!user };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
