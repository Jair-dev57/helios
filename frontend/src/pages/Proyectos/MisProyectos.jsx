import { Navigate, useSearchParams } from 'react-router-dom';
import PageContainer from '../../components/ui/PageContainer';
import { useAuth } from '../../hooks/useAuth';
import Proyectos from './Proyectos';

/**
 * Todos los proyectos (el explorador). Enlaces viejos: ?ver=clientes lleva a Clientes (ahora en la barra
 * lateral) y ?area=ID a la pagina del equipo.
 */
export default function MisProyectos() {
  const { tieneSeccion } = useAuth();
  const [params] = useSearchParams();
  const areaId = Number(params.get('area')) || null;
  if (areaId) return <Navigate to={`/proyectos/equipo/${areaId}`} replace />;
  const soloClientes = !tieneSeccion('proyectos') && tieneSeccion('clientes');
  if (params.get('ver') === 'clientes' || soloClientes) return <Navigate to="/proyectos/clientes" replace />;
  if (!tieneSeccion('proyectos')) return <PageContainer><p>Tu rol no tiene acceso a proyectos ni a clientes.</p></PageContainer>;

  return (
    <PageContainer wide>
      <Proyectos />
    </PageContainer>
  );
}
