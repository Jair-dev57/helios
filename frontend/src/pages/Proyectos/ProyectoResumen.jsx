import { useState, useEffect } from 'react';
import { useOutletContext, Link } from 'react-router-dom';
import { listarDocumentos } from '../../api/documentos';
import { listarTareas } from '../../api/tareas';
import styles from './ProyectoResumen.module.css';

export default function ProyectoResumen() {
  const { proyecto } = useOutletContext();
  const [documentos, setDocumentos] = useState([]);
  const [tareas, setTareas] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      listarDocumentos(proyecto.id),
      listarTareas(proyecto.id),
    ])
      .then(([dataDocs, dataTareas]) => {
        setDocumentos(dataDocs);
        setTareas(dataTareas);
      })
      .finally(() => setLoading(false));
  }, [proyecto.id]);

  const tareasAbiertas = tareas.filter((t) => t.estado !== 'hecho').length;

  const conteoPorEstado = {
    por_hacer: tareas.filter((t) => t.estado === 'por_hacer').length,
    en_progreso: tareas.filter((t) => t.estado === 'en_progreso').length,
    en_revision: tareas.filter((t) => t.estado === 'en_revision').length,
    hecho: tareas.filter((t) => t.estado === 'hecho').length,
  };

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
          <span className={styles.metricaValor}>{loading ? '-' : tareasAbiertas}</span>
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

      <div className={styles.seccionHeader} style={{ marginTop: '2.5rem' }}>
        <h2 className={styles.seccionTitulo}>Tareas</h2>
        <Link to="tareas" className={styles.verTodos}>Ver tablero →</Link>
      </div>

      {loading ? (
        <p className={styles.mensaje}>Cargando...</p>
      ) : tareas.length === 0 ? (
        <p className={styles.mensaje}>Aún no hay tareas en este proyecto.</p>
      ) : (
        <div className={styles.resumenTareas}>
          <div className={styles.resumenTareaItem}>
            <span className={styles.resumenTareaLabel}>Por hacer</span>
            <span className={styles.resumenTareaValor}>{conteoPorEstado.por_hacer}</span>
          </div>
          <div className={styles.resumenTareaItem}>
            <span className={styles.resumenTareaLabel}>En progreso</span>
            <span className={styles.resumenTareaValor}>{conteoPorEstado.en_progreso}</span>
          </div>
          <div className={styles.resumenTareaItem}>
            <span className={styles.resumenTareaLabel}>En revisión</span>
            <span className={styles.resumenTareaValor}>{conteoPorEstado.en_revision}</span>
          </div>
          <div className={styles.resumenTareaItem}>
            <span className={styles.resumenTareaLabel}>Hecho</span>
            <span className={styles.resumenTareaValor}>{conteoPorEstado.hecho}</span>
          </div>
        </div>
      )}
    </div>
  );
}