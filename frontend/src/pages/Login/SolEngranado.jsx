import styles from './SolEngranado.module.css';

// Engranaje planetario: sol de 24 dientes, 4 planetas de 12 y corona de 48.
// Todos comparten paso de diente, asi que girando en proporcion encajan entre si.
const PLANETAS = [[180, 0], [0, 180], [-180, 0], [0, -180]];

const SolEngranado = ({ className = '' }) => (
  <svg viewBox="-300 -300 600 600" aria-hidden="true" className={`${styles.sol} ${className}`}>
    <circle className={styles.halo} r="90" />

    <g transform="rotate(-1.6875)">
      <g className={`${styles.giro} ${styles.corona}`}>
        <circle className={styles.coronaBanda} r="264.5" />
        <circle className={`${styles.diente} ${styles.coronaDientes}`} r="240" />
      </g>
    </g>

    {PLANETAS.map(([x, y]) => (
      <g key={`${x},${y}`} transform={`translate(${x},${y}) rotate(8.25)`}>
        <g className={`${styles.giro} ${styles.planeta}`}>
          <circle className={`${styles.diente} ${styles.planetaDientes}`} r="60" />
          <circle className={styles.planetaDisco} r="51" />
          <circle className={styles.pieza} r="36" />
          <circle className={styles.hueco} r="10" />
        </g>
      </g>
    ))}

    <g transform="rotate(-3.375)">
      <g className={`${styles.giro} ${styles.centro}`}>
        <circle className={`${styles.diente} ${styles.solDientes}`} r="120" />
        <circle className={styles.solDisco} r="111" />
        <circle className={styles.pieza} r="82" />
        <circle className={styles.hueco} cx="58" r="9" />
        <circle className={styles.hueco} cx="-29" cy="50.23" r="9" />
        <circle className={styles.hueco} cx="-29" cy="-50.23" r="9" />
        <circle className={styles.nucleo} r="30" />
        <circle className={styles.hueco} r="10" />
      </g>
    </g>
  </svg>
);

export default SolEngranado;
