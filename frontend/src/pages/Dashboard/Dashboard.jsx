import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { obtenerDashboard } from '../../api/dashboard';
import PageContainer from '../../components/PageContainer';
import shared from '../../styles/shared.module.css';
import styles from './Dashboard.module.css';

const ESTADOS_LABEL = {
  por_hacer: 'Por hacer',
  en_progreso: 'En progreso',
  en_revision: 'En revisión',
  hecho: 'Hecho',
};

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    obtenerDashboard()
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className={shared.loadingText} style={{ padding: '2rem' }}>Cargando dashboard...</p>;
  if (!data) return <p className={shared.emptyText} style={{ padding: '2rem' }}>No se pudo cargar el dashboard.</p>;

  const totalTareas = Object.values(data.distribucion_estados).reduce((a, b) => a + b, 0);

  return (
    <PageContainer wide>
      <h1 className={styles.titulo}>Dashboard</h1>

      <div className={styles.metricas}>
        <div className={styles.metrica}>
          <span className={styles.metricaLabel}>Proyectos activos</span>
          <span className={styles.metricaValor}>{data.proyectos_activos}</span>
        </div>
        <div className={styles.metrica}>
          <span className={styles.metricaLabel}>Tareas abiertas</span>
          <span className={styles.metricaValor}>{data.tareas_abiertas}</span>
        </div>
        <div className={styles.metrica}>
          <span className={styles.metricaLabel}>Documentos</span>
          <span className={styles.metricaValor}>{data.total_documentos}</span>
        </div>
        <div className={`${styles.metrica} ${data.tareas_vencidas.length > 0 ? styles.metricaAlerta : ''}`}>
          <span className={styles.metricaLabel}>Tareas vencidas</span>
          <span className={styles.metricaValor}>{data.tareas_vencidas.length}</span>
        </div>
      </div>

      <div className={styles.grid}>
        <div className={shared.card}>
          <h2 className={styles.cardTitulo}>Tareas por estado</h2>
          <div className={styles.barras}>
            {Object.entries(data.distribucion_estados).map(([estado, cantidad]) => (
              <div key={estado} className={styles.barraFila}>
                <span className={styles.barraLabel}>{ESTADOS_LABEL[estado] || estado}</span>
                <div className={styles.barraTrack}>
                  <div
                    className={styles.barraFill}
                    style={{ width: totalTareas ? `${(cantidad / totalTareas) * 100}%` : '0%' }}
                  />
                </div>
                <span className={styles.barraValor}>{cantidad}</span>
              </div>
            ))}
          </div>
        </div>

        <div className={shared.card}>
          <h2 className={styles.cardTitulo}>Carga por usuario</h2>
          {data.carga_por_usuario.length === 0 ? (
            <p className={shared.emptyText}>Nadie tiene tareas asignadas todavía.</p>
          ) : (
            <div className={styles.lista}>
              {data.carga_por_usuario.map((u) => (
                <div key={u.usuario_id} className={styles.listaItem}>
                  <span>{u.nombre}</span>
                  <span className={`${shared.badge} ${shared['badge-neutral']}`}>{u.total_tareas} tareas</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className={shared.card}>
          <h2 className={styles.cardTitulo}>Proyectos en riesgo</h2>
          {data.proyectos_en_riesgo.length === 0 ? (
            <p className={shared.emptyText}>Ningún proyecto tiene tareas vencidas. 🎉</p>
          ) : (
            <div className={styles.lista}>
              {data.proyectos_en_riesgo.map((p) => (
                <Link key={p.proyecto_id} to={`/proyectos/${p.proyecto_id}`} className={styles.listaItemLink}>
                  <span>{p.nombre}</span>
                  <span className={`${shared.badge} ${shared['badge-danger']}`}>{p.tareas_vencidas} vencidas</span>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className={`${shared.card} ${styles.cardAncho}`}>
          <h2 className={styles.cardTitulo}>Alertas de vencimiento</h2>
          {data.tareas_vencidas.length === 0 && data.tareas_por_vencer.length === 0 ? (
            <p className={shared.emptyText}>No hay tareas vencidas ni próximas a vencer. 🎉</p>
          ) : (
            <div className={styles.tablaAlertas}>
              {data.tareas_vencidas.map((t) => (
                <Link key={`v-${t.id}`} to={`/proyectos/${t.proyecto_id}/tareas`} className={styles.filaAlerta}>
                  <span className={styles.puntoVencido} />
                  <span className={styles.alertaTitulo}>{t.titulo}</span>
                  <span className={styles.alertaProyecto}>{t.proyecto_nombre}</span>
                  <span className={styles.alertaFecha}>{t.fecha_vencimiento?.slice(0, 10)}</span>
                </Link>
              ))}
              {data.tareas_por_vencer.map((t) => (
                <Link key={`p-${t.id}`} to={`/proyectos/${t.proyecto_id}/tareas`} className={styles.filaAlerta}>
                  <span className={styles.puntoProximo} />
                  <span className={styles.alertaTitulo}>{t.titulo}</span>
                  <span className={styles.alertaProyecto}>{t.proyecto_nombre}</span>
                  <span className={styles.alertaFecha}>{t.fecha_vencimiento?.slice(0, 10)}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </PageContainer>
  );
}