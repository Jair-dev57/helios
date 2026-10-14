import PageContainer from '../../components/PageContainer';
import Proyectos from './Proyectos';

/** Recientes, Favoritos, Compartidos y Archivados de la barra lateral: el mismo explorador en otro lugar */
export default function ColeccionProyectos({ tipo }) {
  return (
    <PageContainer wide>
      <Proyectos key={tipo} coleccion={tipo} />
    </PageContainer>
  );
}
