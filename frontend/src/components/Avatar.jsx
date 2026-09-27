import { urlPublica } from '../api/client';
import styles from './Avatar.module.css';

// Foto de perfil del usuario, o su inicial si no tiene
const Avatar = ({ usuario, size = 32, className = '' }) => {
  const src = urlPublica(usuario?.avatar_url);
  const inicial = usuario?.nombre?.[0]?.toUpperCase() || '?';

  return (
    <span
      className={`${styles.avatar} ${className}`}
      style={{ width: size, height: size, fontSize: size * 0.42 }}
    >
      {src ? <img src={src} alt={usuario?.nombre || ''} className={styles.imagen} /> : inicial}
    </span>
  );
};

export default Avatar;
