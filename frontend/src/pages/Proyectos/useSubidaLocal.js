import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { crearCarpeta } from '../../api/carpetas';
import { subirDocumento, subirVersionDocumento, actualizarAccesoDocumento } from '../../api/documentos';
import { analizarSubida, extensionDe, nombreSinExtension, hashDe } from './subidaLocal';

// Subidas a la vez: rapido sin saturar el servidor
const SIMULTANEAS = 3;

const claveRuta = (ruta) => ruta.join('/');

/** Id de la carpeta que ya existe en Helios para cada ruta ('' es el destino). Las que faltan no aparecen. */
function ubicarExistentes(destinoId, rutas, carpetas) {
  const porNombre = new Map(carpetas.map((c) => [`${c.carpeta_padre_id}/${c.nombre}`, c.id]));
  const ids = new Map([['', destinoId]]);
  for (const ruta of rutas) {
    const padre = ids.get(claveRuta(ruta.slice(0, -1)));
    const id = padre === undefined ? undefined : porNombre.get(`${padre}/${ruta.at(-1)}`);
    if (id !== undefined) ids.set(claveRuta(ruta), id);
  }
  return ids;
}

/** Documento con el mismo nombre y tipo en esa carpeta (los nombres se guardan sin extension). */
const existenteEn = (documentos, carpetaId, archivo) => (carpetaId === undefined ? null : documentos.find((d) =>
  d.carpeta_id === carpetaId
  && d.nombre === nombreSinExtension(archivo.name)
  && (d.tipo || '').toLowerCase() === extensionDe(archivo.name)));

/**
 * Subida de archivos y carpetas desde el equipo en dos pasos:
 * preparar() analiza lo elegido y abre la revision; confirmar() crea las carpetas y sube con progreso.
 */
