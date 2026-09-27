import { Building2 } from 'lucide-react';
import { urlPublica } from '../api/client';
import { useEmpresa } from '../hooks/useEmpresa';
import styles from './MarcaEmpresa.module.css';

// Logo y nombre de la empresa configurados en Configuracion > Empresa
const MarcaEmpresa = ({ tamanoLogo = 32, className = '', classNameNombre = '' }) => {
  const { empresa } = useEmpresa();
  const logo = urlPublica(empresa.logo_url);

  return (
    <div className={`${styles.marca} ${className}`}>
      {logo ? (
        <img src={logo} alt="" className={styles.logo} style={{ height: tamanoLogo, maxWidth: tamanoLogo * 3 }} />
      ) : (
        <span className={styles.logoVacio} style={{ width: tamanoLogo, height: tamanoLogo }}>
          <Building2 size={tamanoLogo * 0.55} />
        </span>
      )}
      {empresa.nombre && <span className={`${styles.nombre} ${classNameNombre}`}>{empresa.nombre}</span>}
    </div>
  );
};

export default MarcaEmpresa;
