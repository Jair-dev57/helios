import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import PageContainer from '../../components/PageContainer';
import TabPerfil from './TabPerfil';
import TabEmpresa from './TabEmpresa';
import TabUsuarios from './TabUsuarios';
import TabRoles from './TabRoles';
import styles from './Configuracion.module.css';

// Usuarios y, debajo, sus roles y permisos; cada bloque segun el permiso del rol
const TabEquipo = () => {
  const { tieneSeccion } = useAuth();
  return (
    <div className={styles.bloques}>
      {tieneSeccion('usuarios') && <TabUsuarios />}
      {tieneSeccion('roles') && <TabRoles />}
    </div>
  );
};

// `secciones` = permisos del rol que habilitan la pestaña (Mi perfil es para todos)
const TABS = [
  { id: 'perfil', label: 'Mi perfil', Componente: TabPerfil },
  { id: 'empresa', label: 'Empresa', Componente: TabEmpresa, secciones: ['configuracion'] },
  { id: 'usuarios', label: 'Usuarios', Componente: TabEquipo, secciones: ['usuarios', 'roles'] },
];

const Configuracion = () => {
  const { tieneSeccion } = useAuth();
  const tabsVisibles = TABS.filter((t) => !t.secciones || t.secciones.some(tieneSeccion));
  const [params, setParams] = useSearchParams();
  const actual = tabsVisibles.find((t) => t.id === params.get('tab')) || tabsVisibles[0];

  const cambiarTab = (id) => setParams(id === 'perfil' ? {} : { tab: id }, { replace: true });

  return (
    <PageContainer>
      <h1 className={styles.title}>Configuración</h1>

      <div className={styles.tabs}>
        {tabsVisibles.map((t) => (
          <button
            key={t.id}
            className={t.id === actual.id ? styles.tabActive : styles.tab}
            onClick={() => cambiarTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <actual.Componente />
    </PageContainer>
  );
};

export default Configuracion;
