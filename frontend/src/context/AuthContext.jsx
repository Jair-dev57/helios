import React, { createContext, useState, useEffect } from 'react';
import { login as apiLogin, logout as apiLogout, getMe } from '../api/auth';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
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
      return usuario;
    } catch (err) {
      setError('Credenciales invalidas');
      throw err;
    }
  };

  const logout = () => {
    apiLogout();
    setUser(null);
  };

  const value = { user, loading, error, login, logout, isAuthenticated: !!user };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};