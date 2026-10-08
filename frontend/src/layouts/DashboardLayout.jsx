import { useState, useEffect, useCallback } from 'react';
import { Outlet, Link } from 'react-router-dom';
import { Menu, Sun, Moon } from 'lucide-react';
import Sidebar from '../components/Sidebar';
import BusquedaGlobal from '../components/BusquedaGlobal';
import Avatar from '../components/Avatar';
import Notificaciones from '../components/Notificaciones';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../context/ThemeContext';
import styles from './DashboardLayout.module.css';

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

const CLAVE_COLAPSADO = 'menu.colapsado';

const leerColapsado = () => {
  try {
    return localStorage.getItem(CLAVE_COLAPSADO) === '1';
  } catch {
    return false;
  }
};

const DashboardLayout = () => {
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [colapsado, setColapsado] = useState(leerColapsado);

  const alternarColapso = useCallback(() => {
    setColapsado((actual) => {
      try {
        localStorage.setItem(CLAVE_COLAPSADO, actual ? '0' : '1');
      } catch {
        // Sin almacenamiento el estado simplemente no se recuerda
      }
      return !actual;
    });
  }, []);

  // Ctrl+B (Cmd+B en Mac) colapsa o expande el menu
  useEffect(() => {
    const alTeclear = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        alternarColapso();
      }
    };
    document.addEventListener('keydown', alTeclear);
    return () => document.removeEventListener('keydown', alTeclear);
  }, [alternarColapso]);
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const ahora = new Date();

  return (
    <div className={styles.layout}>
      <Sidebar
        abierto={menuAbierto}
        onCerrar={() => setMenuAbierto(false)}
        colapsado={colapsado}
        onColapsar={alternarColapso}
      />
      <div className={styles.principal}>
        <header className={styles.header}>
          <button
            className={styles.menuBtn}
            onClick={() => setMenuAbierto(true)}
            aria-label="Abrir menu"
          >
            <Menu size={22} />
          </button>
          <BusquedaGlobal />
          <div className={styles.derecha}>
            <span className={styles.fecha}>
              {DIAS[ahora.getDay()]}, {ahora.getDate()} de {MESES[ahora.getMonth()]}
            </span>
            <Notificaciones />
            <div className={styles.tema} role="group" aria-label="Tema">
              <button
                type="button"
                aria-pressed={theme === 'light'}
                onClick={() => theme !== 'light' && toggleTheme()}
                title="Tema claro"
                aria-label="Tema claro"
              >
                <Sun size={16} />
              </button>
              <button
                type="button"
                aria-pressed={theme === 'dark'}
                onClick={() => theme !== 'dark' && toggleTheme()}
                title="Tema oscuro"
                aria-label="Tema oscuro"
              >
                <Moon size={16} />
              </button>
            </div>
            <Link to="/configuracion" className={styles.perfil} title="Mi perfil">
              <Avatar usuario={user} size={34} />
              <span className={styles.perfilTexto}>
                <b>{user?.nombre}</b>
                <small>{user?.rol}</small>
              </span>
            </Link>
          </div>
        </header>
        <main className={styles.content}>
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
