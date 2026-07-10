import { useState, useEffect } from 'react';
import { useOutletContext, Link } from 'react-router-dom';
import { listarDocumentos } from '../../api/documentos';
import styles from './ProyectoResumen.module.css';

export default function ProyectoResumen() {
  const { proyecto } = useOutletContext();
  const [documentos, setDocumentos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listarDocumentos(proyecto.id)
      .then(setDocumentos)
      .finally(() => setLoading(false));
  }, [proyecto.id]);

  return (
    <div>
      {proyecto.descripcion && (
        <p className={styles.descripcion}>{proyecto.descripcion}</p>
      )}

      <div className={styles.metricas}>
        <div className={styles.metrica}>
          <span className={styles.metricaLabel}>Documentos</span>
          <span className={styles.metricaValor}>{documentos.length}</span>
        </div>
        <div className={styles.metrica}>
          <span className={styles.metricaLabel}>Tareas abiertas</span>
          <span className={styles.metricaValor}>-</span>
        </div>
        <div className={styles.metrica}>
          <span className={styles.metricaLabel}>Última actividad</span>
          <span className={styles.metricaValor}>
            {proyecto.updated_at ? proyecto.updated_at.slice(0, 10) : '-'}
          </span>
        </div>
      </div>

      <div className={styles.seccionHeader}>
        <h2 className={styles.seccionTitulo}>Documentos recientes</h2>
        <Link to="documentos" className={styles.verTodos}>Ver todos →</Link>
      </div>

      {loading ? (
        <p className={styles.mensaje}>Cargando...</p>
      ) : documentos.length === 0 ? (
        <p className={styles.mensaje}>Aún no hay documentos en este proyecto.</p>
      ) : (
        <div className={styles.lista}>
          {documentos.slice(0, 4).map((doc) => (
            <div key={doc.id} className={styles.item}>
              <span>{doc.nombre}</span>
              <span className={styles.version}>v{doc.version_actual}</span>
            </div>
          ))}
        </div>
      )}

      <h2 className={styles.seccionTitulo} style={{ marginTop: '2.5rem' }}>Tareas</h2>
      <div className={styles.placeholder}>
        Vista Kanban — próximamente
      </div>
    </div>
  );
}