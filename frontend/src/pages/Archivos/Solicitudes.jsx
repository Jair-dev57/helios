import { useEffect, useMemo, useState } from 'react';
import { Plus, Copy, Settings2, Lock, CalendarClock, Inbox } from 'lucide-react';
import { listarEspacios } from '../../api/espacios';
import { listarProyectos } from '../../api/proyectos';
import { listarCarpetas } from '../../api/carpetas';
import ModalCompartir from '../Proyectos/ModalCompartir';
import ObjetoCompartido from './ObjetoCompartido';
import { copiarEnlace } from './copiarEnlace';
import { fechaRelativa, fechaCompleta, plural } from '../Proyectos/formato';
import { useAuth } from '../../hooks/useAuth';
import listado from '../../styles/listado.module.css';
import shared from '../../styles/shared.module.css';
import styles from './Archivos.module.css';

const formatoDia = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });

/** Paso previo a crear la solicitud: elegir en que proyecto o espacio y en que carpeta se guardan los archivos */
function ElegirCarpeta({ onElegida, onClose }) {
  const { tieneSeccion } = useAuth();
  const conProyectos = tieneSeccion('proyectos');
  const [lugares, setLugares] = useState(null);
  const [lugar, setLugar] = useState('');
  const [carpetas, setCarpetas] = useState(null);
  const [carpeta, setCarpeta] = useState('');

  useEffect(() => {
    Promise.allSettled([listarEspacios(), conProyectos ? listarProyectos() : Promise.resolve([])])
      .then(([espacios, proyectos]) => {
        const e = espacios.status === 'fulfilled' ? espacios.value : { personal: null, equipo: [] };
        const p = proyectos.status === 'fulfilled' ? proyectos.value : [];
        setLugares([
          ...(e.personal ? [{ id: e.personal.id, nombre: 'Mis archivos', grupo: 'Archivos' }] : []),
          ...e.equipo.map((x) => ({ id: x.id, nombre: x.nombre, grupo: 'Áreas' })),
          ...p.map((x) => ({ id: x.id, nombre: x.nombre, grupo: 'Proyectos' })),
        ]);
      });
  }, [conProyectos]);

  useEffect(() => {
    if (!lugar) return;
    setCarpetas(null);
    setCarpeta('');
    listarCarpetas(Number(lugar)).then(setCarpetas).catch(() => setCarpetas([]));
  }, [lugar]);

  // Cada carpeta con su ruta completa ("Talento humano / 2026 / Hojas de vida"), en orden alfabetico
  const opciones = useMemo(() => {
    if (!carpetas) return [];
    const porId = new Map(carpetas.map((c) => [c.id, c]));
    const ruta = (c) => (c.carpeta_padre_id && porId.has(c.carpeta_padre_id) ? `${ruta(porId.get(c.carpeta_padre_id))} / ${c.nombre}` : c.nombre);
    return carpetas.map((c) => ({ id: c.id, nombre: c.nombre, ruta: ruta(c) })).sort((a, b) => a.ruta.localeCompare(b.ruta, 'es'));
  }, [carpetas]);

  const grupos = [...new Set((lugares || []).map((l) => l.grupo))];
  const elegida = opciones.find((o) => o.id === Number(carpeta));

  return (
    <div className={shared.overlay} onClick={onClose}>
      <form
        className={`${shared.modal} ${styles.modalEspacio}`}
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => { e.preventDefault(); if (elegida) onElegida({ tipo: 'carpeta', id: elegida.id, nombre: elegida.nombre }); }}
      >
        <h3 className={shared.modalTitle}>Nueva solicitud de archivos</h3>
        <p className={styles.nota}>Quien tenga el enlace podrá enviar archivos a la carpeta que elijas, sin cuenta y sin ver lo que ya hay.</p>
        <div className={shared.field}>
          <label htmlFor="solicitud-lugar">Dónde se guardan</label>
          <select id="solicitud-lugar" value={lugar} onChange={(e) => setLugar(e.target.value)} disabled={!lugares}>
            <option value="">{lugares ? 'Elige un espacio o proyecto' : 'Cargando…'}</option>
            {grupos.map((g) => (
              <optgroup key={g} label={g}>
                {lugares.filter((l) => l.grupo === g).map((l) => <option key={l.id} value={l.id}>{l.nombre}</option>)}
              </optgroup>
            ))}
          </select>
        </div>
        {lugar && (
          <div className={shared.field}>
            <label htmlFor="solicitud-carpeta">Carpeta</label>
            <select id="solicitud-carpeta" value={carpeta} onChange={(e) => setCarpeta(e.target.value)} disabled={!carpetas}>
              <option value="">{carpetas === null ? 'Cargando…' : opciones.length ? 'Elige una carpeta' : 'Este lugar no tiene carpetas'}</option>
              {opciones.map((o) => <option key={o.id} value={o.id}>{o.ruta}</option>)}
            </select>
          </div>
        )}
        <div className={shared.modalActions}>
          <button type="button" className={shared.btnSecondary} onClick={onClose}>Cancelar</button>
          <button type="submit" className={shared.btnPrimary} disabled={!elegida}>Continuar</button>
        </div>
      </form>
    </div>
  );
}

