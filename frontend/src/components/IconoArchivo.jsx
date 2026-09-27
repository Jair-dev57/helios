import styles from './IconoArchivo.module.css';

// Color por familia de archivo; cualquier extension no listada usa gris
const FAMILIAS = {
  pdf: 'pdf',
  doc: 'word',
  docx: 'word',
  xls: 'excel',
  xlsx: 'excel',
  csv: 'excel',
  ppt: 'powerpoint',
  pptx: 'powerpoint',
  png: 'imagen',
  jpg: 'imagen',
  jpeg: 'imagen',
};

// Hoja con esquina doblada y una franja de color con la extension escrita (XLSX, DOCX, PDF...)
export default function IconoArchivo({ tipo, size = 34 }) {
  const extension = (tipo || '').toLowerCase().replace('.', '');
  const familia = FAMILIAS[extension] || 'otro';
  const texto = (extension || 'file').toUpperCase().slice(0, 4);
  // En tamaños pequeños (arbol lateral) el texto no se lee: solo se deja la franja de color
  const conTexto = size >= 22;

  return (
    <svg
      className={`${styles.icono} ${styles[familia]}`}
      width={(size * 28) / 34}
      height={size}
      viewBox="0 0 28 34"
      role="img"
      aria-label={`Archivo .${extension}`}
    >
      <title>{`.${extension}`}</title>
      <path
        className={styles.hoja}
        d="M4 0.5h14.5L27.5 9.5V30a3.5 3.5 0 0 1-3.5 3.5H4A3.5 3.5 0 0 1 0.5 30V4A3.5 3.5 0 0 1 4 0.5Z"
      />
      <path className={styles.doblez} d="M18.5 0.5V6.5a3 3 0 0 0 3 3h6" />
      <rect className={styles.franja} x="2.5" y="17" width="23" height="11" rx="2" />
      {conTexto && (
        <text className={styles.texto} x="14" y="24.9" textAnchor="middle">
          {texto}
        </text>
      )}
    </svg>
  );
}
