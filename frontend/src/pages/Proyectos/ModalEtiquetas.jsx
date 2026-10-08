import { useMemo, useState } from 'react';
import { Check, Plus, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { asignarEtiquetas, crearEtiqueta } from '../../api/etiquetas';
import { COLORES_CARPETA } from './coloresCarpeta';
import shared from '../../styles/shared.module.css';
import styles from './Etiquetas.module.css';

/** Elegir las etiquetas de un archivo; escribir un nombre nuevo permite crearla ahi mismo */
export default function ModalEtiquetas({ documento, proyectoId, etiquetas, onClose, onGuardado, onEtiquetaCreada }) {
  const [elegidas, setElegidas] = useState(new Set(documento.etiquetas || []));
  const [texto, setTexto] = useState('');
  const [color, setColor] = useState(COLORES_CARPETA[(etiquetas.length + 5) % COLORES_CARPETA.length].valor);
  const [guardando, setGuardando] = useState(false);

  const buscado = texto.trim().replace(/\s+/g, ' ');
  const visibles = useMemo(
    () => etiquetas.filter((e) => e.nombre.toLowerCase().includes(buscado.toLowerCase())),
    [etiquetas, buscado],
  );
  const igual = etiquetas.find((e) => e.nombre.toLowerCase() === buscado.toLowerCase());
  const existe = !!igual;

  const alternar = (id) => setElegidas((prev) => {
    const nuevo = new Set(prev);
    if (nuevo.has(id)) nuevo.delete(id);
    else nuevo.add(id);
    return nuevo;
  });

  const crear = async () => {
    if (!buscado || existe) return;
    try {
      const nueva = await crearEtiqueta({ proyecto_id: proyectoId, nombre: buscado, color });
      onEtiquetaCreada(nueva);
      setElegidas((prev) => new Set(prev).add(nueva.id));
      setTexto('');
      setColor(COLORES_CARPETA[(etiquetas.length + 6) % COLORES_CARPETA.length].valor);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'No se pudo crear la etiqueta.');
    }
  };

  // Lo escrito en el buscador tambien cuenta: si no existe se crea, y en ambos casos se asigna
  const guardar = async () => {
    setGuardando(true);
    try {
      const ids = new Set(elegidas);
      if (buscado && igual) ids.add(igual.id);
      if (buscado && !igual) {
        const nueva = await crearEtiqueta({ proyecto_id: proyectoId, nombre: buscado, color });
        onEtiquetaCreada(nueva);
        ids.add(nueva.id);
      }
      await asignarEtiquetas(documento.id, [...ids]);
      toast.success(ids.size ? `Etiquetas guardadas (${ids.size})` : 'Se quitaron las etiquetas');
      onGuardado();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'No se pudieron guardar las etiquetas.');
      setGuardando(false);
    }
  };

  return (
    <div className={shared.overlay} onClick={onClose}>
      <div className={styles.modal} role="dialog" aria-labelledby="titulo-etiquetas" onClick={(e) => e.stopPropagation()}>
        <header className={styles.cabecera}>
          <h3 id="titulo-etiquetas">Etiquetas de «{documento.nombre}»</h3>
          <button className={styles.cerrar} onClick={onClose} aria-label="Cerrar"><X size={16} /></button>
        </header>

        <input
          className={styles.buscar}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              if (buscado && !existe) crear();
              else if (visibles.length === 1) alternar(visibles[0].id);
            }
          }}
          placeholder="Buscar o crear etiqueta…"
          aria-label="Buscar o crear etiqueta"
          maxLength={40}
          autoFocus
        />

        <ul className={styles.opciones}>
          {visibles.map((e) => (
            <li key={e.id}>
              <button
                className={`${styles.opcion} ${elegidas.has(e.id) ? styles.opcionElegida : ''}`}
                onClick={() => alternar(e.id)}
                role="checkbox"
                aria-checked={elegidas.has(e.id)}
              >
                <span className={styles.casilla}>{elegidas.has(e.id) && <Check size={12} strokeWidth={3} />}</span>
                <span className={styles.punto} style={{ background: e.color }} />
                <span className={styles.nombre}>{e.nombre}</span>
                <small>{e.documentos}</small>
              </button>
            </li>
          ))}
          {etiquetas.length === 0 && !buscado && (
            <li className={styles.vacio}>Este proyecto aún no tiene etiquetas. Escribe un nombre para crear la primera, por ejemplo «Acta» o «Aprobado».</li>
          )}
        </ul>

        {buscado && !existe && (
          <div className={styles.nueva}>
            <div className={styles.paleta} role="radiogroup" aria-label="Color de la etiqueta">
              {COLORES_CARPETA.map((c) => (
                <button
                  key={c.valor}
                  type="button"
                  role="radio"
                  aria-checked={color === c.valor}
                  aria-label={c.nombre}
                  title={c.nombre}
                  className={color === c.valor ? styles.colorElegido : ''}
                  style={{ background: c.valor }}
                  onClick={() => setColor(c.valor)}
                />
              ))}
            </div>
            <button className={styles.crear} onClick={crear}>
              <Plus size={14} /> Crear «{buscado}»
            </button>
            <small className={styles.ayuda}>Elige el color. Al guardar se crea y se asigna a este archivo.</small>
          </div>
        )}
        {buscado && igual && !elegidas.has(igual.id) && (
          <small className={styles.ayuda}>Al guardar se agregará «{igual.nombre}» a este archivo.</small>
        )}

        <footer className={styles.pie}>
          <button className={shared.btnSecondary} onClick={onClose}>Cancelar</button>
          <button className={shared.btnPrimary} onClick={guardar} disabled={guardando}>
            {guardando ? 'Guardando…' : buscado && !igual ? `Crear «${buscado}» y guardar` : 'Guardar'}
          </button>
        </footer>
      </div>
    </div>
  );
}
