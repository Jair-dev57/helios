import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Inbox, CheckCheck, TriangleAlert, CalendarClock } from 'lucide-react';
import { obtenerNotificaciones, marcarLeida, marcarTodasLeidas } from '../api/notificaciones';
import { listarMisTareas } from '../api/tareas';
import { listarProyectos } from '../api/proyectos';
import { useAuth } from '../hooks/useAuth';
import { fechaRelativa, fechaCompleta, diasHasta, entregaProyecto } from '../pages/Proyectos/formato';
import Avatar from './Avatar';
import styles from './Notificaciones.module.css';

// Cada cuanto se buscan avisos nuevos (tambien al volver a la pestana)
const INTERVALO = 60_000;

/**
 * Alertas que no se leen: siguen mientras haya algo por resolver. Tareas tuyas vencidas (por proyecto)
 * y entregas de los proyectos de los que eres responsable, vencidas o en los proximos 7 dias.
 */
async function calcularAlertas(usuarioId, verTareas, verProyectos) {
  const [tareas, proyectos] = await Promise.all([
    verTareas ? listarMisTareas() : [],
    verProyectos ? listarProyectos() : [],
  ]);
  const vencidasPorProyecto = new Map();
  tareas
    .filter((t) => !t.terminada && t.fecha_vencimiento && diasHasta(t.fecha_vencimiento) < 0)
    .forEach((t) => vencidasPorProyecto.set(t.proyecto_nombre, (vencidasPorProyecto.get(t.proyecto_nombre) || 0) + 1));
  const deTareas = [...vencidasPorProyecto].map(([proyecto, n]) => ({
    clave: `t:${proyecto}`,
    tipo: 'tarea',
    texto: `${n === 1 ? 'Tienes 1 tarea vencida' : `Tienes ${n} tareas vencidas`} en ${proyecto}`,
    ruta: '/mis-tareas',
  }));
  const deEntregas = proyectos
    .filter((p) => (!p.tipo || p.tipo === 'proyecto') && p.usuario_id === usuarioId && !['completado', 'cancelado'].includes(p.estado))
    .map((p) => ({ p, entrega: entregaProyecto(p) }))
    .filter(({ entrega }) => entrega.tipo === 'vencida' || entrega.tipo === 'pronto')
    .sort((a, b) => a.p.fecha_vencimiento.localeCompare(b.p.fecha_vencimiento))
    .map(({ p, entrega }) => ({
      clave: `p:${p.id}`,
      tipo: entrega.tipo === 'vencida' ? 'vencida' : 'pronto',
      texto: `${p.nombre}: ${entrega.tipo === 'vencida' ? entrega.texto.replace('Vencido', 'entrega vencida') : entrega.texto.toLowerCase()}`,
      ruta: `/proyectos/${p.id}`,
    }));
  return [...deEntregas.filter((a) => a.tipo === 'vencida'), ...deTareas, ...deEntregas.filter((a) => a.tipo === 'pronto')];
}

