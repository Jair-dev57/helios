import PageContainer from '../../components/PageContainer';
import Proyectos from './Proyectos';
import listado from '../../styles/listado.module.css';
import styles from './MisProyectos.module.css';

const TITULOS = {
  recientes: ['Recientes', 'Los proyectos que abriste hace poco.'],
  favoritos: ['Favoritos', 'Los proyectos que marcaste con estrella.'],
  compartidos: ['Compartidos', 'Proyectos de otras personas donde tienes tareas asignadas.'],
  archivados: ['Archivados', 'Proyectos completados o cancelados.'],
};

/** Recientes, Favoritos, Compartidos y Archivados del menu de Proyectos: la misma vista de Mis proyectos filtrada */
export default function ColeccionProyectos({ tipo }) {
  const [titulo, subtitulo] = TITULOS[tipo];
  return (
    <PageContainer wide>
      <header className={styles.cabecera}>
        <div>
          <h1 className={listado.title}>{titulo}</h1>
          <p className={styles.subtitulo}>{subtitulo}</p>
        </div>
      </header>
      <Proyectos key={tipo} coleccion={tipo} />
    </PageContainer>
  );
}
