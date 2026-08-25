import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export const PrivateRoute = ({ children, seccion }) => {
  const { isAuthenticated, loading, tieneSeccion } = useAuth();

  if (loading) {
    return <div>Cargando...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (seccion && !tieneSeccion(seccion)) {
    return <Navigate to="/" replace />;
  }

  return children;
};
