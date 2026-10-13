import { useEffect, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, FolderKanban, Users, Settings, LogOut, X, ChevronLeft, ChevronRight, ListChecks, CalendarDays, Activity,
} from 'lucide-react';
import { listarMisTareas, EVENTO_MIS_TAREAS } from '../api/tareas';
import { useAuth } from '../hooks/useAuth';
import MarcaEmpresa from './MarcaEmpresa';
import styles from './Sidebar.module.css';

// Solo en escritorio el menu se puede colapsar; en celular siempre se abre completo
const esEscritorio = () => window.matchMedia('(min-width: 901px)').matches;

// Grupos del menu; cada opcion aparece solo si el rol tiene su seccion
const GRUPOS = [
  {
    items: [
      { to: '/', label: 'Dashboard', end: true, Icon: LayoutDashboard, seccion: 'dashboard' },
      { to: '/mis-tareas', label: 'Mis tareas', Icon: ListChecks, seccion: 'mis_tareas', contador: 'misTareas' },
      { to: '/calendario', label: 'Calendario', Icon: CalendarDays, seccion: 'calendario' },
      { to: '/actividad', label: 'Actividad', Icon: Activity, seccion: 'actividad' },
    ],
  },
  {
    titulo: 'Trabajo',
    items: [
      { to: '/proyectos', label: 'Proyectos', Icon: FolderKanban, seccion: 'proyectos' },
      { to: '/clientes', label: 'Clientes', Icon: Users, seccion: 'clientes' },
    ],
  },
];

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

const Sidebar = ({ abierto, onCerrar, colapsado = false, onColapsar }) => {
  const { tieneSeccion, logout } = useAuth();
  const navigate = useNavigate();
  const [tip, setTip] = useState(null);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Tooltip con el nombre de cada opcion cuando el menu esta colapsado
  const conTooltip = (texto) => ({
    onMouseEnter: (e) => mostrarTip(e, texto),
    onFocus: (e) => mostrarTip(e, texto),
    onMouseLeave: () => setTip(null),
    onBlur: () => setTip(null),
    'aria-label': colapsado ? texto : undefined,
  });
  const mostrarTip = (e, texto) => {
    if (!colapsado || !esEscritorio()) return;
    const r = e.currentTarget.getBoundingClientRect();
    setTip({ texto, top: r.top + r.height / 2, left: r.right + 12 });
  };

  const alternarColapso = () => {
    setTip(null);
    onColapsar?.();
  };

  const grupos = GRUPOS
    .map((g) => ({ ...g, items: g.items.filter((item) => tieneSeccion(item.seccion)) }))
    .filter((g) => g.items.length);
  const contadores = { misTareas: usePendientes(tieneSeccion('mis_tareas')) };
  const claseItem = ({ isActive }) => `${styles.navItem} ${isActive ? styles.navItemActive : ''}`;

  return (
    <>
      {abierto && <div className={styles.overlay} onClick={onCerrar} />}
      <aside
        className={`${styles.sidebar} ${abierto ? styles.sidebarAbierto : ''} ${colapsado ? styles.colapsado : ''}`}
      >
        <div className={styles.brand}>
          <MarcaEmpresa
            vertical
            tamanoLogo={colapsado ? 40 : 64}
            className={styles.marca}
            classNameNombre={styles.appName}
          />
          <button className={styles.cerrarBtn} onClick={onCerrar} aria-label="Cerrar menu">
            <X size={20} />
          </button>
        </div>

        <nav className={styles.nav}>
          {grupos.map((g) => (
            <div key={g.titulo || 'principal'} className={styles.grupo}>
              {g.titulo && <span className={styles.grupoTitulo}>{g.titulo}</span>}
              {g.items.map(({ to, label, end, Icon, contador }) => {
                const n = contador ? contadores[contador] : 0;
                return (
                  <NavLink key={to} to={to} end={end} onClick={onCerrar} className={claseItem} {...conTooltip(n ? `${label} (${n})` : label)}>
                    <Icon size={18} strokeWidth={2} className={styles.navIcon} />
                    <span className={styles.texto}>{label}</span>
                    {n > 0 && <span className={styles.contador}>{n}</span>}
                  </NavLink>
                );
              })}
            </div>
          ))}
        </nav>

        <div className={styles.footer}>
          {/* Todos entran a Configuracion (Mi perfil); Empresa y Usuarios dependen de la seccion */}
          <NavLink to="/configuracion" onClick={onCerrar} className={claseItem} {...conTooltip('Configuración')}>
            <Settings size={18} strokeWidth={2} className={styles.navIcon} />
            <span className={styles.texto}>Configuración</span>
          </NavLink>
          <button
            type="button"
            className={`${styles.navItem} ${styles.soloEscritorio}`}
            onClick={alternarColapso}
            aria-expanded={!colapsado}
            aria-label={`${colapsado ? 'Expandir' : 'Colapsar'} menú`}
            title={`${colapsado ? 'Expandir' : 'Colapsar'} menú (Ctrl+B)`}
          >
            {colapsado ? <ChevronRight size={18} className={styles.navIcon} /> : <ChevronLeft size={18} className={styles.navIcon} />}
            <span className={styles.texto}>Colapsar</span>
          </button>
          <button
            type="button"
            className={`${styles.navItem} ${styles.salir}`}
            onClick={handleLogout}
            {...conTooltip('Cerrar sesión')}
          >
            <LogOut size={18} className={styles.navIcon} />
            <span className={styles.texto}>Cerrar sesión</span>
          </button>
        </div>
      </aside>
      {tip && (
        <div className={styles.tooltip} role="tooltip" style={{ top: tip.top, left: tip.left }}>
          {tip.texto}
        </div>
      )}
    </>
  );
};

export default Sidebar;
