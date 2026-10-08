// Mismas extensiones que acepta el backend (EXTENSIONES_PERMITIDAS en documentos/controller.py)
const EXTENSIONES_PERMITIDAS = new Set([
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'csv', 'png', 'jpg', 'jpeg',
]);

// Litestar rechaza peticiones de mas de 10.000.000 bytes; se deja margen para el resto del formulario
const TAMANO_MAXIMO = 9_900_000;

// Ocultos y archivos que crea el sistema operativo: no se suben ni se avisan (.git, .DS_Store, Thumbs.db...)
const DEL_SISTEMA = new Set(['thumbs.db', 'desktop.ini']);
const esOculto = (nombre) => nombre.startsWith('.') || DEL_SISTEMA.has(nombre.toLowerCase());

export const extensionDe = (nombre) => {
  const i = nombre.lastIndexOf('.');
  return i > 0 ? nombre.slice(i + 1).toLowerCase() : '';
};

export const nombreSinExtension = (nombre) => {
  const i = nombre.lastIndexOf('.');
  return i > 0 ? nombre.slice(0, i) : nombre;
};

// Lee todas las entradas de una carpeta (el navegador las entrega por lotes)
function leerCarpeta(entrada) {
  return new Promise((resolve, reject) => {
    const lector = entrada.createReader();
    const todas = [];
    const leerLote = () => {
      lector.readEntries((lote) => {
        if (lote.length === 0) resolve(todas);
        else {
          todas.push(...lote);
          leerLote();
        }
      }, reject);
    };
    leerLote();
  });
}

const archivoDeEntrada = (entrada) => new Promise((resolve, reject) => entrada.file(resolve, reject));

/**
 * Extrae lo soltado en el evento drop. Debe llamarse dentro del evento: despues el navegador
 * ya no deja leer dataTransfer. Devuelve entradas del sistema de archivos (permiten carpetas)
 * o, si el navegador no las soporta, los File sueltos.
 */
export function entradasDelDrop(dataTransfer) {
  const items = [...(dataTransfer.items || [])].filter((i) => i.kind === 'file');
  const entradas = items.map((i) => i.webkitGetAsEntry?.()).filter(Boolean);
  if (entradas.length) return entradas;
  return [...(dataTransfer.files || [])];
}

/*
 * Una lectura es { archivos: [{ archivo, carpetas }], carpetas: [ruta] }, donde cada ruta es la lista
 * de nombres de carpeta desde el destino (['Entrega', 'Planos']). Las carpetas van de padres a hijas.
 */

/** Lectura de lo soltado: recorre las carpetas (tambien las vacias) respetando la estructura. */
export async function leerEntradas(entradas) {
  const archivos = [];
  const carpetas = [];
  const recorrer = async (entrada, ruta) => {
    if (esOculto(entrada.name)) return;
    if (entrada instanceof File) {
      archivos.push({ archivo: entrada, carpetas: ruta });
    } else if (entrada.isFile) {
      archivos.push({ archivo: await archivoDeEntrada(entrada), carpetas: ruta });
    } else if (entrada.isDirectory) {
      const propia = [...ruta, entrada.name];
      carpetas.push(propia);
      for (const hija of await leerCarpeta(entrada)) await recorrer(hija, propia);
    }
  };
  for (const entrada of entradas) await recorrer(entrada, []);
  return { archivos, carpetas };
}

/** Lectura del selector de archivos. Con webkitdirectory cada File trae su ruta ("Entrega/Planos/a.pdf"). */
export function leerSelector(lista) {
  const archivos = [];
  const carpetas = new Map();
  for (const archivo of lista) {
    const partes = (archivo.webkitRelativePath || archivo.name).split('/');
    if (partes.some(esOculto)) continue;
    const ruta = partes.slice(0, -1);
    for (let i = 1; i <= ruta.length; i += 1) {
      const clave = ruta.slice(0, i).join('/');
      if (!carpetas.has(clave)) carpetas.set(clave, ruta.slice(0, i));
    }
    archivos.push({ archivo, carpetas: ruta });
  }
  return { archivos, carpetas: [...carpetas.values()] };
}

/** Separa lo que se puede subir de lo que se omite (tipo no permitido o demasiado grande). */
export function analizarSubida({ archivos, carpetas }) {
  const validos = [];
  const omitidos = [];
  for (const item of archivos) {
    const { archivo } = item;
    const ruta = [...item.carpetas, archivo.name].join('/');
    if (!EXTENSIONES_PERMITIDAS.has(extensionDe(archivo.name))) omitidos.push({ ruta, motivo: 'tipo no permitido' });
    else if (archivo.size > TAMANO_MAXIMO) omitidos.push({ ruta, motivo: 'supera 10 MB' });
    else validos.push(item);
  }
  const totalBytes = validos.reduce((suma, { archivo }) => suma + archivo.size, 0);
  return { archivos: validos, omitidos, carpetas, totalBytes };
}

/** SHA-256 en hexadecimal, igual que el backend. null si el navegador no lo permite (solo https o localhost). */
export async function hashDe(archivo) {
  if (!globalThis.crypto?.subtle) return null;
  const resumen = await crypto.subtle.digest('SHA-256', await archivo.arrayBuffer());
  return [...new Uint8Array(resumen)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
