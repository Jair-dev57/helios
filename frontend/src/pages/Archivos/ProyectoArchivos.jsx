import { useCallback, useEffect, useState } from 'react';
import { Link, Navigate, Outlet, useLocation, useParams } from 'react-router-dom';
import { ArrowUpRight, CalendarClock } from 'lucide-react';
import { obtenerProyecto } from '../../api/proyectos';
import { rutaEspacio } from '../../api/espacios';
import PageContainer from '../../components/PageContainer';
import { useAuth } from '../../hooks/useAuth';
import { NOMBRE_ESTADO } from '../Proyectos/formato';
import shared from '../../styles/shared.module.css';
import styles from './Archivos.module.css';

/** Los documentos de un proyecto dentro de Archivos: el mismo explorador de la pestaña Documentos del proyecto */
export default function ProyectoArchivos() {
  const { id } = useParams();
  const { search } = useLocation();
  const { tieneSeccion } = useAuth();
  const [proyecto, setProyecto] = useState(null);
  const [error, setError] = useState('');

  const cargar = useCallback(async () => {
    try {
      setProyecto(await obtenerProyecto(id));
      setError('');
    } catch (err) {
      setError(err.response?.status === 404 ? 'Este proyecto no existe o no tienes acceso.' : 'No se pudo cargar el proyecto.');
    }
  }, [id]);

  useEffect(() => { cargar(); }, [cargar]);

  if (!tieneSeccion('documentos')) {
    return <PageContainer><p className={shared.errorBanner}>Tu rol necesita también la sección «Documentos» para ver archivos.</p></PageContainer>;
  }
  if (error) return <PageContainer><p className={shared.errorBanner}>{error}</p></PageContainer>;
  if (!proyecto) return <p className={shared.loadingText} style={{ padding: '2rem' }}>Cargando…</p>;
  // Un espacio tiene su propia ruta; se conserva ?doc=…
  if (proyecto.tipo && proyecto.tipo !== 'proyecto') return <Navigate to={`${rutaEspacio(proyecto)}${search}`} replace />;

  return (
    <PageContainer wide>
      <div className={styles.migas}><Link to="/archivos/proyectos">Proyectos</Link> / <span>{proyecto.nombre}</span></div>
      <header className={styles.cabeceraEspacio}>
        <span className={styles.marcaEspacio} style={{ background: 'var(--accent)' }} aria-hidden="true" />
        <div className={styles.cabeceraTexto}>
          <h1>{proyecto.nombre}</h1>
          <p>
            {NOMBRE_ESTADO[proyecto.estado] || proyecto.estado}
            {proyecto.fecha_vencimiento && <> · <CalendarClock size={14} /> Vence {proyecto.fecha_vencimiento.slice(0, 10)}</>}
          </p>
        </div>
        {tieneSeccion('proyectos') && (
          <Link to={`/proyectos/${proyecto.id}`} className={`${shared.btnSecondary} ${styles.botonEnlace}`}>
            Abrir proyecto <ArrowUpRight size={15} />
          </Link>
        )}
      </header>

      <Outlet key={proyecto.id} context={{ proyecto }} />
    </PageContainer>
  );
}
