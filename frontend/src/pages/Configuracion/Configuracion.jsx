import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import PageContainer from '../../components/PageContainer';
import TabPerfil from './TabPerfil';
import TabEmpresa from './TabEmpresa';
import styles from './Configuracion.module.css';

const Configuracion = () => {
  const { tieneSeccion } = useAuth();
  const puedeEmpresa = tieneSeccion('configuracion');
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'empresa' && puedeEmpresa ? 'empresa' : 'perfil';

  const cambiarTab = (nuevo) => setParams(nuevo === 'perfil' ? {} : { tab: nuevo }, { replace: true });

  return (
    <PageContainer>
      <h1 className={styles.title}>Configuración</h1>

      <div className={styles.tabs}>
        <button className={tab === 'perfil' ? styles.tabActive : styles.tab} onClick={() => cambiarTab('perfil')}>
          Mi perfil
        </button>
        {puedeEmpresa && (
          <button className={tab === 'empresa' ? styles.tabActive : styles.tab} onClick={() => cambiarTab('empresa')}>
            Empresa
          </button>
        )}
      </div>

      {tab === 'perfil' && <TabPerfil />}
      {tab === 'empresa' && <TabEmpresa />}
    </PageContainer>
  );
};

export default Configuracion;
