import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';
import { PrivateRoute } from './PrivateRoute';
import DashboardLayout from '../layouts/DashboardLayout';
import Login from '../pages/Login/Login';
import Clientes from '../pages/Clientes/Clientes';
import Proyectos from '../pages/Proyectos/Proyectos';
import ProyectoLayout from '../pages/Proyectos/ProyectoLayout';
import ProyectoResumen from '../pages/Proyectos/ProyectoResumen';
import ProyectoDocumentos from '../pages/Proyectos/ProyectoDocumentos';
import ProyectoTareas from '../pages/Proyectos/ProyectoTareas';
import Documentos from '../pages/Documentos/Documentos';
import Dashboard from '../pages/Dashboard/Dashboard';

const AppRoutes = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/"
            element={
              <PrivateRoute>
                <DashboardLayout />
              </PrivateRoute>
            }
          >
            <Route index element={<Dashboard />} />
            <Route path="proyectos" element={<Proyectos />} />
            <Route path="proyectos/:id" element={<ProyectoLayout />}>
              <Route index element={<ProyectoResumen />} />
              <Route path="documentos" element={<ProyectoDocumentos />} />
              <Route path="tareas" element={<ProyectoTareas />} />
            </Route>
            <Route path="clientes" element={<Clientes />} />
            <Route path="documentos" element={<Documentos />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default AppRoutes;