// Mismas extensiones que acepta el backend (EXTENSIONES_PERMITIDAS en documentos/controller.py)
const EXTENSIONES_PERMITIDAS = new Set([
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'csv', 'png', 'jpg', 'jpeg',
]);

// Litestar rechaza peticiones de mas de 10.000.000 bytes; se deja margen para el resto del formulario
const TAMANO_MAXIMO = 9_900_000;

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

/**
 * Recorre lo soltado: crea las carpetas (con crearCarpeta) y devuelve la lista de archivos a subir
 * con su carpeta de destino, respetando la estructura original.
 */
export async function prepararSubida(entradas, destinoId, crearCarpeta) {
  const tareas = [];
  const noPermitidos = [];
  const muyGrandes = [];
  let carpetasCreadas = 0;

  const agregarArchivo = (archivo, carpetaId) => {
    if (archivo.name.startsWith('.')) return; // ocultos del sistema (.DS_Store, etc.)
    if (!EXTENSIONES_PERMITIDAS.has(extensionDe(archivo.name))) noPermitidos.push(archivo.name);
    else if (archivo.size > TAMANO_MAXIMO) muyGrandes.push(archivo.name);
    else tareas.push({ archivo, carpetaId });
  };

  const recorrer = async (entrada, carpetaId) => {
    if (entrada instanceof File) {
      agregarArchivo(entrada, carpetaId);
    } else if (entrada.isFile) {
      agregarArchivo(await archivoDeEntrada(entrada), carpetaId);
    } else if (entrada.isDirectory) {
      const nueva = await crearCarpeta(entrada.name, carpetaId);
      carpetasCreadas += 1;
      for (const hija of await leerCarpeta(entrada)) await recorrer(hija, nueva.id);
    }
  };

  for (const entrada of entradas) await recorrer(entrada, destinoId);
  return { tareas, noPermitidos, muyGrandes, carpetasCreadas };
}
