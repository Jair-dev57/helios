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

  const login = async (identificador, password) => {
    setError(null);
    try {
      const data = await apiLogin(identificador, password);
      const { access_token, usuario_id, nombre, email, rol, username, avatar_url, es_administrador } = data;
      localStorage.setItem('access_token', access_token);
      const usuario = { id: usuario_id, nombre, email, rol, username, avatar_url, es_administrador };
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
  // Rol con acceso total (p. ej. Gerente): puede restringir documentos
  const esAdministrador = !!user?.es_administrador;

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
