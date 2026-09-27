import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronLeft, ChevronRight, LayoutGrid, List, Columns3, Search, FolderPlus, Sparkles,
} from 'lucide-react';
import { buscarEnDocumentos } from '../../api/documentos';
import IconoArchivo from '../../components/IconoArchivo';
import IconoCarpeta from './IconoCarpeta';
import { COLORES_CARPETA } from './coloresCarpeta';
import { fechaRelativa, fechaCompleta, formatoTamano, claseArchivo } from './formato';
import { entradasDelDrop } from './subidaArrastre';
import styles from './ExploradorArchivos.module.css';

const VISTAS = [
  { id: 'iconos', nombre: 'Iconos', Icono: LayoutGrid },
  { id: 'lista', nombre: 'Lista', Icono: List },
  { id: 'columnas', nombre: 'Columnas', Icono: Columns3 },
];
const CLAVE_VISTA = 'helios.vistaArchivos';

function leerVista() {
  try {
    const v = localStorage.getItem(CLAVE_VISTA);
    return VISTAS.some((x) => x.id === v) ? v : 'lista';
  } catch {
    return 'lista';
  }
}

// Cada elemento se identifica como "c:<id>" (carpeta) o "a:<id>" (archivo)
const claveCarpeta = (id) => `c:${id}`;
const claveArchivo = (id) => `a:${id}`;

// A partir de este largo, ademas de filtrar por nombre, se busca dentro del contenido con IA
const MIN_BUSQUEDA_CONTENIDO = 3;

// Resalta en el fragmento las palabras buscadas
function Resaltado({ texto, consulta }) {
  const palabras = consulta.toLowerCase().split(/\s+/).filter((p) => p.length > 2)
    .map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  if (!palabras.length) return texto;
  const partes = texto.split(new RegExp(`(${palabras.join('|')})`, 'gi'));
  return partes.map((parte, i) => (i % 2 ? <mark key={i}>{parte}</mark> : parte));
}

function InputRenombrar({ valorInicial, onGuardar, onCancelar }) {
  const ref = useRef(null);
  const terminado = useRef(false);
  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);
  const terminar = (guardar) => {
    if (terminado.current) return;
    terminado.current = true;
    const valor = ref.current.value.trim();
    if (guardar && valor && valor !== valorInicial) onGuardar(valor);
    else onCancelar();
  };
  return (
    <input
      ref={ref}
      className={styles.renombrar}
      defaultValue={valorInicial}
      aria-label="Nuevo nombre"
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === 'Enter') terminar(true);
        if (e.key === 'Escape') terminar(false);
      }}
      onBlur={() => terminar(true)}
    />
  );
}

/**
 * Explorador de archivos al estilo del Finder: vistas de iconos, lista y columnas,
 * atajos de teclado y menu contextual. Cada archivo aparece solo dentro de su carpeta (carpeta_id).
 */
