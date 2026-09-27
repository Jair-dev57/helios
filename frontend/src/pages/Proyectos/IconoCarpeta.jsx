import { COLOR_CARPETA_DEFECTO } from './coloresCarpeta';

// Carpeta al estilo del Finder: pestaña trasera mas clara y cuerpo con el color de la carpeta
export default function IconoCarpeta({ color, size = 16 }) {
  const c = color || COLOR_CARPETA_DEFECTO;
  return (
    <svg width={size} height={size * 0.8} viewBox="0 0 60 48" aria-hidden="true" style={{ flexShrink: 0 }}>
      <path d="M4 6a4 4 0 0 1 4-4h14l6 6h24a4 4 0 0 1 4 4v4H4Z" fill={c} opacity="0.75" />
      <rect x="2" y="12" width="56" height="34" rx="5" fill={c} />
      <rect x="2" y="12" width="56" height="7" rx="3" fill="#fff" opacity="0.18" />
    </svg>
  );
}
