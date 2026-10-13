import { useEffect, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, FolderKanban, Users, Settings, LogOut, X, PanelLeftClose, PanelLeftOpen, ListChecks, CalendarDays,
  Activity, House, Briefcase, FolderOpen, Lock, Building2, Share2, Inbox, Trash2,
} from 'lucide-react';
import { listarMisTareas, EVENTO_MIS_TAREAS } from '../api/tareas';
import { listarEspacios, EVENTO_ESPACIOS } from '../api/espacios';
import { useAuth } from '../hooks/useAuth';
import MarcaEmpresa from './MarcaEmpresa';
import styles from './Sidebar.module.css';

const ARCHIVOS = ['archivos', 'documentos'];

// Menu de cada modulo; cada opcion aparece solo si el rol tiene su seccion (o todas, si es una lista)
const MODULOS = {
  proyectos: {
    titulo: 'Proyectos',
    grupos: [
      {
        titulo: 'Gestión',
        items: [
          { to: '/dashboard', label: 'Dashboard', Icon: LayoutDashboard, seccion: 'dashboard' },
          { to: '/proyectos', label: 'Proyectos', Icon: FolderKanban, seccion: 'proyectos' },
          { to: '/clientes', label: 'Clientes', Icon: Users, seccion: 'clientes' },
        ],
      },
      {
        titulo: 'Mi trabajo',
        items: [
          { to: '/mis-tareas', label: 'Mis tareas', Icon: ListChecks, seccion: 'mis_tareas', contador: 'misTareas' },
          { to: '/calendario', label: 'Calendario', Icon: CalendarDays, seccion: 'calendario' },
        ],
      },
    ],
  },
  archivos: {
    titulo: 'Archivos',
    grupos: [
      {
        items: [
          { to: '/archivos/compartidos', label: 'Compartidos', Icon: Share2, seccion: ARCHIVOS },
          { to: '/archivos/solicitudes', label: 'Solicitudes', Icon: Inbox, seccion: ARCHIVOS },
        ],
      },
      {
        titulo: 'Personal',
        items: [{ to: '/archivos', label: 'Mis archivos', end: true, Icon: Lock, seccion: ARCHIVOS }],
      },
      // Los espacios del equipo se agregan al cargar (ver espaciosEquipo)
      { titulo: 'Equipo', espacios: true, items: [] },
    ],
    pie: [{ to: '/archivos/papelera', label: 'Papelera', Icon: Trash2, seccion: ARCHIVOS }],
  },
};

const rutasDe = (modulo) => MODULOS[modulo].grupos.flatMap((g) => g.items.map((i) => i.to)).concat((MODULOS[modulo].pie || []).map((i) => i.to));
const moduloDe = (pathname) => Object.keys(MODULOS).find((m) => (
  m === 'archivos' ? pathname === '/archivos' || pathname.startsWith('/archivos/') : rutasDe(m).some((r) => pathname === r || pathname.startsWith(`${r}/`))
));

// Pendientes de «Mis tareas»: se recalcula al navegar y cuando la pagina avisa un cambio
function usePendientes(activo) {
  const { pathname } = useLocation();
  const [pendientes, setPendientes] = useState(0);
  useEffect(() => {
    if (!activo) return undefined;
    let cancelado = false;
    const contar = () => listarMisTareas()
      .then((t) => { if (!cancelado) setPendientes(t.filter((x) => !x.terminada).length); })
      .catch(() => {});
    contar();
    window.addEventListener(EVENTO_MIS_TAREAS, contar);
    return () => { cancelado = true; window.removeEventListener(EVENTO_MIS_TAREAS, contar); };
  }, [activo, pathname]);
  return pendientes;
}

// Espacios de equipo para el menu de Archivos: se recargan cuando se crea, edita o elimina uno
function useEspaciosEquipo(activo) {
  const [espacios, setEspacios] = useState([]);
  useEffect(() => {
    if (!activo) return undefined;
    let cancelado = false;
    const cargar = () => listarEspacios()
      .then((e) => { if (!cancelado) setEspacios(e.equipo); })
      .catch(() => {});
    cargar();
    window.addEventListener(EVENTO_ESPACIOS, cargar);
    return () => { cancelado = true; window.removeEventListener(EVENTO_ESPACIOS, cargar); };
  }, [activo]);
  return espacios;
}

/**
 * Riel con los modulos (Inicio, Proyectos, Archivos, Actividad) y, al lado, el menu del modulo actual.
 * Colapsar (Ctrl+B) oculta el menu del modulo; el riel siempre queda.
 */