/** Campana de la barra superior: alertas de entregas y tareas, menciones, comentarios en tus archivos y archivos recibidos */
export default function Notificaciones() {
  const { user, tieneSeccion } = useAuth();
  const [datos, setDatos] = useState({ no_leidas: 0, notificaciones: [] });
  const [alertas, setAlertas] = useState([]);
  const [abierto, setAbierto] = useState(false);
  const contenedor = useRef(null);
  const navigate = useNavigate();

  const cargar = useCallback(async () => {
    try {
      setDatos(await obtenerNotificaciones());
    } catch {
      // Sin conexion o sesion vencida: se reintenta en el siguiente ciclo
    }
  }, []);

  // Las alertas cambian poco: al entrar, al volver a la pestana y al abrir la campana
  const usuarioId = user?.id;
  const verTareas = tieneSeccion('mis_tareas');
  const verProyectos = tieneSeccion('proyectos');
  const cargarAlertas = useCallback(async () => {
    try {
      setAlertas(await calcularAlertas(usuarioId, verTareas, verProyectos));
    } catch {
      // Si falla, se queda con las ultimas
    }
  }, [usuarioId, verTareas, verProyectos]);

  useEffect(() => {
    cargarAlertas();
    window.addEventListener('focus', cargarAlertas);
    return () => window.removeEventListener('focus', cargarAlertas);
  }, [cargarAlertas]);

  useEffect(() => {
    cargar();
    const intervalo = setInterval(cargar, INTERVALO);
    window.addEventListener('focus', cargar);
    return () => {
      clearInterval(intervalo);
      window.removeEventListener('focus', cargar);
    };
  }, [cargar]);

  useEffect(() => {
    if (!abierto) return undefined;
    const fuera = (e) => !contenedor.current?.contains(e.target) && setAbierto(false);
    const escape = (e) => e.key === 'Escape' && setAbierto(false);
    document.addEventListener('mousedown', fuera);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('mousedown', fuera);
      document.removeEventListener('keydown', escape);
    };
  }, [abierto]);

  const alternar = () => {
    if (!abierto) {
      cargar();
      cargarAlertas();
    }
    setAbierto((v) => !v);
  };

  const leidaLocal = (id) => setDatos((d) => ({
    no_leidas: Math.max(0, d.no_leidas - (d.notificaciones.some((n) => n.id === id && !n.leida) ? 1 : 0)),
    notificaciones: d.notificaciones.map((n) => (n.id === id ? { ...n, leida: true } : n)),
  }));

  const ir = (n) => {
    if (!n.leida) {
      leidaLocal(n.id);
      marcarLeida(n.id).catch(() => {});
    }
    setAbierto(false);
    if (n.proyecto_id && n.documento_id) {
      const ver = n.tipo === 'recibido' ? '' : '&ver=comentarios';
      navigate(`/proyectos/${n.proyecto_id}/documentos?doc=${n.documento_id}${ver}`);
    }
  };

  const leerTodas = async () => {
    setDatos((d) => ({ no_leidas: 0, notificaciones: d.notificaciones.map((n) => ({ ...n, leida: true })) }));
    try {
      await marcarTodasLeidas();
    } catch {
      cargar();
    }
  };

  const { no_leidas: noLeidas, notificaciones } = datos;
  const pendientes = noLeidas + alertas.length;

  const irAlerta = (a) => {
    setAbierto(false);
    navigate(a.ruta);
  };

  return (
    <div className={styles.contenedor} ref={contenedor}>
      <button
        className={`${styles.campana} ${abierto ? styles.campanaAbierta : ''}`}
        onClick={alternar}
        aria-label={pendientes ? `Notificaciones, ${pendientes} pendientes` : 'Notificaciones'}
        aria-expanded={abierto}
        title="Notificaciones"
      >
        <Bell size={18} />
        {pendientes > 0 && <span className={styles.contador}>{pendientes > 9 ? '9+' : pendientes}</span>}
      </button>

      {abierto && (
        <div className={styles.panel} role="dialog" aria-label="Notificaciones">
          <header className={styles.cabecera}>
            <strong>Notificaciones</strong>
            {noLeidas > 0 && (
              <button className={styles.leerTodas} onClick={leerTodas}>
                <CheckCheck size={14} /> Marcar todas como leídas
              </button>
            )}
          </header>
          {alertas.length > 0 && (
            <section className={styles.alertas} aria-label="Alertas">
              <h3 className={styles.seccion}>Alertas</h3>
              <ul className={styles.lista}>
                {alertas.map((a) => (
                  <li key={a.clave}>
                    <button className={styles.item} onClick={() => irAlerta(a)}>
                      <span className={`${styles.iconoAlerta} ${a.tipo === 'pronto' ? styles.alertaPronto : ''}`}>
                        {a.tipo === 'pronto' ? <CalendarClock size={16} /> : <TriangleAlert size={16} />}
                      </span>
                      <span className={styles.itemTexto}><span>{a.texto}</span></span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {alertas.length > 0 && notificaciones.length > 0 && <h3 className={styles.seccion}>Avisos</h3>}
          {notificaciones.length === 0 && alertas.length > 0 ? null : notificaciones.length === 0 ? (
            <div className={styles.vacio}>
              <Bell size={28} strokeWidth={1.5} />
              <p>No tienes notificaciones.</p>
              <small>Aquí verás cuando te mencionen, comenten tus archivos o te envíen algo por un enlace.</small>
            </div>
          ) : (
            <ul className={styles.lista}>
              {notificaciones.map((n) => (
                <li key={n.id}>
                  <button className={`${styles.item} ${n.leida ? '' : styles.noLeida}`} onClick={() => ir(n)}>
                    {n.tipo === 'recibido' ? (
                      <span className={styles.iconoRecibido}><Inbox size={16} /></span>
                    ) : (
                      <Avatar usuario={{ nombre: n.actor || '?', avatar_url: n.actor_avatar_url }} size={32} />
                    )}
                    <span className={styles.itemTexto}>
                      <span>{n.texto}</span>
                      <small title={fechaCompleta(n.created_at)}>{fechaRelativa(n.created_at)}</small>
                    </span>
                    {!n.leida && <span className={styles.punto} aria-label="Sin leer" />}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