/**
 * Pestaña Solicitudes de Compartidos: enlaces para que personas de afuera envíen archivos, de todos los
 * proyectos y espacios. enlaces: los de permiso «subir» (null mientras carga); onCambio recarga Compartidos.
 */
export default function Solicitudes({ enlaces, onCambio }) {
  const [eligiendo, setEligiendo] = useState(false);
  const [configurando, setConfigurando] = useState(null);

  const abiertas = (enlaces || []).filter((e) => e.vigente);
  const cerradas = (enlaces || []).filter((e) => !e.vigente);

  const tarjeta = (e) => (
    <li key={e.id} className={`${styles.solicitud} ${e.vigente ? '' : styles.vencido}`}>
      <div className={styles.solicitudCabecera}>
        <span className={styles.solicitudIcono}><Inbox size={18} /></span>
        <ObjetoCompartido objeto={e.objeto} />
        {e.recibidos_semana > 0 && e.vigente && <span className={`${styles.pastilla} ${styles.pastillaAviso}`}>{e.recibidos_semana} esta semana</span>}
      </div>
      <div className={styles.solicitudDatos}>
        <span><b>{e.recibidos}</b> {e.recibidos === 1 ? 'archivo recibido' : 'archivos recibidos'}</span>
        <span title={e.expira_at ? fechaCompleta(e.expira_at) : undefined}>
          <CalendarClock size={13} /> {e.expira_at ? `${e.vigente ? 'Cierra' : 'Cerró'} el ${formatoDia.format(new Date(e.expira_at))}` : 'Sin fecha de cierre'}
        </span>
        {e.tiene_contrasena && <span><Lock size={13} /> Con contraseña</span>}
        <span>Creada {fechaRelativa(e.created_at)}{!e.creado_por_mi && e.creado_por && ` por ${e.creado_por}`}</span>
      </div>
      <div className={styles.solicitudAcciones}>
        {e.vigente && (
          <button className={styles.botonFila} onClick={() => copiarEnlace(e.token)}><Copy size={14} /> <span>Copiar enlace</span></button>
        )}
        <button
          className={styles.botonFila}
          onClick={() => setConfigurando({ objetivo: { tipo: 'carpeta', id: e.objeto.id, nombre: e.objeto.nombre } })}
        >
          <Settings2 size={14} /> <span>Gestionar</span>
        </button>
      </div>
    </li>
  );

  return (
    <>
      <div className={styles.introSolicitudes}>
        <p className={styles.subtitulo}>Enlaces para que personas de afuera te envíen archivos (hojas de vida, entregas, soportes) sin cuenta.</p>
        {enlaces?.length > 0 && (
          <button className={shared.btnPrimary} onClick={() => setEligiendo(true)}><Plus size={16} /> Nueva solicitud</button>
        )}
      </div>

      {enlaces === null ? (
        <p className={shared.loadingText}>Cargando…</p>
      ) : enlaces.length === 0 ? (
        <div className={listado.vacio}>
          <b>Aún no hay solicitudes</b>
          <span>Crea una, comparte el enlace y los archivos llegarán solos a la carpeta que elijas.</span>
          <button className={shared.btnPrimary} onClick={() => setEligiendo(true)}><Plus size={16} /> Crear la primera</button>
        </div>
      ) : (
        <>
          {abiertas.length > 0 && <ul className={styles.solicitudes}>{abiertas.map(tarjeta)}</ul>}
          {cerradas.length > 0 && (
            <>
              <h2 className={styles.tituloSeccion}>{plural(cerradas.length, 'Cerrada', 'Cerradas')}</h2>
              <ul className={styles.solicitudes}>{cerradas.map(tarjeta)}</ul>
            </>
          )}
        </>
      )}

      {eligiendo && (
        <ElegirCarpeta
          onClose={() => setEligiendo(false)}
          onElegida={(objetivo) => { setEligiendo(false); setConfigurando({ objetivo, nueva: true }); }}
        />
      )}
      {configurando && (
        <ModalCompartir
          objetivo={configurando.objetivo}
          permisoInicial={configurando.nueva ? 'subir' : 'ver'}
          onClose={() => { setConfigurando(null); onCambio(); }}
        />
      )}
    </>
  );
}
