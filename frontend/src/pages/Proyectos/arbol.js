export const compararNombre = (a, b) => a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' });

// Agrupa por una clave (carpeta_padre_id o carpeta_id) y ordena cada grupo por nombre
export function agruparPor(lista, clave) {
  const mapa = new Map();
  for (const item of lista) {
    const k = item[clave];
    if (!mapa.has(k)) mapa.set(k, []);
    mapa.get(k).push(item);
  }
  for (const grupo of mapa.values()) grupo.sort(compararNombre);
  return mapa;
}
