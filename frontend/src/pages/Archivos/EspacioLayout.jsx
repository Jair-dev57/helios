import { useCallback, useEffect, useState } from 'react';
import { Link, Outlet, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Users, Globe, Pencil, Layers, Folder } from 'lucide-react';
import { listarEspacios, obtenerEspacio } from '../../api/espacios';
import PageContainer from '../../components/ui/PageContainer';
import { useAuth } from '../../hooks/useAuth';
import { plural } from '../../utils/formato';
import Proyectos from '../Proyectos/Proyectos';
import ModalEspacio from '../../components/espacios/ModalEspacio';
import { useProyectosDelEquipo } from '../../hooks/useProyectosDelEquipo';
import shared from '../../styles/shared.module.css';
import IconoCarpeta from '../../components/ui/IconoCarpeta';
import cabecera from '../../styles/cabecera.module.css';
import styles from './Archivos.module.css';

// Los mismos que Proyectos deja fuera de la lista en curso
const ARCHIVADO = ['completado', 'cancelado'];

/**
 * Encabezado de un espacio de archivos y, debajo, el mismo explorador de Documentos de los proyectos
 * (recibe el espacio como «proyecto» por el contexto del Outlet). personal: Mis archivos del usuario.
 * Un equipo es una sola pagina con pestañas Proyectos | Archivos (?ver=); se llega desde el menu de
 * Proyectos (/proyectos/equipo/:id, abre en Proyectos) o de Archivos (/archivos/equipo/:id, abre en Archivos).
 */
export default function EspacioLayout({ personal = false, inicio = 'archivos' }) {
  const { id } = useParams();
  const { tieneSeccion, esAdministrador } = useAuth();
  const [espacio, setEspacio] = useState(null);
  const [error, setError] = useState('');
  const [editando, setEditando] = useState(false);
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();

  const esEquipo = !personal;
  const conProyectos = esEquipo && tieneSeccion('proyectos');
  const proyectosEquipo = useProyectosDelEquipo(conProyectos ? Number(id) : null);

  const cargar = useCallback(async () => {
    try {
      setEspacio(personal ? (await listarEspacios()).personal : await obtenerEspacio(id));
      setError('');
    } catch (err) {
      setError(err.response?.status === 404 ? 'Este equipo no existe o no tienes acceso.' : 'No se pudo cargar el equipo.');
    }
  }, [personal, id]);

  useEffect(() => { cargar(); }, [cargar]);

  const ver = conProyectos ? (params.get('ver') || inicio) : 'archivos';
  const elegir = (pestana) => {
    setParams(pestana === inicio ? {} : { ver: pestana }, { replace: true });
  };

  if (ver === 'archivos' && !tieneSeccion('documentos')) {
    return <PageContainer><p className={shared.errorBanner}>Tu rol necesita también la sección «Documentos» para ver archivos.</p></PageContainer>;
  }
  if (error) return <PageContainer><p className={shared.errorBanner}>{error}</p></PageContainer>;
  if (!espacio) return <p className={shared.loadingText} style={{ padding: '2rem' }}>Cargando…</p>;

  // Mis archivos no lleva cabecera: su nombre va en la ruta de la ventana, como en el explorador del sistema
  if (!esEquipo) {
    return (
      <PageContainer wide>
        <Outlet key={espacio.id} context={{ proyecto: espacio, enArchivos: true, proyectosEquipo }} />
      </PageContainer>
    );
  }

  const acceso = espacio.abierto
    ? { Icono: Globe, texto: 'Todo el equipo lo ve' }
    : { Icono: Users, texto: plural(espacio.miembro_ids.length, 'persona', 'personas') };
  const enCurso = proyectosEquipo?.filter((p) => !ARCHIVADO.includes(p.estado)).length;

  return (
    <PageContainer wide>
      {/* La misma cabecera que la pagina de un proyecto */}
      <header className={cabecera.header}>
        <IconoCarpeta color={espacio.color} size={38} />
        <div className={cabecera.cabeceraTexto}>
          <h1 className={cabecera.titulo}>
            <Link to="/archivos/equipo">Equipos</Link>
            <span>›</span>
            {espacio.nombre}
          </h1>
          <div className={cabecera.meta}>
            <span className={cabecera.dato}><acceso.Icono size={14} />{acceso.texto}</span>
            {espacio.descripcion && <span className={cabecera.dato}>{espacio.descripcion}</span>}
          </div>
        </div>
        {esAdministrador && (
          <div className={cabecera.headerAcciones}>
            <button type="button" className={cabecera.boton} onClick={() => setEditando(true)}>
              <Pencil size={15} /> Editar equipo
            </button>
          </div>
        )}
      </header>

      {conProyectos && (
        <nav className={cabecera.tabs} aria-label="Secciones del equipo">
          <button type="button" className={`${cabecera.tab} ${ver === 'proyectos' ? cabecera.tabActive : ''}`} aria-current={ver === 'proyectos' ? 'page' : undefined} onClick={() => elegir('proyectos')}>
            <Layers size={15} strokeWidth={1.8} /> Proyectos {enCurso != null && <span className={styles.cuentaPestana}>{enCurso}</span>}
          </button>
          <button type="button" className={`${cabecera.tab} ${ver === 'archivos' ? cabecera.tabActive : ''}`} aria-current={ver === 'archivos' ? 'page' : undefined} onClick={() => elegir('archivos')}>
            <Folder size={15} strokeWidth={1.8} /> Archivos
          </button>
        </nav>
      )}

      <div className={styles.contenidoEquipo}>
        {ver === 'proyectos' ? (
          <Proyectos areaId={espacio.id} />
        ) : (
          <Outlet key={espacio.id} context={{ proyecto: espacio, enArchivos: true, proyectosEquipo }} />
        )}
      </div>

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
