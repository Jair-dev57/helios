import { useCallback, useEffect, useState } from 'react';
import { X, Link2, Inbox, Copy, ExternalLink, Trash2, Lock, CalendarClock } from 'lucide-react';
import toast from 'react-hot-toast';
import { listarEnlaces, crearEnlace, revocarEnlace, urlEnlace } from '../../api/enlaces';
import { fechaRelativa, fechaCompleta } from './formato';
import shared from '../../styles/shared.module.css';
import styles from './ModalCompartir.module.css';

const VENCIMIENTOS = [
  { valor: '', nombre: 'Nunca' },
  { valor: '1', nombre: 'En 1 día' },
  { valor: '7', nombre: 'En 7 días' },
  { valor: '30', nombre: 'En 30 días' },
];

const formatoDia = new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short', year: 'numeric' });

async function copiar(texto) {
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch (err) {
    // Sin permiso de portapapeles (p. ej. http fuera de localhost)
    return false;
  }
}

/** Enlaces publicos de un documento o una carpeta. objetivo: { tipo: 'documento' | 'carpeta', id, nombre } */
export default function ModalCompartir({ objetivo, onClose }) {
  const esCarpeta = objetivo.tipo === 'carpeta';
  const filtro = esCarpeta ? { carpeta_id: objetivo.id } : { documento_id: objetivo.id };

  const [enlaces, setEnlaces] = useState(null);
  const [permiso, setPermiso] = useState('ver');
  const [conContrasena, setConContrasena] = useState(false);
  const [contrasena, setContrasena] = useState('');
  const [vence, setVence] = useState('');
  const [creando, setCreando] = useState(false);

  const cargar = useCallback(async () => {
    try {
      setEnlaces(await listarEnlaces(esCarpeta ? { carpeta_id: objetivo.id } : { documento_id: objetivo.id }));
    } catch (err) {
      setEnlaces([]);
      toast.error('No se pudieron cargar los enlaces.');
    }
  }, [esCarpeta, objetivo.id]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const copiarEnlace = async (enlace) => {
    if (await copiar(urlEnlace(enlace.token))) toast.success('Enlace copiado');
    else toast.error('No se pudo copiar: selecciona el enlace y cópialo a mano.');
  };

  const crear = async (e) => {
    e.preventDefault();
    if (conContrasena && !contrasena.trim()) return;
    setCreando(true);
    try {
      const enlace = await crearEnlace({
        ...filtro,
        permiso,
        contrasena: conContrasena ? contrasena : null,
        expira_at: vence ? new Date(Date.now() + Number(vence) * 86_400_000).toISOString() : null,
      });
      setContrasena('');
      setConContrasena(false);
      await cargar();
      toast.success(await copiar(urlEnlace(enlace.token)) ? 'Enlace creado y copiado' : 'Enlace creado');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'No se pudo crear el enlace.');
    } finally {
      setCreando(false);
    }
  };

  const revocar = async (enlace) => {
    if (!confirm('¿Revocar este enlace? Quien lo tenga ya no podrá abrirlo.')) return;
    try {
      await revocarEnlace(enlace.id);
      setEnlaces((prev) => prev.filter((x) => x.id !== enlace.id));
      toast.success('Enlace revocado');
    } catch (err) {
      toast.error('No se pudo revocar el enlace.');
    }
  };

  return (
    <div className={shared.overlay} onClick={onClose}>
      <div className={styles.modal} role="dialog" aria-labelledby="titulo-compartir" onClick={(e) => e.stopPropagation()}>
        <header className={styles.cabecera}>
          <div>
            <h3 id="titulo-compartir" className={styles.titulo}>Compartir «{objetivo.nombre}»</h3>
            <p className={styles.subtitulo}>Cualquiera con el enlace podrá abrirlo, sin necesidad de una cuenta en Helios.</p>
          </div>
          <button className={styles.cerrar} onClick={onClose} aria-label="Cerrar"><X size={16} /></button>
        </header>

        <form className={styles.nuevo} onSubmit={crear}>
          {esCarpeta && (
            <div className={styles.tipos} role="radiogroup" aria-label="Qué permite el enlace">
              <label className={permiso === 'ver' ? styles.tipoActivo : ''}>
                <input type="radio" name="permiso" checked={permiso === 'ver'} onChange={() => setPermiso('ver')} />
                <Link2 size={18} />
                <span><strong>Ver y descargar</strong><small>Recorren la carpeta y bajan archivos o todo en ZIP</small></span>
              </label>
              <label className={permiso === 'subir' ? styles.tipoActivo : ''}>
                <input type="radio" name="permiso" checked={permiso === 'subir'} onChange={() => setPermiso('subir')} />
                <Inbox size={18} />
                <span><strong>Solo recibir archivos</strong><small>Envían archivos sin ver lo que hay dentro</small></span>
              </label>
            </div>
          )}

          <div className={styles.opciones}>
            <label className={styles.casilla}>
              <input type="checkbox" checked={conContrasena} onChange={(e) => setConContrasena(e.target.checked)} />
              Proteger con contraseña
            </label>
            {conContrasena && (
              <input
                className={styles.campo}
                type="text"
                value={contrasena}
                onChange={(e) => setContrasena(e.target.value)}
                placeholder="Contraseña del enlace"
                aria-label="Contraseña del enlace"
                autoFocus
              />
            )}
            <label className={styles.vence}>
              Vence
              <select className={styles.campo} value={vence} onChange={(e) => setVence(e.target.value)}>
                {VENCIMIENTOS.map((v) => <option key={v.valor} value={v.valor}>{v.nombre}</option>)}
              </select>
            </label>
          </div>

          <button className={shared.btnPrimary} type="submit" disabled={creando || (conContrasena && !contrasena.trim())}>
            {creando ? 'Creando…' : 'Crear enlace'}
          </button>
        </form>

        <div className={styles.existentes}>
          <span className={styles.etiqueta}>Enlaces activos</span>
          {enlaces === null && <p className={styles.vacio}>Cargando…</p>}
          {enlaces?.length === 0 && <p className={styles.vacio}>Todavía no hay enlaces. Crea uno arriba.</p>}
          <ul className={styles.lista}>
            {enlaces?.map((e) => {
              const vencido = e.expira_at && new Date(e.expira_at) < new Date();
              return (
                <li key={e.id} className={vencido ? styles.vencido : ''}>
                  <span className={styles.icono}>{e.permiso === 'subir' ? <Inbox size={18} /> : <Link2 size={18} />}</span>
                  <div className={styles.info}>
                    <span className={styles.nombreEnlace}>
                      {e.permiso === 'subir' ? 'Recibir archivos' : 'Ver y descargar'}
                      {e.tiene_contrasena && <span className={styles.chip}><Lock size={11} /> Contraseña</span>}
                      {e.expira_at && (
                        <span className={styles.chip} title={fechaCompleta(e.expira_at)}>
                          <CalendarClock size={11} /> {vencido ? 'Vencido' : `Vence ${formatoDia.format(new Date(e.expira_at))}`}
                        </span>
                      )}
                    </span>
                    <input className={styles.url} value={urlEnlace(e.token)} readOnly onFocus={(ev) => ev.target.select()} aria-label="Dirección del enlace" />
                    <small>
                      {e.accesos ? `${e.accesos} visita${e.accesos === 1 ? '' : 's'}, la última ${fechaRelativa(e.ultimo_acceso_at)}` : 'Sin visitas'}
                      {' · '}Creado {fechaRelativa(e.created_at)}{e.creado_por ? ` por ${e.creado_por}` : ''}
                    </small>
                  </div>
                  <div className={styles.acciones}>
                    <button onClick={() => copiarEnlace(e)} title="Copiar enlace" aria-label="Copiar enlace" disabled={vencido}><Copy size={15} /></button>
                    <a href={urlEnlace(e.token)} target="_blank" rel="noreferrer" title="Abrir" aria-label="Abrir enlace"><ExternalLink size={15} /></a>
                    <button className={styles.peligro} onClick={() => revocar(e)} title="Revocar" aria-label="Revocar enlace"><Trash2 size={15} /></button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}
