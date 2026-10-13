import { useState } from 'react';
import shared from '../../styles/shared.module.css';
import styles from './Proyectos.module.css';

/**
 * Campo para crear algo por nombre sin salir de un formulario (p. ej. un cliente o un equipo
 * desde el del proyecto). onCrear(nombre) es async y lanza si falla; onCancelar vuelve a la lista.
 */
export default function CrearEnLinea({ placeholder, onCrear, onCancelar }) {
  const [nombre, setNombre] = useState('');
  const [creando, setCreando] = useState(false);

  const crear = async () => {
    if (!nombre.trim() || creando) return;
    setCreando(true);
    try {
      await onCrear(nombre.trim());
    } catch {
      setCreando(false);
    }
  };

  return (
    <div className={styles.crearEnLinea}>
      <input
        type="text"
        value={nombre}
        onChange={(e) => setNombre(e.target.value)}
        onKeyDown={(e) => {
          // Enter crea en vez de enviar el formulario de afuera; Escape vuelve a la lista
          if (e.key === 'Enter') { e.preventDefault(); crear(); }
          if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onCancelar(); }
        }}
        placeholder={placeholder}
        aria-label={placeholder}
        autoFocus
      />
      <button type="button" className={shared.btnPrimary} onClick={crear} disabled={creando || !nombre.trim()}>
        {creando ? 'Creando...' : 'Crear'}
      </button>
      <button type="button" className={shared.btnSecondary} onClick={onCancelar}>
        Cancelar
      </button>
    </div>
  );
}
