import { BrowserRouter, Routes, Route, Navigate, useLocation, useParams } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';
import { PrivateRoute } from './PrivateRoute';
import DashboardLayout from '../layouts/DashboardLayout';
import Login from '../pages/Login/Login';
import Compartido from '../pages/Compartido/Compartido';
import MisProyectos from '../pages/Proyectos/MisProyectos';
import ColeccionProyectos from '../pages/Proyectos/ColeccionProyectos';
import Proyectos from '../pages/Proyectos/Proyectos';
import Clientes from '../pages/Clientes/Clientes';
import PageContainer from '../components/PageContainer';
import ProyectoLayout from '../pages/Proyectos/ProyectoLayout';
import ProyectoResumen from '../pages/Proyectos/ProyectoResumen';
import ProyectoDocumentos from '../pages/Proyectos/ProyectoDocumentos';
import ProyectoTareas from '../pages/Proyectos/ProyectoTareas';
import Inicio from '../pages/Inicio/Inicio';
import Configuracion from '../pages/Configuracion/Configuracion';
import MisTareas from '../pages/MisTareas/MisTareas';
import Calendario from '../pages/Calendario/Calendario';
import Actividad from '../pages/Actividad/Actividad';
import EspacioLayout from '../pages/Archivos/EspacioLayout';
import ArchivosEquipo from '../pages/Archivos/ArchivosEquipo';
import Compartidos from '../pages/Archivos/Compartidos';
import PapeleraGlobal from '../pages/Archivos/PapeleraGlobal';
import Recientes from '../pages/Archivos/Recientes';
import Favoritos from '../pages/Archivos/Favoritos';

// /archivos/proyectos/:id (enlaces viejos) -> pestaña Documentos del proyecto, conservando ?doc=…
const DocumentosDelProyecto = () => {
  const { id } = useParams();
  const { search } = useLocation();
  return <Navigate to={`/proyectos/${id}/documentos${search}`} replace />;
};

// Un cliente abierto como carpeta: sus proyectos en el explorador
const ClienteAbierto = () => {
  const { id } = useParams();
  return <PageContainer wide><Proyectos key={id} clienteId={Number(id)} /></PageContainer>;
};

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
            {/* El Dashboard se reemplazó por las alertas de Mis proyectos; Clientes es una pestaña */}
            <Route path="dashboard" element={<Navigate to="/proyectos" replace />} />
            <Route path="mis-tareas" element={<PrivateRoute seccion="mis_tareas"><MisTareas /></PrivateRoute>} />
            <Route path="calendario" element={<PrivateRoute seccion="calendario"><Calendario /></PrivateRoute>} />
            <Route path="actividad" element={<PrivateRoute seccion="actividad"><Actividad /></PrivateRoute>} />
            {/* Espacios de archivos: el explorador de Documentos con el espacio como proyecto */}
            <Route path="archivos" element={<PrivateRoute seccion="archivos"><EspacioLayout personal /></PrivateRoute>}>
              <Route index element={<ProyectoDocumentos />} />
            </Route>
            <Route path="archivos/equipo" element={<PrivateRoute seccion="archivos"><ArchivosEquipo /></PrivateRoute>} />
            <Route path="archivos/recientes" element={<PrivateRoute seccion="archivos"><Recientes /></PrivateRoute>} />
            <Route path="archivos/favoritos" element={<PrivateRoute seccion="archivos"><Favoritos /></PrivateRoute>} />
            <Route path="archivos/compartidos" element={<PrivateRoute seccion="archivos"><Compartidos /></PrivateRoute>} />
            {/* Solicitudes ahora es una pestaña de Compartidos */}
            <Route path="archivos/solicitudes" element={<Navigate to="/archivos/compartidos?ver=solicitudes" replace />} />
            <Route path="archivos/papelera" element={<PrivateRoute seccion="archivos"><PapeleraGlobal /></PrivateRoute>} />
            <Route path="archivos/equipo/:id" element={<PrivateRoute seccion="archivos"><EspacioLayout /></PrivateRoute>}>
              <Route index element={<ProyectoDocumentos />} />
            </Route>
            {/* Los documentos de un proyecto viven en el proyecto; se conservan los enlaces viejos */}
            <Route path="archivos/proyectos" element={<Navigate to="/proyectos" replace />} />
            <Route path="archivos/proyectos/:id" element={<DocumentosDelProyecto />} />
            <Route path="proyectos" element={<MisProyectos />} />
            {/* La misma pagina del equipo que en Archivos, abierta en la pestaña Proyectos */}
            <Route path="proyectos/equipo/:id" element={<PrivateRoute seccion="archivos"><EspacioLayout inicio="proyectos" /></PrivateRoute>}>
              <Route index element={<ProyectoDocumentos />} />
            </Route>
            {/* Las mismas vistas de Archivos, para proyectos */}
            <Route path="proyectos/clientes" element={<PrivateRoute seccion="clientes"><PageContainer wide><Clientes /></PageContainer></PrivateRoute>} />
            <Route path="proyectos/clientes/:id" element={<PrivateRoute seccion="clientes"><ClienteAbierto /></PrivateRoute>} />
            {['recientes', 'favoritos', 'compartidos', 'archivados'].map((tipo) => (
              <Route key={tipo} path={`proyectos/${tipo}`} element={<PrivateRoute seccion="proyectos"><ColeccionProyectos tipo={tipo} /></PrivateRoute>} />
            ))}
            <Route path="proyectos/:id" element={<ProyectoLayout />}>
              <Route index element={<ProyectoResumen />} />
              <Route path="documentos" element={<ProyectoDocumentos />} />
              <Route path="tareas" element={<ProyectoTareas />} />
            </Route>
            <Route path="clientes" element={<Navigate to="/proyectos/clientes" replace />} />
            {/* Equipo ahora vive dentro de Configuracion */}
            <Route path="equipo" element={<Navigate to="/configuracion?tab=equipo" replace />} />
            <Route path="configuracion" element={<Configuracion />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default AppRoutes;
