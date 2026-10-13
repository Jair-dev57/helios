import { useCallback, useEffect, useState } from 'react';
import { Outlet, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Lock, Users, Globe, Pencil } from 'lucide-react';
import { listarEspacios, obtenerEspacio } from '../../api/espacios';
import PageContainer from '../../components/PageContainer';
import { useAuth } from '../../hooks/useAuth';
import { plural } from '../Proyectos/formato';
import Proyectos from '../Proyectos/Proyectos';
import ModalEspacio from './ModalEspacio';
import { AccesoProyectos, CarpetaProyectos, useProyectosDelEquipo } from './ProyectosDelEquipo';
import shared from '../../styles/shared.module.css';
import pestanas from '../Proyectos/MisProyectos.module.css';
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
  // El explorador avisa la carpeta abierta: la carpeta «Proyectos» solo se muestra en la raiz
  const [carpetaAbierta, setCarpetaAbierta] = useState(null);
  const [viendoProyectos, setViendoProyectos] = useState(false);
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
  useEffect(() => { setViendoProyectos(false); }, [id]);

  const ver = conProyectos ? (params.get('ver') || inicio) : 'archivos';
  const elegir = (pestana) => {
    setViendoProyectos(false);
    setParams(pestana === inicio ? {} : { ver: pestana }, { replace: true });
  };

  if (ver === 'archivos' && !tieneSeccion('documentos')) {
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
      <header className={styles.cabeceraEspacio}>
        <span className={styles.marcaEspacio} style={{ background: espacio.color || 'var(--accent)' }} aria-hidden="true" />
        <div className={styles.cabeceraTexto}>
          <h1>{espacio.nombre}</h1>
          <p>
            <acceso.Icono size={14} /> {acceso.texto}
            {espacio.descripcion && <> · {espacio.descripcion}</>}
          </p>
        </div>
        {esEquipo && esAdministrador && (
          <button className={shared.btnSecondary} onClick={() => setEditando(true)}>
            <Pencil size={15} /> Editar equipo
          </button>
        )}
      </header>

      {conProyectos && (
        <nav className={`${pestanas.pestanas} ${styles.pestanasEquipo}`} aria-label="Secciones del equipo">
          <button type="button" aria-current={ver === 'proyectos' ? 'page' : undefined} onClick={() => elegir('proyectos')}>
            Proyectos {proyectosEquipo && <span className={styles.cuentaPestana}>{proyectosEquipo.filter((p) => !ARCHIVADO.includes(p.estado)).length}</span>}
          </button>
          <button type="button" aria-current={ver === 'archivos' ? 'page' : undefined} onClick={() => elegir('archivos')}>
            Archivos
          </button>
        </nav>
      )}

      {ver === 'proyectos' ? (
        <Proyectos areaId={espacio.id} />
      ) : viendoProyectos ? (
        <CarpetaProyectos equipo={espacio} proyectos={proyectosEquipo} onVolver={() => setViendoProyectos(false)} />
      ) : (
        <>
          {conProyectos && carpetaAbierta === null && (
            <AccesoProyectos proyectos={proyectosEquipo} onAbrir={() => setViendoProyectos(true)} />
          )}
          <Outlet key={espacio.id} context={{ proyecto: espacio, enArchivos: true, alCambiarCarpeta: setCarpetaAbierta }} />
        </>
      )}

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