const Sidebar = ({ abierto, onCerrar, colapsado = false, onColapsar }) => {
  const { tieneSeccion, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const permitido = (item) => [].concat(item.seccion || []).every(tieneSeccion);
  const verArchivos = ARCHIVOS.every(tieneSeccion);
  const contadores = { misTareas: usePendientes(tieneSeccion('mis_tareas')) };
  const espaciosEquipo = useEspaciosEquipo(verArchivos);

  const modulo = moduloDe(pathname);
  // El modulo Proyectos abre en su primera opcion permitida (Dashboard, si el rol lo tiene)
  const inicioProyectos = MODULOS.proyectos.grupos.flatMap((g) => g.items).find(permitido)?.to;

  const grupos = modulo
    ? MODULOS[modulo].grupos
      .map((g) => {
        if (!g.espacios) return { ...g, items: g.items.filter(permitido) };
        const items = espaciosEquipo.map((e) => ({ to: `/archivos/equipo/${e.id}`, label: e.nombre, color: e.color }));
        // Con espacios: la lista y un acceso a todos; sin espacios, solo «Del equipo» (alli el administrador crea uno)
        items.push({ to: '/archivos/equipo', end: true, label: items.length ? 'Todos los espacios' : 'Del equipo', Icon: Building2, secundario: items.length > 0 });
        return { ...g, items: verArchivos ? items : [] };
      })
      .filter((g) => g.items.length)
    : [];
  const pie = modulo ? (MODULOS[modulo].pie || []).filter(permitido) : [];

  const claseRiel = (activo) => `${styles.rielItem} ${activo ? styles.rielActivo : ''}`;
  const claseItem = ({ isActive }) => `${styles.navItem} ${isActive ? styles.navItemActive : ''}`;

  const itemMenu = ({ to, label, end, Icon, contador, color, secundario }) => {
    const n = contador ? contadores[contador] : 0;
    return (
      <NavLink key={to} to={to} end={end} onClick={onCerrar} className={(p) => `${claseItem(p)} ${secundario ? styles.secundario : ''}`} title={label}>
        {Icon
          ? <Icon size={secundario ? 15 : 18} strokeWidth={2} className={styles.navIcon} />
          : <span className={styles.colorEspacio} style={{ background: color || 'var(--accent)' }} aria-hidden="true" />}
        <span className={styles.texto}>{label}</span>
        {n > 0 && <span className={styles.contador}>{n}</span>}
      </NavLink>
    );
  };

  return (
    <>
      {abierto && <div className={styles.overlay} onClick={onCerrar} />}
      <aside className={`${styles.sidebar} ${abierto ? styles.sidebarAbierto : ''} ${colapsado ? styles.colapsado : ''}`}>
        <nav className={styles.riel} aria-label="Módulos">
          <MarcaEmpresa tamanoLogo={40} vertical className={styles.marca} classNameNombre={styles.nombreEmpresa} />
          <button className={styles.cerrarBtn} onClick={onCerrar} aria-label="Cerrar menu">
            <X size={20} />
          </button>

          <NavLink to="/" end onClick={onCerrar} className={({ isActive }) => claseRiel(isActive)}>
            <House size={21} /> <span>Inicio</span>
          </NavLink>
          {inicioProyectos && (
            <NavLink to={inicioProyectos} onClick={onCerrar} className={claseRiel(modulo === 'proyectos')}>
              <Briefcase size={21} /> <span>Proyectos</span>
              {contadores.misTareas > 0 && <span className={styles.rielContador}>{contadores.misTareas}</span>}
            </NavLink>
          )}
          {verArchivos && (
            <NavLink to="/archivos" onClick={onCerrar} className={claseRiel(modulo === 'archivos')}>
              <FolderOpen size={21} /> <span>Archivos</span>
            </NavLink>
          )}
          {tieneSeccion('actividad') && (
            <NavLink to="/actividad" onClick={onCerrar} className={({ isActive }) => claseRiel(isActive)}>
              <Activity size={21} /> <span>Actividad</span>
            </NavLink>
          )}

          <div className={styles.rielPie}>
            {modulo && (
              <button
                type="button"
                className={`${styles.rielBoton} ${styles.soloEscritorio}`}
                onClick={onColapsar}
                aria-expanded={!colapsado}
                aria-label={`${colapsado ? 'Mostrar' : 'Ocultar'} menú de ${MODULOS[modulo].titulo}`}
                title={`${colapsado ? 'Mostrar' : 'Ocultar'} menú (Ctrl+B)`}
              >
                {colapsado ? <PanelLeftOpen size={19} /> : <PanelLeftClose size={19} />}
              </button>
            )}
            {/* Todos entran a Configuracion (Mi perfil); Empresa y Usuarios dependen de la seccion */}
            <NavLink
              to="/configuracion"
              onClick={onCerrar}
              className={({ isActive }) => `${styles.rielBoton} ${isActive ? styles.rielActivo : ''}`}
              aria-label="Configuración"
              title="Configuración"
            >
              <Settings size={19} />
            </NavLink>
            <button type="button" className={`${styles.rielBoton} ${styles.salir}`} onClick={handleLogout} aria-label="Cerrar sesión" title="Cerrar sesión">
              <LogOut size={19} />
            </button>
          </div>
        </nav>

        {modulo && (
          <nav className={styles.menu} aria-label={MODULOS[modulo].titulo}>
            <h2 className={styles.menuTitulo}>{MODULOS[modulo].titulo}</h2>
            <div className={styles.nav}>
              {grupos.map((g) => (
                <div key={g.titulo || 'principal'} className={styles.grupo}>
                  {g.titulo && <span className={styles.grupoTitulo}>{g.titulo}</span>}
                  {g.items.map(itemMenu)}
                </div>
              ))}
            </div>
            {pie.length > 0 && <div className={styles.footer}>{pie.map(itemMenu)}</div>}
          </nav>
        )}
      </aside>
    </>
  );
};

export default Sidebar;
