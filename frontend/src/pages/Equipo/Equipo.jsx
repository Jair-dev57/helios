import { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import PageContainer from '../../components/PageContainer';
import TabUsuarios from './TabUsuarios';
import TabRoles from './TabRoles';
import styles from './Equipo.module.css';

const Equipo = () => {
  const { tieneSeccion } = useAuth();
  const puedeUsuarios = tieneSeccion('usuarios');
  const puedeRoles = tieneSeccion('roles');

  const [tab, setTab] = useState(puedeUsuarios ? 'usuarios' : 'roles');

  return (
    <PageContainer>
      <h1 className={styles.title}>Equipo</h1>

      <div className={styles.tabs}>
        {puedeUsuarios && (
          <button
            className={tab === 'usuarios' ? styles.tabActive : styles.tab}
            onClick={() => setTab('usuarios')}
          >
            Usuarios
          </button>
        )}
        {puedeRoles && (
          <button
            className={tab === 'roles' ? styles.tabActive : styles.tab}
            onClick={() => setTab('roles')}
          >
            Roles y permisos
          </button>
        )}
      </div>

      {tab === 'usuarios' && puedeUsuarios && <TabUsuarios />}
      {tab === 'roles' && puedeRoles && <TabRoles />}
    </PageContainer>
  );
};

export default Equipo;
