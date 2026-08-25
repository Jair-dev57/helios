import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, FolderKanban, Users, UsersRound, Sun, Moon, LogOut } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../context/ThemeContext';
import styles from './Sidebar.module.css';

const Sidebar = () => {
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
  ].filter((item) => (item.secciones ? item.secciones.some(tieneSeccion) : tieneSeccion(item.seccion)));

  return (
    <aside className={styles.sidebar}>
      <div className={styles.brand}>
        <span className={styles.logo}>🌞</span>
        <span className={styles.appName}>Helios</span>
      </div>
      <nav className={styles.nav}>
        {navItems.map(({ to, label, end, Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
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
        <div className={styles.userSection}>
          <div className={styles.userAvatar}>{user?.nombre?.[0]?.toUpperCase() || '?'}</div>
          <div className={styles.userInfo}>
            <span className={styles.userName}>{user?.nombre}</span>
            <span className={styles.userRole}>{user?.rol}</span>
          </div>
        </div>
        <button className={styles.logoutButton} onClick={handleLogout}>
          <LogOut size={16} />
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
