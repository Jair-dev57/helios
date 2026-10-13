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
import Inicio from '../pages/Inicio/Inicio';
import Configuracion from '../pages/Configuracion/Configuracion';
import MisTareas from '../pages/MisTareas/MisTareas';
import Calendario from '../pages/Calendario/Calendario';
import Actividad from '../pages/Actividad/Actividad';
import EspacioLayout from '../pages/Archivos/EspacioLayout';
import ArchivosEquipo from '../pages/Archivos/ArchivosEquipo';
import Compartidos from '../pages/Archivos/Compartidos';
import Solicitudes from '../pages/Archivos/Solicitudes';
import PapeleraGlobal from '../pages/Archivos/PapeleraGlobal';

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
            {/* Inicio es para todos; cada panel depende de la seccion correspondiente */}
            <Route index element={<Inicio />} />
            <Route path="dashboard" element={<PrivateRoute seccion="dashboard"><Dashboard /></PrivateRoute>} />
            <Route path="mis-tareas" element={<PrivateRoute seccion="mis_tareas"><MisTareas /></PrivateRoute>} />
            <Route path="calendario" element={<PrivateRoute seccion="calendario"><Calendario /></PrivateRoute>} />
            <Route path="actividad" element={<PrivateRoute seccion="actividad"><Actividad /></PrivateRoute>} />
            {/* Espacios de archivos: el explorador de Documentos con el espacio como proyecto */}
            <Route path="archivos" element={<PrivateRoute seccion="archivos"><EspacioLayout personal /></PrivateRoute>}>
              <Route index element={<ProyectoDocumentos />} />
            </Route>
            <Route path="archivos/equipo" element={<PrivateRoute seccion="archivos"><ArchivosEquipo /></PrivateRoute>} />
            <Route path="archivos/compartidos" element={<PrivateRoute seccion="archivos"><Compartidos /></PrivateRoute>} />
            <Route path="archivos/solicitudes" element={<PrivateRoute seccion="archivos"><Solicitudes /></PrivateRoute>} />
            <Route path="archivos/papelera" element={<PrivateRoute seccion="archivos"><PapeleraGlobal /></PrivateRoute>} />
            <Route path="archivos/equipo/:id" element={<PrivateRoute seccion="archivos"><EspacioLayout /></PrivateRoute>}>
              <Route index element={<ProyectoDocumentos />} />
            </Route>
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
