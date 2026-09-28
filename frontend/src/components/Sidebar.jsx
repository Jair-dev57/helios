import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, FolderKanban, Users, Settings, LogOut, X, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import MarcaEmpresa from './MarcaEmpresa';
import styles from './Sidebar.module.css';

// Solo en escritorio el menu se puede colapsar; en celular siempre se abre completo
const esEscritorio = () => window.matchMedia('(min-width: 901px)').matches;

const ITEMS = [
  { to: '/', label: 'Dashboard', end: true, Icon: LayoutDashboard, seccion: 'dashboard' },
  { to: '/proyectos', label: 'Proyectos', Icon: FolderKanban, seccion: 'proyectos' },
  { to: '/clientes', label: 'Clientes', Icon: Users, seccion: 'clientes' },
];

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

  const items = ITEMS.filter((item) => tieneSeccion(item.seccion));
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
          {items.map(({ to, label, end, Icon }) => (
            <NavLink key={to} to={to} end={end} onClick={onCerrar} className={claseItem} {...conTooltip(label)}>
              <Icon size={18} strokeWidth={2} className={styles.navIcon} />
              <span className={styles.texto}>{label}</span>
            </NavLink>
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
