import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, FolderKanban, Users, Settings, Sun, Moon, LogOut, X } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../context/ThemeContext';
import MarcaEmpresa from './MarcaEmpresa';
import styles from './Sidebar.module.css';

const Sidebar = ({ abierto, onCerrar }) => {
  const { tieneSeccion, logout } = useAuth();
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
          <button
            className={styles.btnPie}
            onClick={toggleTheme}
            aria-label={theme === 'light' ? 'Cambiar a modo oscuro' : 'Cambiar a modo claro'}
          >
            {theme === 'light' ? <Moon size={15} /> : <Sun size={15} />}
            {theme === 'light' ? 'Oscuro' : 'Claro'}
          </button>
          <button className={`${styles.btnPie} ${styles.btnSalir}`} onClick={handleLogout}>
            <LogOut size={15} />
            Salir
          </button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
