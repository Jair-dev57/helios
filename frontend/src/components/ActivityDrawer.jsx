import { useState, useEffect } from 'react';
import { X, FileClock } from 'lucide-react';
import { listarActividadDocumentos } from '../api/documentos';
import styles from './ActivityDrawer.module.css';

export default function ActivityDrawer({ proyectoId, open, onClose }) {
  const [actividad, setActividad] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    listarActividadDocumentos(proyectoId)
      .then(setActividad)
      .finally(() => setLoading(false));
  }, [open, proyectoId]);

  if (!open) return null;

  const formatearFecha = (iso) => {
    const fecha = new Date(iso);
    return fecha.toLocaleString('es-CO', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <>
      <div className={styles.overlay} onClick={onClose} />
      <aside className={styles.drawer}>
        <div className={styles.header}>
          <div className={styles.headerTitulo}>
            <FileClock size={18} />
            <span>Actividad de documentos</span>
          </div>
          <button className={styles.closeBtn} onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className={styles.body}>
          {loading ? (
            <p className={styles.mensaje}>Cargando...</p>
          ) : actividad.length === 0 ? (
            <p className={styles.mensaje}>Aún no hay actividad registrada.</p>
          ) : (
            <div className={styles.timeline}>
              {actividad.map((item, i) => (
                <div key={`${item.documento_id}-${item.numero_version}-${i}`} className={styles.item}>
                  <span className={styles.punto} />
                  <div className={styles.itemBody}>
                    <p className={styles.itemTexto}>
                      <strong>{item.documento_nombre}</strong>
                      {item.numero_version === 1 ? ' fue creado' : ` se actualizó a v${item.numero_version}`}
                    </p>
                    {item.notas && <p className={styles.itemNotas}>{item.notas}</p>}
                    <div className={styles.itemMeta}>
                      <span>{item.usuario_nombre || 'Usuario desconocido'}</span>
                      <span>·</span>
                      <span>{formatearFecha(item.created_at)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </aside>
    </>
  );
}