import { useState, useEffect, useCallback } from 'react';
import { useParams, NavLink, Outlet, Link, Navigate, useLocation } from 'react-router-dom';
import { FileClock, LayoutDashboard, Folder, ListChecks, CalendarClock } from 'lucide-react';
import { obtenerProyecto, actualizarProyecto } from '../../api/proyectos';
import { listarClientes } from '../../api/clientes';
import { rutaEspacio } from '../../api/espacios';
import { registrarProyectoVisto } from '../../api/favoritos';
import PageContainer from '../../components/PageContainer';
import ActivityDrawer from '../../components/ActivityDrawer';
import shared from '../../styles/shared.module.css';
import LogoCliente from '../Clientes/LogoCliente';
import IconoProyecto from './IconoProyecto';
import { ESTADOS_PROYECTO, NOMBRE_ESTADO, fechaCorta } from './formato';
import styles from './ProyectoLayout.module.css';

const PESTANAS = [
  { to: '', nombre: 'Resumen', Icono: LayoutDashboard, end: true },
  { to: 'documentos', nombre: 'Archivos', Icono: Folder },
  { to: 'tareas', nombre: 'Tareas', Icono: ListChecks },
];

export default function ProyectoLayout() {
  const { id } = useParams();
  const [proyecto, setProyecto] = useState(null);
  const [cliente, setCliente] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [drawerAbierto, setDrawerAbierto] = useState(false);
  const { search } = useLocation();

  const cargar = useCallback(async () => {
    try {
      setLoading(true);
      const dataProyecto = await obtenerProyecto(id);
      setProyecto(dataProyecto);
      // Para «Recientes» de Mis proyectos; si falla no afecta al proyecto
      if (!dataProyecto.tipo || dataProyecto.tipo === 'proyecto') registrarProyectoVisto(dataProyecto.id).catch(() => {});
      if (dataProyecto.cliente_id) {
        const clientes = await listarClientes();
        setCliente(clientes.find((c) => c.id === dataProyecto.cliente_id) || null);
      } else {
        setCliente(null);
      }
      setError('');
    } catch {
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
    } catch {
      alert('No se pudo cambiar el estado.');
    }
  };

  if (loading) return <p className={shared.loadingText} style={{ padding: '2rem' }}>Cargando proyecto...</p>;
  if (error) return <p className={shared.errorBanner} style={{ margin: '2rem' }}>{error}</p>;
  if (!proyecto) return null;
  // Un espacio de archivos (Mis archivos o de equipo) tiene su propia ruta; se conserva ?doc=…
  if (proyecto.tipo && proyecto.tipo !== 'proyecto') return <Navigate to={`${rutaEspacio(proyecto)}${search}`} replace />;

  return (
    <PageContainer wide>
      {/* Cabecera como la del explorador: la ruta con la carpeta del proyecto y sus datos en una linea */}
      <header className={styles.header}>
        <IconoProyecto proyecto={proyecto} size={38} apagado={proyecto.estado === 'completado' || proyecto.estado === 'cancelado'} />
        <div className={styles.cabeceraTexto}>
          <h1 className={styles.titulo}>
            <Link to="/proyectos">Proyectos</Link>
            <span>›</span>
            {proyecto.nombre}
          </h1>
          <div className={styles.meta}>
            {cliente && (
              <Link to={`/proyectos/clientes/${cliente.id}`} className={styles.dato}>
                <LogoCliente cliente={cliente} size={18} />
                {cliente.nombre}
              </Link>
            )}
            {proyecto.fecha_vencimiento && (
              <span className={styles.dato}><CalendarClock size={14} />Entrega {fechaCorta(proyecto.fecha_vencimiento)}</span>
            )}
          </div>
        </div>
        <div className={styles.headerAcciones}>
          <button className={styles.boton} onClick={() => setDrawerAbierto(true)} title="Ver actividad del proyecto">
            <FileClock size={15} />
            Actividad
          </button>
          <label className={styles.estado} title="Estado del proyecto">
            <i className={styles[`punto_${proyecto.estado}`]} />
            <select value={proyecto.estado} onChange={(e) => cambiarEstado(e.target.value)} aria-label="Estado del proyecto">
              {ESTADOS_PROYECTO.map((e) => (
                <option key={e} value={e}>{NOMBRE_ESTADO[e]}</option>
              ))}
            </select>
          </label>
        </div>
      </header>

      <nav className={styles.tabs} aria-label="Secciones del proyecto">
        {PESTANAS.map(({ to, nombre, Icono, end }) => (
          <NavLink key={nombre} to={to} end={end} className={({ isActive }) => `${styles.tab} ${isActive ? styles.tabActive : ''}`}>
            <Icono size={15} strokeWidth={1.8} />
            {nombre}
          </NavLink>
        ))}
      </nav>

      <div className={styles.contenido}>
        <Outlet context={{ proyecto, cliente, setProyecto, abrirActividad: () => setDrawerAbierto(true) }} />
      </div>

      <ActivityDrawer
        proyectoId={proyecto.id}
        open={drawerAbierto}
        onClose={() => setDrawerAbierto(false)}
      />
    </PageContainer>
  );
}
