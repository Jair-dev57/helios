import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Copy, Settings2, Lock, CalendarClock } from 'lucide-react';
import { obtenerCompartidosGlobal } from '../../api/enlaces';
import PageContainer from '../../components/PageContainer';
import ModalCompartir from '../Proyectos/ModalCompartir';
import ObjetoCompartido from './ObjetoCompartido';
import { copiarEnlace } from './copiarEnlace';
import { fechaRelativa, fechaCompleta, nombreArchivo, plural } from '../Proyectos/formato';
import listado from '../../styles/listado.module.css';
import shared from '../../styles/shared.module.css';
import styles from './Archivos.module.css';

const formatoDia = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short' });

const PESTANAS = [
  ['contigo', 'Contigo'],
  ['tuyos', 'Por ti'],
  ['publicos', 'Enlaces públicos'],
];

/** Lo compartido en todos los proyectos y espacios: contigo (archivos restringidos) y por enlace */
export default function Compartidos() {
  const [datos, setDatos] = useState(null);
  const [pestana, setPestana] = useState('contigo');
  const [gestionando, setGestionando] = useState(null);

  const cargar = () => obtenerCompartidosGlobal()
    .then(setDatos)
    .catch(() => { setDatos({ conmigo: [], enlaces: [] }); toast.error('No se pudo cargar lo compartido.'); });
  useEffect(() => { cargar(); }, []);

  const verVigentes = (datos?.enlaces || []).filter((e) => e.permiso === 'ver' && e.vigente);
  const listas = {
    contigo: datos?.conmigo || [],
    tuyos: (datos?.enlaces || []).filter((e) => e.permiso === 'ver' && e.creado_por_mi),
    publicos: verVigentes,
  };
  const lista = listas[pestana];

  return (
    <PageContainer>
      <header className={listado.header}>
        <div>
          <h1 className={listado.title}>Compartidos</h1>
          <p className={styles.subtitulo}>Lo que te compartieron y los enlaces públicos, de todos tus proyectos y espacios.</p>
        </div>
      </header>

      <div className={listado.herramientas}>
        <div className={listado.pestanas} role="group" aria-label="Qué mostrar">
          {PESTANAS.map(([id, texto]) => (
            <button key={id} type="button" aria-pressed={pestana === id} onClick={() => setPestana(id)}>
              {texto} <span>{listas[id].length}</span>
            </button>
          ))}
        </div>
      </div>

      {datos === null ? (
        <p className={shared.loadingText}>Cargando…</p>
      ) : lista.length === 0 ? (
        <div className={listado.vacio}>
          <b>{pestana === 'contigo' ? 'Nadie te ha compartido archivos restringidos' : 'No hay enlaces'}</b>
          <span>
            {pestana === 'contigo'
              ? 'Cuando alguien te dé acceso a un archivo restringido, aparecerá aquí.'
              : 'Comparte un archivo o una carpeta con clic derecho → «Compartir enlace…».'}
          </span>
        </div>
      ) : pestana === 'contigo' ? (
        <ul className={styles.filas}>
          {lista.map((o) => (
            <li key={o.id} className={styles.filaCompartida}>
              <ObjetoCompartido objeto={o} detalle={<span title={fechaCompleta(o.updated_at)}>modificado {fechaRelativa(o.updated_at)}</span>} />
              <span className={`${styles.pastilla} ${styles.pastillaInfo}`}><Lock size={12} /> Restringido</span>
            </li>
          ))}
        </ul>
      ) : (
        <ul className={styles.filas}>
          {lista.map((e) => (
            <li key={e.id} className={`${styles.filaCompartida} ${e.vigente ? '' : styles.vencido}`}>
              <ObjetoCompartido
                objeto={e.objeto}
                detalle={pestana === 'publicos' && !e.creado_por_mi ? `por ${e.creado_por || 'alguien'}` : `creado ${fechaRelativa(e.created_at)}`}
              />
              <span className={styles.datosEnlace}>
                <span>{plural(e.accesos, 'visita', 'visitas')}</span>
                {e.tiene_contrasena && <span title="Con contraseña"><Lock size={12} /></span>}
                {e.expira_at && (
                  <span title={fechaCompleta(e.expira_at)}>
                    <CalendarClock size={12} /> {e.vigente ? `hasta ${formatoDia.format(new Date(e.expira_at))}` : 'Vencido'}
                  </span>
                )}
              </span>
              <span className={styles.accionesFila}>
                {e.vigente && (
                  <button className={styles.botonFila} onClick={() => copiarEnlace(e.token)} title="Copiar enlace">
                    <Copy size={14} /> <span>Copiar</span>
                  </button>
                )}
                <button
                  className={styles.botonFila}
                  onClick={() => setGestionando({
                    tipo: e.objeto.tipo,
                    id: e.objeto.id,
                    nombre: e.objeto.tipo === 'documento' ? nombreArchivo(e.objeto.nombre, e.objeto.extension) : e.objeto.nombre,
                  })}
                  title="Gestionar enlaces"
                  aria-label="Gestionar enlaces"
                >
                  <Settings2 size={14} />
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      {gestionando && <ModalCompartir objetivo={gestionando} onClose={() => { setGestionando(null); cargar(); }} />}
    </PageContainer>
  );
}