export function useSubidaLocal({ proyectoId, carpetas, documentos, alCrearCarpetas, recargarDocumentos }) {
  // Lo que se va a subir, pendiente de confirmar en el modal de revision
  const [revision, setRevision] = useState(null);
  // Estado del panel de progreso: { titulo, filas, pausada, cancelada, terminada }
  const [subida, setSubida] = useState(null);
  // Control de la subida en curso (no provoca renders): pausa, cancelacion, peticiones activas y reintento
  const control = useRef(null);

  const enCurso = !!subida && !subida.terminada;

  // Avisar antes de cerrar la pestana con una subida a medias
  useEffect(() => {
    if (!enCurso) return undefined;
    const avisar = (e) => e.preventDefault();
    window.addEventListener('beforeunload', avisar);
    return () => window.removeEventListener('beforeunload', avisar);
  }, [enCurso]);

  const actualizarFila = (id, cambios) => setSubida((s) => s && {
    ...s,
    filas: s.filas.map((f) => (f.id === id ? { ...f, ...cambios } : f)),
  });

  /** lectura: { archivos, carpetas } o una promesa de ello (leer carpetas soltadas es asincrono) */
  const preparar = async (destinoId, lectura) => {
    if (enCurso) {
      toast.error('Espera a que termine la subida en curso.');
      return;
    }
    let plan;
    try {
      plan = analizarSubida(await lectura);
    } catch (err) {
      toast.error('No se pudieron leer los archivos.');
      return;
    }
    if (!plan.archivos.length && !plan.carpetas.length) {
      if (plan.omitidos.length) toast.error(`No se puede subir: ${plan.omitidos.map((o) => `${o.ruta} (${o.motivo})`).join(', ')}`, { duration: 6000 });
      return;
    }
    const ids = ubicarExistentes(destinoId, plan.carpetas, carpetas);
    const conflictos = plan.archivos
      .filter(({ archivo, carpetas: ruta }) => existenteEn(documentos, ids.get(claveRuta(ruta)), archivo)).length;
    const raices = new Set(plan.carpetas.filter((r) => r.length === 1).map((r) => r[0]));
    const sueltos = plan.archivos.some((a) => a.carpetas.length === 0);
    const titulo = raices.size === 1 && !sueltos
      ? `«${[...raices][0]}»`
      : `${plan.archivos.length} archivo${plan.archivos.length === 1 ? '' : 's'}`;
    const nuevaRevision = {
      ...plan,
      destinoId,
      titulo,
      conflictos,
      carpetasNuevas: plan.carpetas.filter((r) => !ids.has(claveRuta(r))).length,
    };
    // Archivos sueltos sin nada que decidir: se suben directamente
    if (!plan.carpetas.length && !conflictos && !plan.omitidos.length) confirmar({}, nuevaRevision);
    else setRevision(nuevaRevision);
  };

  const cancelarRevision = () => setRevision(null);

  async function confirmar({ conflicto = 'version', restringir = false }, plan = revision) {
    setRevision(null);
    const { destinoId, archivos, carpetas: rutas, titulo } = plan;
    const ctl = { pausa: null, cancelada: false, peticiones: new Set(), subirFila: null };
    control.current = ctl;
    setSubida({
      titulo,
      filas: archivos.map(({ archivo, carpetas: ruta }, id) => ({
        id, nombre: archivo.name, ruta: claveRuta(ruta), bytes: archivo.size, estado: 'cola', progreso: 0,
      })),
      pausada: false,
      cancelada: false,
      terminada: false,
    });

    // 1. Carpetas: se reutilizan las que ya existen con el mismo nombre (fusionar) y se crean las demas
    const ids = ubicarExistentes(destinoId, rutas, carpetas);
    try {
      for (const ruta of rutas) {
        if (ids.has(claveRuta(ruta))) continue;
        const nueva = await crearCarpeta({
          nombre: ruta.at(-1),
          proyecto_id: proyectoId,
          carpeta_padre_id: ids.get(claveRuta(ruta.slice(0, -1))),
        });
        ids.set(claveRuta(ruta), nueva.id);
      }
    } catch (err) {
      toast.error('No se pudieron crear las carpetas.');
      setSubida((s) => s && { ...s, terminada: true, filas: s.filas.map((f) => ({ ...f, estado: 'cancelado' })) });
      if (rutas.length) alCrearCarpetas(destinoId);
      return;
    }
    if (rutas.length) alCrearCarpetas(destinoId);

    // 2. Archivos. Nombres ocupados por carpeta, para las copias "nombre (2)"
    const ocupados = new Map();
    const nombreLibre = (carpetaId, archivo) => {
      const tipo = extensionDe(archivo.name);
      if (!ocupados.has(carpetaId)) {
        ocupados.set(carpetaId, new Set(documentos
          .filter((d) => d.carpeta_id === carpetaId && (d.tipo || '').toLowerCase() === tipo)
          .map((d) => d.nombre)));
      }
      const usados = ocupados.get(carpetaId);
      const base = nombreSinExtension(archivo.name);
      let nombre = base;
      for (let n = 2; usados.has(nombre); n += 1) nombre = `${base} (${n})`;
      usados.add(nombre);
      return nombre;
    };

    const subirFila = async (id) => {
      const { archivo, carpetas: ruta } = archivos[id];
      const carpetaId = ids.get(claveRuta(ruta));
      const existente = existenteEn(documentos, carpetaId, archivo);
      if (existente && conflicto === 'omitir') {
        actualizarFila(id, { estado: 'omitido' });
        return;
      }
      const peticion = new AbortController();
      ctl.peticiones.add(peticion);
      actualizarFila(id, { estado: 'subiendo', progreso: 0, error: null });
      const config = {
        signal: peticion.signal,
        onUploadProgress: (e) => e.total && actualizarFila(id, { progreso: e.loaded / e.total }),
      };
      try {
        const formData = new FormData();
        formData.append('archivo', archivo);
        if (existente && conflicto === 'version') {
          // Mismo contenido: ni siquiera se envia (el backend tambien lo comprueba)
          if (existente.hash && existente.hash === await hashDe(archivo)) {
            actualizarFila(id, { estado: 'igual', progreso: 1 });
            return;
          }
          const doc = await subirVersionDocumento(existente.id, formData, config);
          actualizarFila(id, { estado: doc.version_actual === existente.version_actual ? 'igual' : 'version', progreso: 1 });
          return;
        }
        formData.append('nombre', existente ? nombreLibre(carpetaId, archivo) : nombreSinExtension(archivo.name));
        formData.append('proyecto_id', proyectoId);
        formData.append('carpeta_id', carpetaId);
        const doc = await subirDocumento(formData, config);
        let error = null;
        if (restringir) {
          try {
            await actualizarAccesoDocumento(doc.id, { restringido: true, usuario_ids: [] });
          } catch (err) {
            error = 'Subido, pero no se pudo restringir';
          }
        }
        actualizarFila(id, { estado: 'listo', progreso: 1, error });
      } catch (err) {
        actualizarFila(id, ctl.cancelada
          ? { estado: 'cancelado' }
          : { estado: 'error', error: err.response?.data?.detail || 'Error de red' });
      } finally {
        ctl.peticiones.delete(peticion);
      }
    };
    ctl.subirFila = subirFila;

    const cola = archivos.map((_, id) => id);
    const trabajador = async () => {
      for (;;) {
        if (ctl.pausa) await ctl.pausa.promesa;
        if (ctl.cancelada || !cola.length) return;
        await subirFila(cola.shift());
      }
    };
    await Promise.all(Array.from({ length: Math.min(SIMULTANEAS, cola.length) }, trabajador));

    setSubida((s) => s && {
      ...s,
      terminada: true,
      pausada: false,
      filas: s.filas.map((f) => (f.estado === 'cola' ? { ...f, estado: 'cancelado' } : f)),
    });
    await recargarDocumentos();
  }

  const pausar = () => {
    const ctl = control.current;
    if (!ctl || ctl.pausa) return;
    let reanudar;
    const promesa = new Promise((resolve) => { reanudar = resolve; });
    ctl.pausa = { promesa, reanudar };
    setSubida((s) => s && { ...s, pausada: true });
  };

  const reanudar = () => {
    const ctl = control.current;
    if (!ctl?.pausa) return;
    ctl.pausa.reanudar();
    ctl.pausa = null;
    setSubida((s) => s && { ...s, pausada: false });
  };

  const cancelar = () => {
    const ctl = control.current;
    if (!ctl) return;
    ctl.cancelada = true;
    ctl.peticiones.forEach((p) => p.abort());
    reanudar();
    setSubida((s) => s && { ...s, cancelada: true });
  };

  const reintentar = async (id) => {
    const ctl = control.current;
    if (!ctl?.subirFila) return;
    await ctl.subirFila(id);
    await recargarDocumentos();
  };

  const cerrar = () => {
    control.current = null;
    setSubida(null);
  };

  return { revision, subida, preparar, confirmar, cancelarRevision, pausar, reanudar, cancelar, reintentar, cerrar };
}
