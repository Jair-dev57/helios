import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, FolderKanban, Users, Settings, Sun, Moon, LogOut, X } from 'lucide-react';
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

  // Los grupos sin items visibles para el rol no se muestran
  const grupos = [
    {
      titulo: 'Principal',
      items: [{ to: '/', label: 'Dashboard', end: true, Icon: LayoutDashboard, seccion: 'dashboard' }],
    },
    {
      titulo: 'Trabajo',
      items: [
        { to: '/proyectos', label: 'Proyectos', Icon: FolderKanban, seccion: 'proyectos' },
        { to: '/clientes', label: 'Clientes', Icon: Users, seccion: 'clientes' },
      ],
    },
    {
      titulo: 'Cuenta',
      // Todos entran a Configuracion (Mi perfil); Empresa y Usuarios dependen de la seccion
      items: [{ to: '/configuracion', label: 'Configuración', Icon: Settings }],
    },
  ]
    .map((g) => ({ ...g, items: g.items.filter((item) => !item.seccion || tieneSeccion(item.seccion)) }))
    .filter((g) => g.items.length > 0);

  return (
    <>
      {abierto && <div className={styles.overlay} onClick={onCerrar} />}
      <aside className={`${styles.sidebar} ${abierto ? styles.sidebarAbierto : ''}`}>
        <div className={styles.brand}>
          <MarcaEmpresa vertical tamanoLogo={64} className={styles.marca} classNameNombre={styles.appName} />
          <button className={styles.cerrarBtn} onClick={onCerrar} aria-label="Cerrar menu">
            <X size={20} />
          </button>
        </div>
        <nav className={styles.nav}>
          {grupos.map((grupo) => (
            <div key={grupo.titulo} className={styles.grupo}>
              <span className={styles.grupoTitulo}>{grupo.titulo}</span>
              {grupo.items.map(({ to, label, end, Icon }) => (
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
            </div>
          ))}
        </nav>
        <div className={styles.footer}>
          <NavLink to="/configuracion" onClick={onCerrar} className={styles.userSection} title="Mi perfil">
            <Avatar usuario={user} size={32} />
            <div className={styles.userInfo}>
              <span className={styles.userName}>{user?.nombre}</span>
              <span className={styles.userRole}>{user?.rol}</span>
            </div>
          </NavLink>
          <div className={styles.acciones}>
            <button
              className={styles.btnIcono}
              onClick={toggleTheme}
              title={theme === 'light' ? 'Modo oscuro' : 'Modo claro'}
              aria-label={theme === 'light' ? 'Cambiar a modo oscuro' : 'Cambiar a modo claro'}
            >
              {theme === 'light' ? <Moon size={15} /> : <Sun size={15} />}
            </button>
            <button
              className={`${styles.btnIcono} ${styles.btnSalir}`}
              onClick={handleLogout}
              title="Cerrar sesión"
              aria-label="Cerrar sesión"
            >
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
