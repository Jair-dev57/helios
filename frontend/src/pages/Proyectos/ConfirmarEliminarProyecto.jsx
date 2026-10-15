import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { X, Trash2, AlertTriangle } from 'lucide-react';
import { eliminarProyecto, obtenerContenidoProyecto } from '../../api/proyectos';
import { mensajeError } from '../../api/client';
import { EVENTO_FAVORITOS_PROYECTOS } from '../../api/favoritos';
import IconoProyecto from '../../components/ui/IconoProyecto';
import { plural } from '../../utils/formato';
import shared from '../../styles/shared.module.css';
import f from '../../styles/formulario.module.css';

/**
 * Confirmar antes de eliminar un proyecto para siempre. Muestra lo que se pierde; si tiene contenido,
 * pide escribir el nombre del proyecto. onEliminado() al terminar.
 */
export default function ConfirmarEliminarProyecto({ proyecto, onClose, onEliminado }) {
  const [contenido, setContenido] = useState(null);
  const [escrito, setEscrito] = useState('');
  const [eliminando, setEliminando] = useState(false);

  useEffect(() => {
    obtenerContenidoProyecto(proyecto.id).then(setContenido).catch(() => setContenido({ tareas: 0, archivos: 0, carpetas: 0 }));
  }, [proyecto.id]);

  useEffect(() => {
    const alTeclear = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', alTeclear);
    return () => window.removeEventListener('keydown', alTeclear);
  }, [onClose]);

  const tieneContenido = contenido && (contenido.tareas || contenido.archivos || contenido.carpetas);
  const confirmado = contenido && (!tieneContenido || escrito.trim() === proyecto.nombre.trim());

  const eliminar = async (e) => {
    e.preventDefault();
    if (!confirmado || eliminando) return;
    setEliminando(true);
    try {
      await eliminarProyecto(proyecto.id);
      toast.success(`«${proyecto.nombre}» eliminado`);
      // Si estaba en Favoritos, la barra lateral lo quita
      window.dispatchEvent(new Event(EVENTO_FAVORITOS_PROYECTOS));
      onEliminado?.();
    } catch (err) {
      toast.error(mensajeError(err, 'No se pudo eliminar el proyecto'));
      setEliminando(false);
    }
  };

  const perdidas = contenido
    ? [
        contenido.tareas && plural(contenido.tareas, 'tarea'),
        contenido.archivos && plural(contenido.archivos, 'archivo'),
        contenido.carpetas && plural(contenido.carpetas, 'carpeta'),
      ].filter(Boolean)
    : [];

  return (
    <div className={f.fondo} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form className={f.modal} style={{ width: 'min(480px, 100%)' }} role="alertdialog" aria-modal="true" aria-label="Eliminar proyecto" onSubmit={eliminar}>
        <div className={f.barra}>
          <span className={f.ruta}><Trash2 size={15} /> <b>Eliminar proyecto</b></span>
          <button type="button" className={f.cerrar} onClick={onClose} aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>

        <div className={f.cuerpo}>
          <div className={f.cabecera}>
            <IconoProyecto proyecto={proyecto} size={44} />
            <div className={f.textos}>
              <b style={{ fontSize: '1.05rem' }}>¿Eliminar «{proyecto.nombre}»?</b>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                {contenido === null
                  ? 'Revisando lo que tiene…'
                  : perdidas.length
                    ? `Se eliminarán también ${perdidas.join(', ').replace(/, ([^,]*)$/, ' y $1')}, con todas sus versiones.`
                    : 'El proyecto está vacío.'}
              </span>
            </div>
          </div>

          <div className={f.aviso} style={{ background: 'var(--danger-soft)' }}>
            <AlertTriangle size={16} style={{ color: 'var(--danger)' }} />
            <span>
              Esto no se puede deshacer. Si solo quieres sacarlo de la lista, mejor archívalo como completado.
            </span>
          </div>

          {tieneContenido ? (
            <label className={shared.field} style={{ margin: 0 }}>
              <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                Escribe <b style={{ color: 'var(--text-primary)' }}>{proyecto.nombre}</b> para confirmar
              </span>
              <input value={escrito} onChange={(e) => setEscrito(e.target.value)} autoFocus aria-label="Nombre del proyecto" />
            </label>
          ) : null}
        </div>

        <div className={f.pie}>
          <span className={f.pieIzquierda} />
          <button type="button" className={shared.btnSecondary} onClick={onClose}>Cancelar</button>
          <button
            type="submit"
            className={shared.btnPrimary}
            style={{ background: 'var(--danger)', borderColor: 'var(--danger)', color: '#fff' }}
            disabled={!confirmado || eliminando}
          >
            {eliminando ? 'Eliminando…' : 'Eliminar para siempre'}
          </button>
        </div>
      </form>
    </div>
  );
}
