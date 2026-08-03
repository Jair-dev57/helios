import { Outlet } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import BusquedaGlobal from '../components/BusquedaGlobal';
import styles from './DashboardLayout.module.css';

const DashboardLayout = () => {
  return (
    <div className={styles.layout}>
      <Sidebar />
      <div className={styles.principal}>
        <header className={styles.header}>
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
