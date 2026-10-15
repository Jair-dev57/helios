import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import PageContainer from '../../components/PageContainer';
import TabPerfil from './TabPerfil';
import TabEmpresa from './TabEmpresa';
import TabUsuarios from './TabUsuarios';
import TabEquipos from './TabEquipos';
import styles from './Configuracion.module.css';

// `secciones` = permisos del rol que habilitan la pestaña (Mi perfil es para todos)
const TABS = [
  { id: 'perfil', label: 'Mi perfil', Componente: TabPerfil },
  { id: 'empresa', label: 'Empresa', Componente: TabEmpresa, secciones: ['configuracion'] },
  { id: 'personas', label: 'Personas', Componente: TabUsuarios, secciones: ['usuarios'] },
  { id: 'equipos', label: 'Equipos', Componente: TabEquipos, secciones: ['roles'] },
];

const Configuracion = () => {
  const { tieneSeccion } = useAuth();
  const tabsVisibles = TABS.filter((t) => !t.secciones || t.secciones.some(tieneSeccion));
  const [params, setParams] = useSearchParams();
  const actual = tabsVisibles.find((t) => t.id === params.get('tab')) || tabsVisibles[0];

  const cambiarTab = (id) => setParams(id === 'perfil' ? {} : { tab: id }, { replace: true });

  return (
    <PageContainer wide>
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
