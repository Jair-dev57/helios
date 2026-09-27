import { Building2 } from 'lucide-react';
import { urlPublica } from '../api/client';
import { useEmpresa } from '../hooks/useEmpresa';
import styles from './MarcaEmpresa.module.css';

// Logo (siempre en circulo) y nombre de la empresa configurados en Configuracion > Empresa
const MarcaEmpresa = ({ tamanoLogo = 32, vertical = false, className = '', classNameNombre = '' }) => {
  const { empresa } = useEmpresa();
  const logo = urlPublica(empresa.logo_url);

  return (
    <div className={`${styles.marca} ${vertical ? styles.vertical : ''} ${className}`}>
      <span className={styles.circulo} style={{ width: tamanoLogo, height: tamanoLogo }}>
        {logo ? <img src={logo} alt="" className={styles.logo} /> : <Building2 size={tamanoLogo * 0.5} />}
      </span>
      {empresa.nombre && <span className={`${styles.nombre} ${classNameNombre}`}>{empresa.nombre}</span>}
    </div>
  );
};

export default MarcaEmpresa;
