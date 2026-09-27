import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, FolderKanban, Users, UsersRound, Settings, Sun, Moon, LogOut, X } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../context/ThemeContext';
import Avatar from './Avatar';
import MarcaEmpresa from './MarcaEmpresa';
import styles from './Sidebar.module.css';

const Sidebar = ({ abierto, onCerrar }) => {
  const { user, tieneSeccion, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    { to: '/', label: 'Dashboard', end: true, Icon: LayoutDashboard, seccion: 'dashboard' },
    { to: '/proyectos', label: 'Proyectos', Icon: FolderKanban, seccion: 'proyectos' },
    { to: '/clientes', label: 'Clientes', Icon: Users, seccion: 'clientes' },
    { to: '/equipo', label: 'Equipo', Icon: UsersRound, secciones: ['usuarios', 'roles'] },
    // Todos entran a Configuracion (Mi perfil); la pestaña Empresa depende de la seccion
    { to: '/configuracion', label: 'Configuración', Icon: Settings },
  ].filter((item) => {
    if (item.secciones) return item.secciones.some(tieneSeccion);
    return !item.seccion || tieneSeccion(item.seccion);
  });

  return (
    <>
      {abierto && <div className={styles.overlay} onClick={onCerrar} />}
      <aside className={`${styles.sidebar} ${abierto ? styles.sidebarAbierto : ''}`}>
        <div className={styles.brand}>
          <MarcaEmpresa className={styles.marca} classNameNombre={styles.appName} />
          <button className={styles.cerrarBtn} onClick={onCerrar} aria-label="Cerrar menu">
            <X size={20} />
          </button>
        </div>
        <nav className={styles.nav}>
          {navItems.map(({ to, label, end, Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={onCerrar}
              className={({ isActive }) =>
                isActive ? `${styles.navItem} ${styles.navItemActive}` : styles.navItem
              }
            >
              <Icon size={18} strokeWidth={2} className={styles.navIcon} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className={styles.footer}>
          <button className={styles.themeToggle} onClick={toggleTheme}>
            {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
            {theme === 'light' ? 'Modo oscuro' : 'Modo claro'}
          </button>
          <NavLink to="/configuracion" onClick={onCerrar} className={styles.userSection} title="Mi perfil">
            <Avatar usuario={user} size={32} />
            <div className={styles.userInfo}>
              <span className={styles.userName}>{user?.nombre}</span>
              <span className={styles.userRole}>{user?.rol}</span>
            </div>
          </NavLink>
          <button className={styles.logoutButton} onClick={handleLogout}>
            <LogOut size={16} />
            Cerrar sesión
          </button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
