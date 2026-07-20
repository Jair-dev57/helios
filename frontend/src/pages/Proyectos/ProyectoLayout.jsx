import { useState, useEffect, useCallback } from 'react';
import { useParams, NavLink, Outlet, Link } from 'react-router-dom';
import { obtenerProyecto, actualizarProyecto } from '../../api/proyectos';
import { listarClientes } from '../../api/clientes';
import PageContainer from '../../components/PageContainer';
import shared from '../../styles/shared.module.css';
import styles from './ProyectoLayout.module.css';

const ESTADOS = ['activo', 'pausado', 'completado', 'cancelado'];

export default function ProyectoLayout() {
  const { id } = useParams();
  const [proyecto, setProyecto] = useState(null);
  const [cliente, setCliente] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const cargar = useCallback(async () => {
    try {
      setLoading(true);
      const dataProyecto = await obtenerProyecto(id);
      setProyecto(dataProyecto);
      if (dataProyecto.cliente_id) {
        const clientes = await listarClientes();
        setCliente(clientes.find((c) => c.id === dataProyecto.cliente_id) || null);
      } else {
        setCliente(null);
      }
      setError('');
    } catch (err) {
      setError('No se pudo cargar el proyecto.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const cambiarEstado = async (nuevoEstado) => {
    try {
      const actualizado = await actualizarProyecto(id, { estado: nuevoEstado });
      setProyecto(actualizado);
    } catch (err) {
      alert('No se pudo cambiar el estado.');
    }
  };

  if (loading) return <p className={shared.loadingText} style={{ padding: '2rem' }}>Cargando proyecto...</p>;
  if (error) return <p className={shared.errorBanner} style={{ margin: '2rem' }}>{error}</p>;
  if (!proyecto) return null;

  return (
    <PageContainer wide>
      <div className={styles.breadcrumb}>
        <Link to="/proyectos" className={styles.breadcrumbLink}>Proyectos</Link>
        <span> / </span>
        <span className={styles.breadcrumbActual}>{proyecto.nombre}</span>
      </div>

      <div className={styles.header}>
        <div>
          <h1 className={styles.titulo}>{proyecto.nombre}</h1>
          <div className={styles.meta}>
            {cliente && <span>{cliente.nombre}</span>}
            {proyecto.fecha_vencimiento && (
              <span>Vence {proyecto.fecha_vencimiento.slice(0, 10)}</span>
            )}
          </div>
        </div>
        <select
          className={`${styles.estadoSelect} ${styles[`estado_${proyecto.estado}`] || ''}`}
          value={proyecto.estado}
          onChange={(e) => cambiarEstado(e.target.value)}
        >
          {ESTADOS.map((e) => (
            <option key={e} value={e}>{e}</option>
          ))}
        </select>
      </div>

      <nav className={styles.tabs}>
        <NavLink to="" end className={({ isActive }) => isActive ? `${styles.tab} ${styles.tabActive}` : styles.tab}>
          Resumen
        </NavLink>
        <NavLink to="documentos" className={({ isActive }) => isActive ? `${styles.tab} ${styles.tabActive}` : styles.tab}>
          Documentos
        </NavLink>
        <NavLink to="tareas" className={({ isActive }) => isActive ? `${styles.tab} ${styles.tabActive}` : styles.tab}>
          Tareas
        </NavLink>
      </nav>

      <div className={styles.contenido}>
        <Outlet context={{ proyecto, cliente, setProyecto }} />
      </div>
    </PageContainer>
  );
}