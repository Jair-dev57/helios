import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { listarProyectos } from '../../api/proyectos';
import { listarClientes } from '../../api/clientes';
import PageContainer from '../../components/PageContainer';
import IconoCarpeta from '../Proyectos/IconoCarpeta';
import { fechaRelativa, NOMBRE_ESTADO } from '../Proyectos/formato';
import listado from '../../styles/listado.module.css';
import shared from '../../styles/shared.module.css';
import styles from './Archivos.module.css';

// Primero los que estan en curso; dentro de cada estado, por nombre
const ORDEN_ESTADO = { activo: 0, pausado: 1, completado: 2, cancelado: 3 };

/** Todos los proyectos con acceso, para entrar a sus documentos desde Archivos */
export default function ArchivosProyectos() {
  const [proyectos, setProyectos] = useState(null);
  const [clientes, setClientes] = useState(new Map());

  useEffect(() => {
    listarProyectos()
      .then((p) => setProyectos(p
        .filter((x) => !x.tipo || x.tipo === 'proyecto')
        .sort((a, b) => (ORDEN_ESTADO[a.estado] ?? 9) - (ORDEN_ESTADO[b.estado] ?? 9) || a.nombre.localeCompare(b.nombre))))
      .catch(() => { setProyectos([]); toast.error('No se pudieron cargar los proyectos.'); });
    listarClientes()
      .then((c) => setClientes(new Map(c.map((x) => [x.id, x.nombre]))))
      .catch(() => {});
  }, []);

  return (
    <PageContainer wide>
      <header className={listado.header}>
        <div>
          <h1 className={listado.title}>Proyectos</h1>
          <p className={styles.subtitulo}>Los documentos de cada proyecto. Las tareas y entregas siguen en el módulo Proyectos.</p>
        </div>
      </header>

      {proyectos === null ? (
        <p className={shared.loadingText}>Cargando…</p>
      ) : proyectos.length === 0 ? (
        <div className={listado.vacio}>
          <b>No tienes proyectos</b>
          <span>Cuando te agreguen a un proyecto, sus documentos aparecerán aquí.</span>
        </div>
      ) : (
        <ul className={styles.espacios}>
          {proyectos.map((p) => (
            <li key={p.id}>
              <Link to={`/archivos/proyectos/${p.id}`} className={styles.tarjetaEspacio}>
                <IconoCarpeta size={40} />
                <span className={styles.tarjetaTexto}>
                  <b>{p.nombre}</b>
                  {clientes.get(p.cliente_id) && <small>{clientes.get(p.cliente_id)}</small>}
                </span>
                <span className={styles.tarjetaPie}>
                  <span>modificado {fechaRelativa(p.updated_at)}</span>
                  <span className={styles.estadoProyecto} data-estado={p.estado}>{NOMBRE_ESTADO[p.estado] || p.estado}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </PageContainer>
  );
}
