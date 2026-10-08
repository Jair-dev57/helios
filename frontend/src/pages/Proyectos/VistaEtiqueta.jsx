import { useState } from 'react';
import { Pencil, Trash2, Tag } from 'lucide-react';
import toast from 'react-hot-toast';
import { actualizarEtiqueta, eliminarEtiqueta } from '../../api/etiquetas';
import IconoArchivo from '../../components/IconoArchivo';
import { COLORES_CARPETA } from './coloresCarpeta';
import { fechaRelativa, fechaCompleta } from './formato';
import styles from './Etiquetas.module.css';

/** Todos los archivos del proyecto con una etiqueta; tambien renombrarla, cambiar su color o eliminarla */
export default function VistaEtiqueta({ etiqueta, documentos, etiquetasPorId, rutaDe, docActivoId, onAbrir, onCambio, onEliminada }) {
  const [renombrando, setRenombrando] = useState(false);
  const [nombre, setNombre] = useState(etiqueta.nombre);

  const guardarNombre = async () => {
    const limpio = nombre.trim();
    setRenombrando(false);
    if (!limpio || limpio === etiqueta.nombre) return setNombre(etiqueta.nombre);
    try {
      await actualizarEtiqueta(etiqueta.id, { nombre: limpio });
      onCambio();
    } catch (err) {
      setNombre(etiqueta.nombre);
      toast.error(err.response?.data?.detail || 'No se pudo renombrar la etiqueta.');
    }
    return undefined;
  };

  const cambiarColor = async (color) => {
    try {
      await actualizarEtiqueta(etiqueta.id, { color });
      onCambio();
    } catch (err) {
      toast.error('No se pudo cambiar el color.');
    }
  };

  const eliminar = async () => {
    const cuantos = documentos.length ? ` Se quitará de ${documentos.length} archivo${documentos.length === 1 ? '' : 's'}; los archivos no se borran.` : '';
    if (!confirm(`¿Eliminar la etiqueta «${etiqueta.nombre}»?${cuantos}`)) return;
    try {
      await eliminarEtiqueta(etiqueta.id);
      toast.success('Etiqueta eliminada');
      onEliminada();
    } catch (err) {
      toast.error('No se pudo eliminar la etiqueta.');
    }
  };

  return (
    <section className={styles.vista} aria-labelledby="titulo-etiqueta">
      <header className={styles.vistaCabecera}>
        <div className={styles.vistaTitulo}>
          <Tag size={18} style={{ color: etiqueta.color }} />
          {renombrando ? (
            <input
              className={styles.renombrar}
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              onBlur={guardarNombre}
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.currentTarget.blur();
                if (e.key === 'Escape') { setNombre(etiqueta.nombre); setRenombrando(false); }
              }}
              maxLength={40}
              aria-label="Nombre de la etiqueta"
              autoFocus
            />
          ) : (
            <h2 id="titulo-etiqueta">{etiqueta.nombre}</h2>
          )}
          <span className={styles.cuenta}>{documentos.length} archivo{documentos.length === 1 ? '' : 's'}</span>
        </div>
        <div className={styles.vistaAcciones}>
          <div className={styles.paleta} role="radiogroup" aria-label="Color de la etiqueta">
            {COLORES_CARPETA.map((c) => (
              <button
                key={c.valor}
                type="button"
                role="radio"
                aria-checked={etiqueta.color === c.valor}
                aria-label={c.nombre}
                title={c.nombre}
                className={etiqueta.color === c.valor ? styles.colorElegido : ''}
                style={{ background: c.valor }}
                onClick={() => cambiarColor(c.valor)}
              />
            ))}
          </div>
          <button className={styles.icono} onClick={() => setRenombrando(true)} title="Renombrar" aria-label="Renombrar etiqueta"><Pencil size={15} /></button>
          <button className={`${styles.icono} ${styles.peligro}`} onClick={eliminar} title="Eliminar etiqueta" aria-label="Eliminar etiqueta"><Trash2 size={15} /></button>
        </div>
      </header>

      {documentos.length === 0 ? (
        <p className={styles.vistaVacia}>Ningún archivo tiene esta etiqueta. Asígnala con clic derecho sobre un archivo → «Etiquetas…».</p>
      ) : (
        <ul className={styles.vistaLista}>
          {documentos.map((d) => (
            <li key={d.id}>
              <button className={`${styles.fila} ${docActivoId === d.id ? styles.filaActiva : ''}`} onClick={() => onAbrir(d)}>
                <IconoArchivo tipo={d.tipo} size={26} />
                <span className={styles.filaInfo}>
                  <span className={styles.filaNombre}>{d.nombre}{d.tipo ? `.${d.tipo}` : ''}</span>
                  <small>{rutaDe(d.carpeta_id).map((c) => c.nombre).join(' / ') || 'Sin carpeta'}</small>
                </span>
                <span className={styles.filaEtiquetas}>
                  {(d.etiquetas || []).filter((id) => id !== etiqueta.id).map((id) => etiquetasPorId.get(id)).filter(Boolean).map((e) => (
                    <span key={e.id} className={styles.chip}><span className={styles.punto} style={{ background: e.color }} />{e.nombre}</span>
                  ))}
                </span>
                <small className={styles.filaFecha} title={fechaCompleta(d.updated_at)}>{fechaRelativa(d.updated_at)}</small>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
