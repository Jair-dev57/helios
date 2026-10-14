import { Star } from 'lucide-react';
import IconoCarpeta from './IconoCarpeta';
import { SALUD } from './formato';
import styles from '../../components/Explorador.module.css';

/** Un proyecto se ve como una carpeta del sistema, neutra; el punto de color es su salud y archivado se ve apagado */
export default function IconoProyecto({ salud = 'sin', favorito = false, apagado = false, size = 18 }) {
  const punto = Math.max(7, Math.round(size / 5));
  return (
    <span className={`${styles.iconoProyecto} ${apagado ? styles.iconoApagado : ''}`} style={{ width: size, height: size * 0.8 }}>
      <IconoCarpeta color="var(--carpeta-proyecto)" size={size} />
      {salud !== 'sin' && (
        <i className={styles.puntoSalud} style={{ background: SALUD[salud].color, width: punto, height: punto }} />
      )}
      {favorito && <Star className={styles.estrellaIcono} size={Math.max(9, size / 5)} fill="currentColor" />}
    </span>
  );
}
