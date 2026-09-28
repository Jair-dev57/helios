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

const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const DIA_MS = 86400000;

// Dias calendario desde hoy hasta la fecha (negativo si ya paso). Las fechas se guardan a medianoche UTC.
export function diasHasta(fechaIso) {
  const [anio, mes, dia] = fechaIso.slice(0, 10).split('-').map(Number);
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  return Math.round((new Date(anio, mes - 1, dia) - hoy) / DIA_MS);
}

export const fechaCorta = (fechaIso) => {
  const [, mes, dia] = fechaIso.slice(0, 10).split('-').map(Number);
  return `${dia} ${MESES[mes - 1]}`;
};

// Vencimiento de una tarea para la tarjeta: { texto, tipo } con tipo 'vencida' | 'hoy' | 'normal'.
// La fecha se guarda como medianoche UTC, asi que se compara solo el dia calendario.
export function vencimientoTarea(fechaIso, terminada = false) {
  if (!fechaIso) return null;
  const [anio, mes, dia] = fechaIso.slice(0, 10).split('-').map(Number);
  const fecha = new Date(anio, mes - 1, dia);
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const dias = Math.round((fecha - hoy) / DIA_MS);
  // Esta semana: "Vie 3 oct"; mas lejos: "14 oct" (con año si no es el actual)
  const diaMes = `${fecha.getDate()} ${MESES[fecha.getMonth()]}`;
  const anioTexto = fecha.getFullYear() !== hoy.getFullYear() ? ` ${fecha.getFullYear()}` : '';
  const texto = dias > 0 && dias < 7 ? `${DIAS[fecha.getDay()]} ${diaMes}` : `${diaMes}${anioTexto}`;

  if (terminada) return { texto, tipo: 'normal' };
  if (dias < 0) {
    return { texto: dias === -1 ? 'Vencida ayer' : `Vencida hace ${-dias} días`, tipo: 'vencida' };
  }
  if (dias === 0) return { texto: 'Hoy', tipo: 'hoy' };
  if (dias === 1) return { texto: 'Mañana', tipo: 'normal' };
  return { texto, tipo: 'normal' };
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

// Colores para el circulo del cliente, elegidos por id para que cada cliente conserve el suyo en toda la app
const COLORES_CLIENTE = ['#6D5BD0', '#2E8C8C', '#C0612E', '#B0457A', '#3D7FC0', '#8C6D2E', '#3A9A5B'];
export const colorCliente = (id) => COLORES_CLIENTE[(id || 0) % COLORES_CLIENTE.length];

export const iniciales = (texto) =>
  (texto || '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('');

export const colorAvance = (v) =>
  v >= 100 ? 'var(--info)' : v >= 60 ? 'var(--success)' : v >= 25 ? 'var(--accent)' : 'var(--warning)';

// Texto y tono de la entrega de un proyecto: tipo '' | 'pronto' | 'vencida' | 'sin'
export function entregaProyecto(proyecto) {
  if (proyecto.estado === 'completado') return { texto: 'Completado', tipo: '' };
  if (!proyecto.fecha_vencimiento) return { texto: 'Sin fecha', tipo: 'sin' };
  const dias = diasHasta(proyecto.fecha_vencimiento);
  const fecha = fechaCorta(proyecto.fecha_vencimiento);
  if (dias < 0) return { texto: `Vencido hace ${-dias} ${-dias === 1 ? 'día' : 'días'}`, tipo: 'vencida' };
  if (dias === 0) return { texto: 'Entrega hoy', tipo: 'pronto' };
  if (dias === 1) return { texto: 'Entrega mañana', tipo: 'pronto' };
  if (dias <= 7) return { texto: `Vence en ${dias} días`, tipo: 'pronto' };
  return { texto: `${fecha} · en ${dias} días`, tipo: '' };
}
