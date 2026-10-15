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
      } catch {
        localStorage.removeItem('access_token');
        setUser(null);
      } finally {
        setLoading(false);
      }
    };
    verificarSesion();
  }, []);

  const login = async (identificador, password) => {
    setError(null);
    try {
      const data = await apiLogin(identificador, password);
      localStorage.setItem('access_token', data.access_token);
      // El usuario completo (cargo, equipos, si es administrador) sale de /me
      const usuario = await getMe();
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

  // Acceso total (interruptor de administrador de la persona)
  const esAdministrador = !!user?.es_administrador;
  // Un administrador lo tiene todo, aunque la lista de secciones que se cargo al entrar este desactualizada
  const tieneSeccion = (seccion) => esAdministrador || secciones.includes(seccion);

  // Tras editar el perfil, refleja los cambios sin volver a iniciar sesion
  const actualizarUsuario = (datos) => setUser((prev) => ({ ...prev, ...datos }));

  const value = {
    user,
    secciones,
    loading,
    error,
    login,
    logout,
    tieneSeccion,
    esAdministrador,
    actualizarUsuario,
    isAuthenticated: !!user,
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
