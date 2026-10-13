import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Check, FolderKanban } from 'lucide-react';
import { listarMisTareas, marcarTareaTerminada, EVENTO_MIS_TAREAS } from '../../api/tareas';
import PageContainer from '../../components/PageContainer';
import { diasHasta, vencimientoTarea } from '../Proyectos/formato';
import { useVistaGuardada } from '../../hooks/useVistaGuardada';
import listado from '../../styles/listado.module.css';
import styles from './MisTareas.module.css';

const dias = (t) => (t.fecha_vencimiento ? diasHasta(t.fecha_vencimiento) : null);

const PESTANAS = [
  ['pendientes', 'Pendientes', (t) => !t.terminada],
  ['vencidas', 'Vencidas', (t) => !t.terminada && dias(t) !== null && dias(t) < 0],
  ['hoy', 'Hoy', (t) => !t.terminada && dias(t) === 0],
  ['semana', 'Esta semana', (t) => !t.terminada && dias(t) !== null && dias(t) >= 0 && dias(t) <= 7],
  ['terminadas', 'Completadas', (t) => t.terminada],
];

const PRIORIDAD = { alta: 'Alta', media: 'Media', baja: 'Baja' };

export default function MisTareas() {
  const [tareas, setTareas] = useState(null);
  const [pestana, setPestana] = useState('pendientes');
  const [agrupar, setAgrupar] = useVistaGuardada('misTareas.agrupar', ['fecha', 'proyecto'], 'fecha');
  const [marcando, setMarcando] = useState(new Set());

  const cargar = useCallback(async () => {
    try {
      setTareas(await listarMisTareas());
    } catch {
      setTareas([]);
      toast.error('No se pudieron cargar tus tareas.');
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const marcar = async (tarea, terminada) => {
    setMarcando((prev) => new Set(prev).add(tarea.id));
    // Se ve marcada al instante; si falla, vuelve como estaba
    setTareas((prev) => prev.map((t) => (t.id === tarea.id ? { ...t, terminada } : t)));
    try {
      await marcarTareaTerminada(tarea.id, terminada);
      await cargar();
      window.dispatchEvent(new Event(EVENTO_MIS_TAREAS));
      if (terminada) {
        toast((t) => (
          <span className={styles.aviso}>
            «{tarea.titulo}» completada
            <button onClick={() => { toast.dismiss(t.id); marcar(tarea, false); }}>Deshacer</button>
          </span>
        ), { duration: 5000, icon: <Check size={16} /> });
      }
    } catch (err) {
      setTareas((prev) => prev.map((t) => (t.id === tarea.id ? { ...t, terminada: !terminada } : t)));
      toast.error(err.response?.data?.detail || 'No se pudo actualizar la tarea.');
    } finally {
      setMarcando((prev) => {
        const nuevo = new Set(prev);
        nuevo.delete(tarea.id);
        return nuevo;
      });
    }
  };

  const filtro = PESTANAS.find(([id]) => id === pestana)[2];
  const visibles = useMemo(() => (tareas || []).filter(filtro), [tareas, filtro]);
  const grupos = useMemo(() => {
    if (agrupar !== 'proyecto') return [{ id: 'todas', titulo: null, tareas: visibles }];
    const porProyecto = new Map();
    for (const t of visibles) {
      if (!porProyecto.has(t.proyecto_id)) porProyecto.set(t.proyecto_id, { id: t.proyecto_id, titulo: t.proyecto_nombre, tareas: [] });
      porProyecto.get(t.proyecto_id).tareas.push(t);
    }
    return [...porProyecto.values()].sort((a, b) => a.titulo.localeCompare(b.titulo, 'es'));
  }, [visibles, agrupar]);

  const pendientes = (tareas || []).filter((t) => !t.terminada);
  const vencidas = pendientes.filter((t) => dias(t) !== null && dias(t) < 0).length;
  const paraHoy = pendientes.filter((t) => dias(t) === 0).length;

  return (
    <PageContainer>
      <header className={listado.header}>
        <div>
          <h1 className={listado.title}>Mis tareas</h1>
          <p className={styles.resumen}>
            {tareas === null ? 'Cargando…'
              : pendientes.length === 0 ? 'No tienes tareas pendientes.'
                : `${pendientes.length} pendiente${pendientes.length === 1 ? '' : 's'} en todos tus proyectos`
                  + `${paraHoy ? ` · ${paraHoy} para hoy` : ''}${vencidas ? ` · ${vencidas} vencida${vencidas === 1 ? '' : 's'}` : ''}`}
          </p>
        </div>
      </header>

      <div className={listado.herramientas}>
        <div className={listado.pestanas} role="group" aria-label="Filtrar tareas">
          {PESTANAS.map(([id, texto, cumple]) => {
            const n = (tareas || []).filter(cumple).length;
            if (id === 'vencidas' && !n) return null;
            return (
              <button key={id} type="button" aria-pressed={pestana === id} onClick={() => setPestana(id)}>
                {texto} <span>{n}</span>
              </button>
            );
          })}
        </div>
        <div className={listado.espacio} />
        <div className={listado.vista} role="group" aria-label="Agrupar">
          <button type="button" aria-pressed={agrupar === 'fecha'} onClick={() => setAgrupar('fecha')}>Por fecha</button>
          <button type="button" aria-pressed={agrupar === 'proyecto'} onClick={() => setAgrupar('proyecto')}>Por proyecto</button>
        </div>
      </div>

      {tareas !== null && visibles.length === 0 ? (
        <div className={listado.vacio}>
          <b>{pestana === 'terminadas' ? 'Aún no has completado tareas' : 'Nada por aquí'}</b>
          <span>
            {pestana === 'pendientes'
              ? 'Cuando alguien te asigne una tarea en un proyecto, aparecerá aquí.'
              : 'Prueba con otra pestaña.'}
          </span>
        </div>
      ) : (
        grupos.map((g) => (
          <section key={g.id} className={styles.grupo}>
            {g.titulo && (
              <h2 className={styles.grupoTitulo}>
                <FolderKanban size={15} />
                <Link to={`/proyectos/${g.id}/tareas`}>{g.titulo}</Link>
                <span>{g.tareas.length}</span>
              </h2>
            )}
            <ul className={styles.lista}>
              {g.tareas.map((t) => {
                const venc = vencimientoTarea(t.fecha_vencimiento, t.terminada);
                return (
                  <li key={t.id} className={`${styles.fila} ${t.terminada ? styles.hecha : ''}`}>
                    <button
                      className={`${styles.check} ${t.terminada ? styles.checkHecho : ''}`}
                      onClick={() => marcar(t, !t.terminada)}
                      disabled={marcando.has(t.id)}
                      aria-pressed={t.terminada}
                      aria-label={t.terminada ? `Marcar «${t.titulo}» como pendiente` : `Completar «${t.titulo}»`}
                    >
                      {t.terminada && <Check size={13} strokeWidth={3} />}
                    </button>
                    <Link className={styles.info} to={`/proyectos/${t.proyecto_id}/tareas?tarea=${t.id}`}>
                      <span className={styles.titulo}>{t.titulo}</span>
                      <small>
                        {agrupar !== 'proyecto' && <>{t.proyecto_nombre} · </>}
                        <span className={styles.columna}>
                          <i style={{ background: t.columna_color }} />{t.columna_nombre}
                        </span>
                      </small>
                    </Link>
                    {t.prioridad === 'alta' && !t.terminada && (
                      <span className={`${styles.pill} ${styles.alta}`}>{PRIORIDAD.alta}</span>
                    )}
                    {venc && (
                      <span className={`${styles.pill} ${styles[`venc_${venc.tipo}`] || ''}`}>{venc.texto}</span>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      )}
    </PageContainer>
  );
}