export default function ExploradorArchivos({
  proyectoId,
  carpetaId,
  arbol,
  carpetasPorId,
  docActivoId,
  compacto,
  atajosActivos,
  navegacion,
  acciones,
}) {
  const [vista, setVista] = useState(leerVista);
  const [seleccion, setSeleccion] = useState(null);
  const [renombrando, setRenombrando] = useState(null);
  const [abiertas, setAbiertas] = useState(new Set());
  const [busqueda, setBusqueda] = useState('');
  // Resultados de la busqueda dentro del contenido: { consulta, resultados, cargando, error }
  const [contenido, setContenido] = useState(null);
  const [menu, setMenu] = useState(null);
  // Carpeta sobre la que se esta arrastrando algo desde el equipo (null = no se arrastra)
  const [destinoArrastre, setDestinoArrastre] = useState(null);
  const vistaRef = useRef(null);

  const hijosDe = (id) => arbol.hijos.get(id) || [];
  const archivosDe = (id) => arbol.docs.get(id) || [];

  useEffect(() => {
    setSeleccion(null);
    setBusqueda('');
    setMenu(null);
  }, [carpetaId]);

  // Busqueda en el contenido de los archivos, con espera para no llamar en cada tecla
  const consulta = busqueda.trim();
  useEffect(() => {
    if (consulta.length < MIN_BUSQUEDA_CONTENIDO || !proyectoId) {
      setContenido(null);
      return undefined;
    }
    setContenido((prev) => ({ consulta, resultados: prev?.resultados || [], cargando: true, error: false }));
    const control = new AbortController();
    const espera = setTimeout(async () => {
      try {
        const resultados = await buscarEnDocumentos(proyectoId, consulta, carpetaId, control.signal);
        setContenido({ consulta, resultados, cargando: false, error: false });
      } catch (err) {
        if (err.name !== 'CanceledError') setContenido({ consulta, resultados: [], cargando: false, error: true });
      }
    }, 400);
    return () => { clearTimeout(espera); control.abort(); };
  }, [consulta, proyectoId, carpetaId]);

  const cambiarVista = (v) => {
    setVista(v);
    try { localStorage.setItem(CLAVE_VISTA, v); } catch { /* sin almacenamiento: solo dura la sesion */ }
  };

  // Resumen de cada carpeta contando subcarpetas: numero de archivos, peso y ultima modificacion
  const resumen = useMemo(() => {
    const cache = new Map();
    const calcular = (id) => {
      if (cache.has(id)) return cache.get(id);
      const r = { elementos: 0, bytes: 0, ultima: null };
      for (const d of arbol.docs.get(id) || []) {
        r.elementos += 1;
        r.bytes += d.tamano || 0;
        if (!r.ultima || d.updated_at > r.ultima) r.ultima = d.updated_at;
      }
      for (const h of arbol.hijos.get(id) || []) {
        const rh = calcular(h.id);
        r.elementos += 1 + rh.elementos;
        r.bytes += rh.bytes;
        if (rh.ultima && (!r.ultima || rh.ultima > r.ultima)) r.ultima = rh.ultima;
      }
      cache.set(id, r);
      return r;
    };
    for (const c of carpetasPorId.values()) calcular(c.id);
    return cache;
  }, [arbol, carpetasPorId]);

  const ruta = useMemo(() => {
    const r = [];
    let actual = carpetasPorId.get(carpetaId);
    while (actual) {
      r.unshift(actual);
      actual = carpetasPorId.get(actual.carpeta_padre_id);
    }
    return r;
  }, [carpetasPorId, carpetaId]);

  // Filas visibles en orden (sirve para lista, iconos y navegacion con flechas)
  const filas = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    const resultado = [];
    if (texto) {
      const porContenido = new Map((contenido?.resultados || []).map((r) => [r.documento_id, r]));
      // Busqueda en esta carpeta y todas sus subcarpetas
      const recorrer = (id) => {
        for (const c of arbol.hijos.get(id) || []) {
          if (c.nombre.toLowerCase().includes(texto)) resultado.push({ tipo: 'carpeta', item: c, nivel: 0 });
          recorrer(c.id);
        }
        for (const d of arbol.docs.get(id) || []) {
          if (d.nombre.toLowerCase().includes(texto)) {
            resultado.push({ tipo: 'archivo', item: d, nivel: 0, coincide: porContenido.get(d.id) });
            porContenido.delete(d.id);
          }
        }
      };
      recorrer(carpetaId);
      // Despues de las coincidencias por nombre, los archivos que tienen lo buscado dentro (ya vienen ordenados)
      if (porContenido.size) {
        const docsPorId = new Map();
        for (const docs of arbol.docs.values()) for (const d of docs) docsPorId.set(d.id, d);
        for (const r of porContenido.values()) {
          const d = docsPorId.get(r.documento_id);
          if (d) resultado.push({ tipo: 'archivo', item: d, nivel: 0, coincide: r });
        }
      }
      return resultado;
    }
    const recorrer = (id, nivel) => {
      for (const c of arbol.hijos.get(id) || []) {
        resultado.push({ tipo: 'carpeta', item: c, nivel });
        if (vista === 'lista' && abiertas.has(c.id)) recorrer(c.id, nivel + 1);
      }
      for (const d of arbol.docs.get(id) || []) resultado.push({ tipo: 'archivo', item: d, nivel });
    };
    recorrer(carpetaId, 0);
    return resultado;
  }, [arbol, carpetaId, busqueda, vista, abiertas, contenido]);

  const claveDe = (f) => (f.tipo === 'carpeta' ? claveCarpeta(f.item.id) : claveArchivo(f.item.id));
  const buscarPorClave = (clave) => {
    if (!clave) return null;
    const [t, id] = clave.split(':');
    if (t === 'c') return { tipo: 'carpeta', item: carpetasPorId.get(+id) };
    for (const docs of arbol.docs.values()) {
      const d = docs.find((x) => x.id === +id);
      if (d) return { tipo: 'archivo', item: d };
    }
    return null;
  };

  const abrir = (clave) => {
    const el = buscarPorClave(clave);
    if (!el?.item) return;
    if (el.tipo === 'carpeta') navegacion.entrar(el.item.id);
    else acciones.ver(el.item);
  };

  const crearCarpeta = async (padreId = carpetaId) => {
    const nueva = await acciones.crearCarpeta(padreId);
    if (!nueva) return;
    if (padreId !== carpetaId) setAbiertas((prev) => new Set(prev).add(padreId));
    setSeleccion(claveCarpeta(nueva.id));
    setRenombrando(claveCarpeta(nueva.id));
  };

  const guardarNombre = async (clave, nombre) => {
    setRenombrando(null);
    const [t, id] = clave.split(':');
    await acciones.renombrar(t === 'c' ? 'carpeta' : 'archivo', +id, nombre);
    vistaRef.current?.focus();
  };

  const eliminar = (clave) => {
    const el = buscarPorClave(clave);
    if (!el?.item) return;
    if (el.tipo === 'carpeta') acciones.eliminarCarpeta(el.item.id);
    else acciones.eliminarArchivo(el.item.id);
  };

  // Atajos de teclado estilo Finder
  useEffect(() => {
    if (!atajosActivos) return undefined;
    const onKey = (e) => {
      const enCampo = e.target.closest?.('input, textarea, select, [contenteditable="true"]');
      const tecla = e.key.toLowerCase();
      // Ctrl+Shift+N (Chrome lo reserva para incognito; ahi funciona Alt+Shift+N)
      if (e.shiftKey && (e.ctrlKey || e.metaKey || e.altKey) && tecla === 'n') {
        e.preventDefault();
        crearCarpeta();
        return;
      }
      if (enCampo || renombrando) return;
      if (e.altKey && e.key === 'ArrowLeft') { e.preventDefault(); navegacion.atras(); return; }
      if (e.altKey && e.key === 'ArrowRight') { e.preventDefault(); navegacion.adelante(); return; }
      if (e.key === 'Escape') { setMenu(null); setSeleccion(null); return; }
      if (!seleccion) {
        if ((e.key === 'ArrowDown' || e.key === 'ArrowRight') && filas.length && vista !== 'columnas') {
          e.preventDefault();
          setSeleccion(claveDe(filas[0]));
        }
        return;
      }
      if (e.key === ' ') {
        const el = buscarPorClave(seleccion);
        if (el?.tipo === 'archivo') {
          e.preventDefault();
          if (docActivoId === el.item.id) acciones.cerrarVisor();
          else acciones.ver(el.item);
        }
        return;
      }
      if (e.key === 'Enter') { e.preventDefault(); abrir(seleccion); return; }
      if (e.key === 'F2') { e.preventDefault(); setRenombrando(seleccion); return; }
      if (e.key === 'Delete') { e.preventDefault(); eliminar(seleccion); return; }
      const paso = { ArrowDown: 1, ArrowUp: -1, ...(vista === 'iconos' ? { ArrowRight: 1, ArrowLeft: -1 } : {}) }[e.key];
      if (paso && vista !== 'columnas') {
        e.preventDefault();
        const i = filas.findIndex((f) => claveDe(f) === seleccion);
        const siguiente = filas[Math.min(filas.length - 1, Math.max(0, i + paso))];
        if (siguiente) setSeleccion(claveDe(siguiente));
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });

  // Cerrar el menu contextual al hacer clic fuera o al desplazarse
  useEffect(() => {
    if (!menu) return undefined;
    const cerrar = () => setMenu(null);
    document.addEventListener('click', cerrar);
    window.addEventListener('scroll', cerrar, true);
    return () => {
      document.removeEventListener('click', cerrar);
      window.removeEventListener('scroll', cerrar, true);
    };
  }, [menu]);

  const abrirMenu = (e, clave) => {
    e.preventDefault();
    e.stopPropagation();
    if (clave) setSeleccion(clave);
    setMenu({ x: Math.min(e.clientX, window.innerWidth - 240), y: Math.min(e.clientY, window.innerHeight - 320), clave });
  };

  const alternarAbierta = (id) => {
    setAbiertas((prev) => {
      const nuevo = new Set(prev);
      if (nuevo.has(id)) nuevo.delete(id);
      else nuevo.add(id);
      return nuevo;
    });
  };

  // ---------- Arrastrar y soltar desde el equipo ----------
  const traeArchivos = (e) => [...(e.dataTransfer?.types || [])].includes('Files');
  const destinoDe = (e) => {
    const el = e.target.closest?.('[data-carpeta]');
    return el ? +el.dataset.carpeta : carpetaId;
  };
  const alArrastrarEncima = (e) => {
    if (!traeArchivos(e)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    const destino = destinoDe(e);
    if (destino !== destinoArrastre) setDestinoArrastre(destino);
  };
  const alSalir = (e) => {
    if (!e.currentTarget.contains(e.relatedTarget)) setDestinoArrastre(null);
  };
  const alSoltar = (e) => {
    if (!traeArchivos(e)) return;
    e.preventDefault();
    const destino = destinoDe(e);
    const entradas = entradasDelDrop(e.dataTransfer);
    setDestinoArrastre(null);
    if (entradas.length) acciones.soltarArchivos(destino, entradas);
  };
  const nombreDestino = carpetasPorId.get(destinoArrastre)?.nombre;

  const props = (clave) => ({
    'data-sel': seleccion === clave || undefined,
    ...(clave.startsWith('c:') && {
      'data-carpeta': clave.slice(2),
      'data-destino': (destinoArrastre === +clave.slice(2) && destinoArrastre !== carpetaId) || undefined,
    }),
    onClick: (e) => { e.stopPropagation(); setSeleccion(clave); },
    onDoubleClick: () => abrir(clave),
    onContextMenu: (e) => abrirMenu(e, clave),
  });

  const nombreOInput = (clave, nombre, clase) =>
    renombrando === clave ? (
      <InputRenombrar
        valorInicial={nombre}
        onGuardar={(v) => guardarNombre(clave, v)}
        onCancelar={() => { setRenombrando(null); vistaRef.current?.focus(); }}
      />
    ) : (
      <span className={clase}>{nombre}</span>
    );

  const buscandoContenido = contenido?.cargando;
  const vacioTexto = busqueda
    ? (buscandoContenido ? 'Buscando también dentro de los archivos…' : 'Sin resultados en esta carpeta.')
    : 'Carpeta vacía. Arrastra archivos aquí o crea una carpeta con Ctrl+Shift+N.';

  // ---------- Vistas ----------
  const renderIconos = () => (
    filas.length === 0 ? <p className={styles.vacio}>{vacioTexto}</p> : (
      <div className={styles.cuadricula}>
        {filas.map((f) => {
          const clave = claveDe(f);
          const esCarpeta = f.tipo === 'carpeta';
          return (
            <div key={clave} className={styles.tarjeta} {...props(clave)} title={esCarpeta ? f.item.nombre : `${f.item.nombre}.${f.item.tipo}${f.coincide ? `\n\n${f.coincide.fragmento}` : ''}`}>
              {esCarpeta ? <IconoCarpeta color={f.item.color} size={64} /> : <IconoArchivo tipo={f.item.tipo} size={56} />}
              {nombreOInput(clave, f.item.nombre, styles.etiqueta)}
              <span className={styles.subEtiqueta}>
                {esCarpeta ? `${resumen.get(f.item.id)?.elementos ?? 0} elementos` : formatoTamano(f.item.tamano)}
              </span>
            </div>
          );
        })}
      </div>
    )
  );

  const renderLista = () => (
    <table className={`${styles.lista} ${compacto ? styles.listaCompacta : ''}`}>
      <colgroup>
        <col className={styles.cNombre} />
        <col className={styles.cModificado} />
        {!compacto && <col className={styles.cPor} />}
        {!compacto && <col className={styles.cTamano} />}
        {!compacto && <col className={styles.cTipo} />}
      </colgroup>
      <thead>
        <tr>
          <th>Nombre</th>
          <th>Modificado</th>
          {!compacto && <th>Por</th>}
          {!compacto && <th>Tamaño</th>}
          {!compacto && <th>Tipo</th>}
        </tr>
      </thead>
      <tbody>
        {filas.length === 0 && (
          <tr><td colSpan={compacto ? 2 : 5} className={styles.vacio}>{vacioTexto}</td></tr>
        )}
        {filas.map((f) => {
          const clave = claveDe(f);
          const esCarpeta = f.tipo === 'carpeta';
          const r = esCarpeta ? resumen.get(f.item.id) : null;
          const abierta = esCarpeta && abiertas.has(f.item.id);
          const fecha = esCarpeta ? r?.ultima : f.item.updated_at;
          return (
            <tr key={clave} {...props(clave)} data-activo={!esCarpeta && docActivoId === f.item.id || undefined}>
              <td>
                <div className={styles.celdaNombre} style={{ paddingLeft: `${f.nivel * 20}px` }}>
                  {esCarpeta && !busqueda ? (
                    <button
                      className={`${styles.triangulo} ${abierta ? styles.trianguloAbierto : ''}`}
                      onClick={(e) => { e.stopPropagation(); alternarAbierta(f.item.id); }}
                      aria-label={abierta ? 'Contraer' : 'Desplegar'}
                    >
                      <ChevronRight size={13} strokeWidth={2.6} />
                    </button>
                  ) : (
                    <span className={styles.trianguloEspacio} />
                  )}
                  {esCarpeta ? <IconoCarpeta color={f.item.color} size={18} /> : <IconoArchivo tipo={f.item.tipo} size={18} />}
                  {nombreOInput(clave, f.item.nombre, styles.nombre)}
                  {!esCarpeta && f.item.version_actual > 1 && <span className={styles.version}>v{f.item.version_actual}</span>}
                </div>
                {f.coincide && (
                  <p className={styles.fragmento} title={f.coincide.fragmento}>
                    <Resaltado texto={f.coincide.fragmento} consulta={contenido.consulta} />
                  </p>
                )}
              </td>
              <td title={fechaCompleta(fecha)}>{fechaRelativa(fecha)}</td>
              {!compacto && (
                <>
                  <td>{esCarpeta ? '—' : f.item.modificado_por || '—'}</td>
                  <td>{esCarpeta ? `${r?.elementos ?? 0} elementos` : formatoTamano(f.item.tamano)}</td>
                  <td>{esCarpeta ? 'Carpeta' : claseArchivo(f.item.tipo)}</td>
                </>
              )}
            </tr>
          );
        })}
      </tbody>
    </table>
  );

  const renderColumnas = () => {
    // Una columna por nivel de la ruta; al final, la ficha del archivo seleccionado
    const columnas = [{ items: arbol.hijos.get(null) || [], docs: [], activa: ruta[0]?.id }];
    ruta.forEach((c, i) => columnas.push({ items: hijosDe(c.id), docs: archivosDe(c.id), activa: ruta[i + 1]?.id }));
    const elegido = buscarPorClave(seleccion);
    const archivo = elegido?.tipo === 'archivo' ? elegido.item : null;
    return (
      <div className={styles.columnas}>
        {columnas.map((col, i) => (
          <div key={i} className={styles.columna}>
            {col.items.length + col.docs.length === 0 && <p className={styles.vacioColumna}>Vacía</p>}
            {col.items.map((c) => {
              const clave = claveCarpeta(c.id);
              return (
                <div
                  key={clave}
                  className={`${styles.filaColumna} ${c.id === col.activa ? styles.enRuta : ''}`}
                  {...props(clave)}
                  onClick={(e) => { e.stopPropagation(); navegacion.entrar(c.id); }}
                >
                  <IconoCarpeta color={c.color} size={18} />
                  {nombreOInput(clave, c.nombre, styles.nombre)}
                  <ChevronRight size={13} className={styles.flechaColumna} />
                </div>
              );
            })}
            {col.docs.map((d) => {
              const clave = claveArchivo(d.id);
              return (
                <div key={clave} className={styles.filaColumna} {...props(clave)}>
                  <IconoArchivo tipo={d.tipo} size={17} />
                  {nombreOInput(clave, d.nombre, styles.nombre)}
                </div>
              );
            })}
          </div>
        ))}
        {archivo && (
          <div className={styles.ficha}>
            <IconoArchivo tipo={archivo.tipo} size={96} />
            <h3>{archivo.nombre}.{archivo.tipo}</h3>
            <button className={styles.boton} onClick={() => acciones.ver(archivo)}>
              Vista rápida <kbd>Espacio</kbd>
            </button>
            <dl>
              <dt>Tipo</dt><dd>{claseArchivo(archivo.tipo)}</dd>
              <dt>Tamaño</dt><dd>{formatoTamano(archivo.tamano)}</dd>
              <dt>Modificado</dt><dd title={fechaCompleta(archivo.updated_at)}>{fechaRelativa(archivo.updated_at)}</dd>
              <dt>Por</dt><dd>{archivo.modificado_por || '—'}</dd>
              <dt>Versión</dt><dd>v{archivo.version_actual}</dd>
              <dt>Ubicación</dt><dd>{ruta.map((c) => c.nombre).join(' / ')}</dd>
            </dl>
          </div>
        )}
      </div>
    );
  };

  // ---------- Menu contextual ----------
  const renderMenu = () => {
    const el = buscarPorClave(menu.clave);
    const esCarpeta = el?.tipo === 'carpeta';
    const esArchivo = el?.tipo === 'archivo';
    const destino = esCarpeta ? el.item.id : carpetaId;
    const hacer = (fn) => (e) => { e.stopPropagation(); setMenu(null); fn(); };
    return (
      <div className={styles.menu} style={{ left: menu.x, top: menu.y }} role="menu" onClick={(e) => e.stopPropagation()}>
        {el && (
          <>
            <button role="menuitem" onClick={hacer(() => abrir(menu.clave))}>
              {esCarpeta ? 'Abrir' : 'Vista rápida'}<span>{esCarpeta ? 'Doble clic' : 'Espacio'}</span>
            </button>
            <button role="menuitem" onClick={hacer(() => setRenombrando(menu.clave))}>Renombrar<span>F2</span></button>
            {esArchivo && (
              <button role="menuitem" onClick={hacer(() => acciones.nuevaVersion(el.item.id))}>Subir nueva versión</button>
            )}
            {esCarpeta && (
              <div className={styles.menuColores} aria-label="Color de la carpeta">
                {COLORES_CARPETA.map((c) => (
                  <button
                    key={c.valor}
                    title={c.nombre}
                    aria-label={c.nombre}
                    className={el.item.color === c.valor ? styles.colorActual : ''}
                    style={{ background: c.valor }}
                    onClick={hacer(() => acciones.cambiarColor(el.item.id, c.valor))}
                  />
                ))}
              </div>
            )}
            <hr />
          </>
        )}
        <button role="menuitem" onClick={hacer(() => crearCarpeta(destino))}>Nueva carpeta<span>Ctrl+Shift+N</span></button>
        <button role="menuitem" onClick={hacer(() => acciones.subirEn(destino))}>Subir archivo aquí</button>
        {el && (
          <>
            <hr />
            <button role="menuitem" className={styles.peligro} onClick={hacer(() => eliminar(menu.clave))}>
              Eliminar<span>Supr</span>
            </button>
          </>
        )}
      </div>
    );
  };

  const nCarpetas = hijosDe(carpetaId).length;
  const nArchivos = archivosDe(carpetaId).length;
  const total = nCarpetas + nArchivos;

  return (
    <section className={styles.ventana} aria-label="Explorador de archivos">
      <div className={styles.barra}>
        <div className={styles.navegacion}>
          <button className={styles.botonIcono} onClick={navegacion.atras} disabled={!navegacion.puedeAtras} title="Atrás (Alt+←)" aria-label="Atrás">
            <ChevronLeft size={17} />
          </button>
          <button className={styles.botonIcono} onClick={navegacion.adelante} disabled={!navegacion.puedeAdelante} title="Adelante (Alt+→)" aria-label="Adelante">
            <ChevronRight size={17} />
          </button>
        </div>

        <nav className={styles.ruta} aria-label="Ruta">
          {ruta.map((c, i) => (
            <span key={c.id} className={styles.rutaItem}>
              {i > 0 && <ChevronRight size={13} className={styles.rutaSeparador} />}
              <button
                className={i === ruta.length - 1 ? styles.rutaActual : ''}
                onClick={() => navegacion.entrar(c.id)}
              >
                <IconoCarpeta color={c.color} size={17} />
                {c.nombre}
              </button>
            </span>
          ))}
        </nav>

        <div className={styles.herramientas}>
          <div className={styles.segmentos} role="group" aria-label="Vista">
            {VISTAS.map(({ id, nombre, Icono }) => (
              <button
                key={id}
                className={vista === id ? styles.segmentoActivo : ''}
                onClick={() => cambiarVista(id)}
                title={nombre}
                aria-label={`Vista de ${nombre.toLowerCase()}`}
                aria-pressed={vista === id}
              >
                <Icono size={15} />
              </button>
            ))}
          </div>
          <label className={styles.buscador} title="Busca por nombre y, desde 3 letras, también dentro de los archivos con IA">
            {consulta.length >= MIN_BUSQUEDA_CONTENIDO
              ? <Sparkles size={14} className={buscandoContenido ? styles.pensando : styles.ia} />
              : <Search size={14} />}
            <input
              type="search"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar nombre o contenido"
              aria-label="Buscar en esta carpeta por nombre o contenido"
            />
          </label>
          <button className={styles.boton} onClick={() => crearCarpeta()} title="Nueva carpeta (Ctrl+Shift+N)">
            <FolderPlus size={15} /> Nueva carpeta
          </button>
          <button className={`${styles.boton} ${styles.botonPrimario}`} onClick={() => acciones.subirEn(carpetaId)}>
            + Subir archivo
          </button>
        </div>
      </div>

      <div
        ref={vistaRef}
        className={`${styles.contenido} ${destinoArrastre === carpetaId ? styles.soltandoAqui : ''}`}
        tabIndex={0}
        onClick={() => setSeleccion(null)}
        onContextMenu={(e) => abrirMenu(e, null)}
        onDragEnter={alArrastrarEncima}
        onDragOver={alArrastrarEncima}
        onDragLeave={alSalir}
        onDrop={alSoltar}
      >
        {destinoArrastre !== null && (
          <div className={styles.avisoSoltar} aria-live="polite">
            Suelta para subir a <strong>{nombreDestino}</strong>
          </div>
        )}
        {vista === 'iconos' && renderIconos()}
        {/* Los resultados de busqueda se muestran en lista aunque la vista sea de columnas */}
        {(vista === 'lista' || (vista === 'columnas' && busqueda)) && renderLista()}
        {vista === 'columnas' && !busqueda && renderColumnas()}
      </div>

      <div className={styles.estado}>
        <span>
          {busqueda
            ? `${filas.length} resultado${filas.length === 1 ? '' : 's'}${
              buscandoContenido ? ' · buscando dentro de los archivos…'
                : contenido?.error ? ' · no se pudo buscar dentro de los archivos' : ''}`
            : seleccion
            ? `1 de ${total} seleccionado`
            : `${nCarpetas} carpeta${nCarpetas === 1 ? '' : 's'}, ${nArchivos} archivo${nArchivos === 1 ? '' : 's'}`}
        </span>
        <span>{formatoTamano(resumen.get(carpetaId)?.bytes ?? 0)} en total</span>
      </div>

      {menu && renderMenu()}
    </section>
  );
}
