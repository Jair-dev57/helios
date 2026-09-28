import { useState } from 'react';
import { Outlet, Link } from 'react-router-dom';
import { Menu } from 'lucide-react';
import Sidebar from '../components/Sidebar';
import BusquedaGlobal from '../components/BusquedaGlobal';
import Avatar from '../components/Avatar';
import { useAuth } from '../hooks/useAuth';
import styles from './DashboardLayout.module.css';

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

const DashboardLayout = () => {
  const [menuAbierto, setMenuAbierto] = useState(false);
  const { user } = useAuth();
  const ahora = new Date();

  return (
    <div className={styles.layout}>
      <Sidebar abierto={menuAbierto} onCerrar={() => setMenuAbierto(false)} />
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
