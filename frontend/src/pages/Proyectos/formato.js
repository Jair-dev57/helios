const formatoFecha = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });
const formatoFechaHora = new Intl.DateTimeFormat('es-CO', { dateStyle: 'long', timeStyle: 'short' });
const formatoRelativo = new Intl.RelativeTimeFormat('es', { numeric: 'auto' });

// "hace 5 minutos", "ayer", "hace 3 días"; pasada una semana, la fecha corta
export function fechaRelativa(fechaIso) {
  if (!fechaIso) return '—';
  const segundos = (new Date(fechaIso) - Date.now()) / 1000;
  const abs = Math.abs(segundos);
  if (abs < 60) return 'hace un momento';
  if (abs < 3600) return formatoRelativo.format(Math.round(segundos / 60), 'minute');
  if (abs < 86400) return formatoRelativo.format(Math.round(segundos / 3600), 'hour');
  if (abs < 7 * 86400) return formatoRelativo.format(Math.round(segundos / 86400), 'day');
  return formatoFecha.format(new Date(fechaIso));
}

export const fechaCompleta = (fechaIso) => (fechaIso ? formatoFechaHora.format(new Date(fechaIso)) : undefined);

export function formatoTamano(bytes) {
  if (bytes == null) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const CLASES = {
  pdf: 'Documento PDF',
  doc: 'Documento de Word',
  docx: 'Documento de Word',
  xls: 'Hoja de cálculo Excel',
  xlsx: 'Hoja de cálculo Excel',
  csv: 'Valores separados por comas',
  ppt: 'Presentación',
  pptx: 'Presentación',
  png: 'Imagen PNG',
  jpg: 'Imagen JPEG',
  jpeg: 'Imagen JPEG',
  txt: 'Texto',
};

// Tipo en lenguaje normal, como la columna "Clase" del Finder
export const claseArchivo = (tipo) => CLASES[(tipo || '').toLowerCase()] || `Archivo ${(tipo || '').toUpperCase()}`;
