import { useEffect, useRef, useState } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import styles from './MenuOpciones.module.css';

/**
 * Boton «Opciones» de una barra de listado con un panel de filtros, agrupacion y orden (los hijos).
 * Se cierra al hacer clic fuera o con Escape. conFiltros: muestra un punto si algo no esta por defecto.
 */
export default function MenuOpciones({ conFiltros = false, children }) {
  const [abierto, setAbierto] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!abierto) return undefined;
    const cerrarFuera = (e) => { if (!ref.current?.contains(e.target)) setAbierto(false); };
    const cerrarEscape = (e) => { if (e.key === 'Escape') setAbierto(false); };
    document.addEventListener('mousedown', cerrarFuera);
    document.addEventListener('keydown', cerrarEscape);
    return () => {
      document.removeEventListener('mousedown', cerrarFuera);
      document.removeEventListener('keydown', cerrarEscape);
    };
  }, [abierto]);

  return (
    <div className={styles.opciones} ref={ref}>
      <button
        type="button"
        className={styles.boton}
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        aria-haspopup="dialog"
      >
        <SlidersHorizontal size={15} /> Opciones
        {conFiltros && <span className={styles.punto}><span className={styles.soloLector}>(con filtros)</span></span>}
      </button>
      {abierto && (
        <div className={styles.panel} role="dialog" aria-label="Opciones de la lista">
          {children}
        </div>
      )}
    </div>
  );
}
