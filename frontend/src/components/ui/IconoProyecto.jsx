import { Star } from 'lucide-react';
import { SALUD, iniciales } from '../../utils/formato';
import { colorProyecto } from '../../utils/coloresCarpeta';
import styles from '../explorador/Explorador.module.css';

/**
 * Un proyecto se ve como una carpeta (la misma silueta que en Archivos) con su color y sus iniciales encima,
 * para distinguirlo de una carpeta comun. El punto de color es su salud y archivado se ve apagado.
 */
export default function IconoProyecto({ proyecto, salud = 'sin', favorito = false, apagado = false, size = 18 }) {
  const c = colorProyecto(proyecto);
  const letras = iniciales(proyecto?.nombre);
  const punto = Math.max(7, Math.round(size / 5));
  // En tamaños chicos las letras van mas grandes (relativas al dibujo) para que se lean
  const tamanoLetra = size < 28 ? (letras.length > 1 ? 21 : 25) : (letras.length > 1 ? 17 : 21);
  return (
    <span className={`${styles.iconoProyecto} ${apagado ? styles.iconoApagado : ''}`} style={{ width: size, height: size * 0.8 }}>
      <svg viewBox="0 0 60 48" aria-hidden="true">
        <path d="M4 6a4 4 0 0 1 4-4h14l6 6h24a4 4 0 0 1 4 4v4H4Z" fill={c} opacity="0.75" />
        <rect x="2" y="12" width="56" height="34" rx="5" fill={c} />
        <rect x="2" y="12" width="56" height="7" rx="3" fill="#fff" opacity="0.18" />
        <text
          x="30"
          y="30.5"
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={tamanoLetra}
          fontWeight="700"
          fill="#fff"
          fontFamily="system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
        >
          {letras}
        </text>
      </svg>
      {salud !== 'sin' && (
        <i className={styles.puntoSalud} style={{ background: SALUD[salud].color, width: punto, height: punto }} />
      )}
      {favorito && <Star className={styles.estrellaIcono} size={Math.max(9, size / 5)} fill="currentColor" />}
    </span>
  );
}
