import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  ListChecks, CalendarClock, TriangleAlert, Sun, Check, Flag, FileText, Activity, FolderKanban, Users, ArrowRight,
} from 'lucide-react';
import { listarMisTareas, marcarTareaTerminada, EVENTO_MIS_TAREAS } from '../../api/tareas';
import { listarEventos } from '../../api/calendario';
import { obtenerActividad } from '../../api/historial';
import PageContainer from '../../components/PageContainer';
import Avatar from '../../components/Avatar';
import { diasHasta, vencimientoTarea, fechaRelativa, fechaCompleta, fechaCorta, plural } from '../Proyectos/formato';
import { useAuth } from '../../hooks/useAuth';
import styles from './Inicio.module.css';

const DIA_MS = 86400000;
const formatoHoy = new Intl.DateTimeFormat('es-CO', { weekday: 'long', day: 'numeric', month: 'long' });
const dos = (n) => String(n).padStart(2, '0');
const clave = (d) => `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;

function saludo() {
  const h = new Date().getHours();
  if (h < 12) return 'Buenos días';
  if (h < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

const dias = (t) => (t.fecha_vencimiento ? diasHasta(t.fecha_vencimiento) : null);

function Panel({ titulo, Icono, ver, children }) {
  return (
    <section className={styles.panel}>
      <header className={styles.panelCabecera}>
        <h2><Icono size={16} />{titulo}</h2>
        {ver && <Link to={ver} className={styles.verTodo}>Ver todo <ArrowRight size={14} /></Link>}
      </header>
      {children}
    </section>
  );
}

/** Pantalla de inicio personal: cada panel aparece solo si el rol tiene su seccion */
export default function Inicio() {
  const { user, tieneSeccion } = useAuth();
  const conTareas = tieneSeccion('mis_tareas');
  const conCalendario = tieneSeccion('calendario');
  const conActividad = tieneSeccion('actividad');
  const conDocumentos = conActividad && tieneSeccion('documentos');

  const [tareas, setTareas] = useState(null);
  const [entregas, setEntregas] = useState(null);
  const [actividad, setActividad] = useState(null);
  const [archivos, setArchivos] = useState(null);

  const cargarTareas = useCallback(() => {
    if (!conTareas) return;
    listarMisTareas().then(setTareas).catch(() => setTareas([]));
  }, [conTareas]);

  useEffect(() => {
    cargarTareas();
    if (conCalendario) {
      const hoy = new Date();
      listarEventos(clave(hoy), clave(new Date(hoy.getTime() + 60 * DIA_MS)), true)
        .then((e) => setEntregas(e.filter((x) => x.tipo === 'entrega' && x.estado !== 'completado')))
        .catch(() => setEntregas([]));
    }
    if (conActividad) obtenerActividad({ limite: 6 }).then(setActividad).catch(() => setActividad([]));
    if (conDocumentos) {
      // Ultimos archivos con cambios, sin repetir el mismo archivo ni mostrar lo borrado
      obtenerActividad({ tipo: 'documento', limite: 30 })
        .then((lista) => {
          const vistos = new Set();
          setArchivos(lista.filter((e) => {
            if (['eliminado', 'papelera'].includes(e.accion) || vistos.has(e.entidad_id)) return false;
            vistos.add(e.entidad_id);
            return true;
          }).slice(0, 5));
        })
        .catch(() => setArchivos([]));
    }
  }, [cargarTareas, conCalendario, conActividad, conDocumentos]);

  const completar = async (tarea) => {
    setTareas((prev) => prev.map((t) => (t.id === tarea.id ? { ...t, terminada: true } : t)));
    try {
      await marcarTareaTerminada(tarea.id, true);
      window.dispatchEvent(new Event(EVENTO_MIS_TAREAS));
      toast.success(`«${tarea.titulo}» completada`);
      cargarTareas();
    } catch (err) {
      setTareas((prev) => prev.map((t) => (t.id === tarea.id ? { ...t, terminada: false } : t)));
      toast.error(err.response?.data?.detail || 'No se pudo completar la tarea.');
    }
  };

  const pendientes = (tareas || []).filter((t) => !t.terminada);
  const vencidas = pendientes.filter((t) => dias(t) !== null && dias(t) < 0);
  const paraHoy = pendientes.filter((t) => dias(t) === 0);
  // Para hoy: lo vencido y lo de hoy primero, luego lo que sigue
  const foco = [...pendientes].sort((a, b) => (dias(a) ?? 9999) - (dias(b) ?? 9999)).slice(0, 5);
  const entregasSemana = (entregas || []).filter((e) => diasHasta(e.fecha) <= 7).length;

  const resumen = [];
  if (conTareas && tareas) {
    if (paraHoy.length) resumen.push(`tienes ${plural(paraHoy.length, 'tarea', 'tareas')} para hoy`);
    if (vencidas.length) resumen.push(plural(vencidas.length, 'vencida', 'vencidas'));
    if (!paraHoy.length && !vencidas.length) resumen.push(pendientes.length ? 'nada vence hoy' : 'no tienes tareas pendientes');
  }
  if (conCalendario && entregasSemana) resumen.push(`${plural(entregasSemana, 'entrega', 'entregas')} esta semana`);

  const indicadores = [
    conTareas && { Icono: ListChecks, valor: pendientes.length, texto: 'Tareas pendientes', tono: 'info', a: '/mis-tareas' },
    conTareas && { Icono: Sun, valor: paraHoy.length, texto: 'Para hoy', tono: 'acento', a: '/mis-tareas' },
    conTareas && { Icono: TriangleAlert, valor: vencidas.length, texto: 'Vencidas', tono: vencidas.length ? 'peligro' : 'neutro', a: '/mis-tareas' },
    conCalendario && { Icono: CalendarClock, valor: entregasSemana, texto: 'Entregas en 7 días', tono: 'exito', a: '/calendario' },
  ].filter(Boolean);
  const cargando = (conTareas && tareas === null) || (conCalendario && entregas === null);
  const sinPaneles = !conTareas && !conCalendario && !conActividad;

  return (
    <PageContainer wide>
      <header className={styles.saludo}>
        <p className={styles.fecha}>{formatoHoy.format(new Date())}</p>
        <h1>{saludo()}, {user?.nombre?.split(' ')[0] || 'bienvenido'}</h1>
        {resumen.length > 0 && <p className={styles.resumen}>Hoy {resumen.join(' · ')}.</p>}
      </header>

      {indicadores.length > 0 && (
        <div className={styles.indicadores}>
          {indicadores.map(({ Icono, valor, texto, tono, a }) => (
            <Link key={texto} to={a} className={styles.indicador}>
              <span className={`${styles.indicadorIcono} ${styles[tono]}`}><Icono size={19} /></span>
              <span>
                <b>{cargando ? '–' : valor}</b>
                <small>{texto}</small>
              </span>
            </Link>
          ))}
        </div>
      )}

      {sinPaneles ? (
        <div className={styles.columnas}>
          <Panel titulo="Accesos rápidos" Icono={ArrowRight}>
            <ul className={styles.accesos}>
              {tieneSeccion('proyectos') && <li><Link to="/proyectos"><FolderKanban size={18} />Proyectos</Link></li>}
              {tieneSeccion('clientes') && <li><Link to="/proyectos?ver=clientes"><Users size={18} />Clientes</Link></li>}
            </ul>
          </Panel>
        </div>
      ) : (
        <div className={styles.columnas}>
          <div className={styles.principal}>
            {conTareas && (
              <Panel titulo="Para hoy" Icono={ListChecks} ver="/mis-tareas">
                {tareas === null ? <p className={styles.vacio}>Cargando…</p>
                  : foco.length === 0 ? <p className={styles.vacio}>No tienes tareas pendientes. ¡Buen trabajo!</p> : (
                    <ul className={styles.filas}>
                      {foco.map((t) => {
                        const venc = vencimientoTarea(t.fecha_vencimiento, t.terminada);
                        return (
                          <li key={t.id} className={styles.fila}>
                            <button
                              className={`${styles.check} ${t.terminada ? styles.checkHecho : ''}`}
                              onClick={() => completar(t)}
                              disabled={t.terminada}
                              aria-label={`Completar «${t.titulo}»`}
                            >
                              {t.terminada && <Check size={12} strokeWidth={3} />}
                            </button>
                            <Link to={`/proyectos/${t.proyecto_id}/tareas?tarea=${t.id}`} className={styles.filaTexto}>
                              <b>{t.titulo}</b>
                              <small>{t.proyecto_nombre}</small>
                            </Link>
                            {venc && <span className={`${styles.pill} ${styles[`venc_${venc.tipo}`] || ''}`}>{venc.texto}</span>}
                          </li>
                        );
                      })}
                    </ul>
                  )}
              </Panel>
            )}

            {conDocumentos && (
              <Panel titulo="Archivos con cambios recientes" Icono={FileText} ver="/actividad">
                {archivos === null ? <p className={styles.vacio}>Cargando…</p>
                  : archivos.length === 0 ? <p className={styles.vacio}>Aún no hay archivos.</p> : (
                    <ul className={styles.filas}>
                      {archivos.map((e) => (
                        <li key={e.id} className={styles.fila}>
                          <span className={styles.iconoArchivo}><FileText size={16} /></span>
                          <Link to={`/proyectos/${e.proyecto_id}/documentos?doc=${e.entidad_id}`} className={styles.filaTexto}>
                            <b>{e.texto.match(/"(.+)"/)?.[1] || e.texto}</b>
                            <small>{e.proyecto_nombre}{e.usuario_nombre && ` · ${e.usuario_nombre}`}</small>
                          </Link>
                          <time className={styles.cuando} dateTime={e.created_at} title={fechaCompleta(e.created_at)}>
                            {fechaRelativa(e.created_at)}
                          </time>
                        </li>
                      ))}
                    </ul>
                  )}
              </Panel>
            )}
          </div>

          <div className={styles.lateral}>
            {conCalendario && (
              <Panel titulo="Próximas entregas" Icono={Flag} ver="/calendario">
                {entregas === null ? <p className={styles.vacio}>Cargando…</p>
                  : entregas.length === 0 ? <p className={styles.vacio}>Sin entregas en los próximos 60 días.</p> : (
                    <ul className={styles.filas}>
                      {entregas.slice(0, 5).map((e) => {
                        const d = diasHasta(e.fecha);
                        return (
                          <li key={e.id} className={styles.fila}>
                            <span className={`${styles.pill} ${d <= 7 ? styles.venc_hoy : ''}`}>{fechaCorta(e.fecha)}</span>
                            <Link to={`/proyectos/${e.proyecto_id}`} className={styles.filaTexto}>
                              <b>{e.titulo}</b>
                              <small>{d === 0 ? 'Hoy' : d === 1 ? 'Mañana' : `En ${d} días`}</small>
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  )}
              </Panel>
            )}

            {conActividad && (
              <Panel titulo="Actividad del equipo" Icono={Activity} ver="/actividad">
                {actividad === null ? <p className={styles.vacio}>Cargando…</p>
                  : actividad.length === 0 ? <p className={styles.vacio}>Sin actividad todavía.</p> : (
                    <ul className={styles.filas}>
                      {actividad.map((e) => (
                        <li key={e.id} className={styles.fila}>
                          <Avatar usuario={{ nombre: e.usuario_nombre || '?', avatar_url: e.usuario_avatar_url }} size={28} />
                          <span className={styles.filaTexto}>
                            <span className={styles.actividadTexto}>
                              <b>{e.usuario_id === user?.id ? 'Tú' : e.usuario_nombre || 'Alguien de afuera'}</b> · {e.texto}
                            </span>
                            <small title={fechaCompleta(e.created_at)}>{fechaRelativa(e.created_at)}</small>
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
              </Panel>
            )}
          </div>
        </div>
      )}
    </PageContainer>
  );
}
