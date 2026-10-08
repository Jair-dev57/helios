import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Inbox, CheckCheck } from 'lucide-react';
import { obtenerNotificaciones, marcarLeida, marcarTodasLeidas } from '../api/notificaciones';
import { fechaRelativa, fechaCompleta } from '../pages/Proyectos/formato';
import Avatar from './Avatar';
import styles from './Notificaciones.module.css';

// Cada cuanto se buscan avisos nuevos (tambien al volver a la pestana)
const INTERVALO = 60_000;

/** Campana de la barra superior: menciones, comentarios en tus archivos y archivos recibidos por enlace */
export default function Notificaciones() {
  const [datos, setDatos] = useState({ no_leidas: 0, notificaciones: [] });
  const [abierto, setAbierto] = useState(false);
  const contenedor = useRef(null);
  const navigate = useNavigate();

  const cargar = useCallback(async () => {
    try {
      setDatos(await obtenerNotificaciones());
    } catch (err) {
      // Sin conexion o sesion vencida: se reintenta en el siguiente ciclo
    }
  }, []);

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
    if (!abierto) cargar();
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
    } catch (err) {
      cargar();
    }
  };

  const { no_leidas: noLeidas, notificaciones } = datos;

  return (
    <div className={styles.contenedor} ref={contenedor}>
      <button
        className={`${styles.campana} ${abierto ? styles.campanaAbierta : ''}`}
        onClick={alternar}
        aria-label={noLeidas ? `Notificaciones, ${noLeidas} sin leer` : 'Notificaciones'}
        aria-expanded={abierto}
        title="Notificaciones"
      >
        <Bell size={18} />
        {noLeidas > 0 && <span className={styles.contador}>{noLeidas > 9 ? '9+' : noLeidas}</span>}
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
          {notificaciones.length === 0 ? (
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
