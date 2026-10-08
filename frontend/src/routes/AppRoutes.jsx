import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';
import { PrivateRoute } from './PrivateRoute';
import DashboardLayout from '../layouts/DashboardLayout';
import Login from '../pages/Login/Login';
import Compartido from '../pages/Compartido/Compartido';
import Clientes from '../pages/Clientes/Clientes';
import Proyectos from '../pages/Proyectos/Proyectos';
import ProyectoLayout from '../pages/Proyectos/ProyectoLayout';
import ProyectoResumen from '../pages/Proyectos/ProyectoResumen';
import ProyectoDocumentos from '../pages/Proyectos/ProyectoDocumentos';
import ProyectoTareas from '../pages/Proyectos/ProyectoTareas';
import Dashboard from '../pages/Dashboard/Dashboard';
import Configuracion from '../pages/Configuracion/Configuracion';

const AppRoutes = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          {/* Enlaces compartidos: se abren sin cuenta */}
          <Route path="/s/:token" element={<Compartido />} />
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
            {/* Equipo ahora vive dentro de Configuracion */}
            <Route path="equipo" element={<Navigate to="/configuracion?tab=usuarios" replace />} />
            <Route path="configuracion" element={<Configuracion />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default AppRoutes;
