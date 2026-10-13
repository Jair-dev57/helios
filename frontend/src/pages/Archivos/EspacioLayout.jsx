import { useCallback, useEffect, useState } from 'react';
import { Link, Outlet, useNavigate, useParams } from 'react-router-dom';
import { Lock, Users, Globe, Pencil } from 'lucide-react';
import { listarEspacios, obtenerEspacio } from '../../api/espacios';
import PageContainer from '../../components/PageContainer';
import { useAuth } from '../../hooks/useAuth';
import { plural } from '../Proyectos/formato';
import ModalEspacio from './ModalEspacio';
import shared from '../../styles/shared.module.css';
import styles from './Archivos.module.css';

/**
 * Encabezado de un espacio de archivos y, debajo, el mismo explorador de Documentos de los proyectos
 * (recibe el espacio como «proyecto» por el contexto del Outlet). personal: Mis archivos del usuario.
 */
export default function EspacioLayout({ personal = false }) {
  const { id } = useParams();
  const { tieneSeccion, esAdministrador } = useAuth();
  const [espacio, setEspacio] = useState(null);
  const [error, setError] = useState('');
  const [editando, setEditando] = useState(false);
  const navigate = useNavigate();

  const cargar = useCallback(async () => {
    try {
      setEspacio(personal ? (await listarEspacios()).personal : await obtenerEspacio(id));
      setError('');
    } catch (err) {
      setError(err.response?.status === 404 ? 'Esta área no existe o no tienes acceso.' : 'No se pudo cargar el área.');
    }
  }, [personal, id]);

  useEffect(() => { cargar(); }, [cargar]);

  if (!tieneSeccion('documentos')) {
    return <PageContainer><p className={shared.errorBanner}>Tu rol necesita también la sección «Documentos» para ver archivos.</p></PageContainer>;
  }
  if (error) return <PageContainer><p className={shared.errorBanner}>{error}</p></PageContainer>;
  if (!espacio) return <p className={shared.loadingText} style={{ padding: '2rem' }}>Cargando…</p>;

  const acceso = espacio.tipo === 'personal'
    ? { Icono: Lock, texto: 'Solo tú lo ves, a menos que compartas algo' }
    : espacio.abierto
      ? { Icono: Globe, texto: 'Todo el equipo lo ve' }
      : { Icono: Users, texto: plural(espacio.miembro_ids.length, 'persona', 'personas') };

  return (
    <PageContainer wide>
      {espacio.tipo === 'equipo' && (
        <div className={styles.migas}><Link to="/archivos/equipo">Áreas</Link> / <span>{espacio.nombre}</span></div>
      )}
      <header className={styles.cabeceraEspacio}>
        <span className={styles.marcaEspacio} style={{ background: espacio.color || 'var(--accent)' }} aria-hidden="true" />
        <div className={styles.cabeceraTexto}>
          <h1>{espacio.nombre}</h1>
          <p>
            <acceso.Icono size={14} /> {acceso.texto}
            {espacio.descripcion && <> · {espacio.descripcion}</>}
          </p>
        </div>
        {espacio.tipo === 'equipo' && esAdministrador && (
          <button className={shared.btnSecondary} onClick={() => setEditando(true)}>
            <Pencil size={15} /> Editar área
          </button>
        )}
      </header>

      <Outlet key={espacio.id} context={{ proyecto: espacio, enArchivos: true }} />

      {editando && (
        <ModalEspacio
          espacio={espacio}
          onClose={() => setEditando(false)}
          onGuardado={(nuevo) => { setEspacio(nuevo); setEditando(false); }}
          onEliminado={() => navigate('/archivos/equipo')}
        />
      )}
    </PageContainer>
  );
}
