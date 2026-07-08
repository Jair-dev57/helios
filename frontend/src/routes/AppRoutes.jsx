import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';
import { PrivateRoute } from './PrivateRoute';
import DashboardLayout from '../layouts/DashboardLayout';
import Login from '../pages/Login/Login';

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
            <Route index element={<div>Dashboard (proximamente)</div>} />
            <Route path="proyectos" element={<div>Proyectos (proximamente)</div>} />
            <Route path="clientes" element={<div>Clientes (proximamente)</div>} />
            <Route path="documentos" element={<div>Documentos (proximamente)</div>} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default AppRoutes;