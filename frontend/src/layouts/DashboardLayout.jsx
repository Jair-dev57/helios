import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Menu } from 'lucide-react';
import Sidebar from '../components/Sidebar';
import BusquedaGlobal from '../components/BusquedaGlobal';
import styles from './DashboardLayout.module.css';

const DashboardLayout = () => {
  const [menuAbierto, setMenuAbierto] = useState(false);

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
        </header>
        <main className={styles.content}>
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
