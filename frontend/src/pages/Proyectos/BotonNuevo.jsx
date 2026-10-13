import { useEffect, useRef, useState } from 'react';
import { Plus, ChevronDown, FolderPlus, FileUp, FolderUp } from 'lucide-react';
import estilosExplorador from './ExploradorArchivos.module.css';
import styles from './ProyectoDocumentos.module.css';

/** Accion principal del menu lateral: nueva carpeta o subir archivos/carpeta a la carpeta abierta */
export default function BotonNuevo({ destino, onNuevaCarpeta, onElegir }) {
  const [abierto, setAbierto] = useState(false);
  const selectorArchivos = useRef(null);
  const selectorCarpeta = useRef(null);

  // Cerrar al hacer clic fuera o con Escape
  useEffect(() => {
    if (!abierto) return undefined;
    const cerrar = () => setAbierto(false);
    const conTecla = (e) => e.key === 'Escape' && cerrar();
    document.addEventListener('click', cerrar);
    document.addEventListener('keydown', conTecla);
    return () => {
      document.removeEventListener('click', cerrar);
      document.removeEventListener('keydown', conTecla);
    };
  }, [abierto]);

  const elegir = (selector) => {
    setAbierto(false);
    selector.current?.click();
  };
  const alElegir = (e) => {
    const lista = [...e.target.files];
    e.target.value = ''; // permite volver a elegir lo mismo
    if (lista.length) onElegir(lista);
  };
  const donde = destino ? `En «${destino.nombre}»` : 'En la raíz del proyecto';

  return (
    <div className={styles.nuevo}>
      <button
        className={styles.botonNuevo}
        onClick={(e) => { e.stopPropagation(); setAbierto((v) => !v); }}
        aria-haspopup="menu"
        aria-expanded={abierto}
      >
        <Plus size={16} strokeWidth={2.4} />
        <span>Nuevo</span>
        <ChevronDown size={14} />
      </button>
      {abierto && (
        <div className={`${estilosExplorador.menuSubir} ${styles.menuNuevo}`} role="menu" onClick={(e) => e.stopPropagation()}>
          <button role="menuitem" onClick={() => { setAbierto(false); onNuevaCarpeta(); }}>
            <FolderPlus size={18} />
            <span><strong>Nueva carpeta</strong><small>{donde}</small></span>
          </button>
          {destino && (
            <>
              <hr />
              <button role="menuitem" onClick={() => elegir(selectorArchivos)}>
                <FileUp size={18} />
                <span><strong>Subir archivos</strong><small>{donde}</small></span>
              </button>
              <button role="menuitem" onClick={() => elegir(selectorCarpeta)}>
                <FolderUp size={18} />
                <span><strong>Subir carpeta</strong><small>Conserva subcarpetas. Tu navegador te pedirá confirmar.</small></span>
              </button>
            </>
          )}
        </div>
      )}
      <input ref={selectorArchivos} type="file" multiple hidden onChange={alElegir} />
      <input ref={selectorCarpeta} type="file" webkitdirectory="" hidden onChange={alElegir} />
    </div>
  );
}
