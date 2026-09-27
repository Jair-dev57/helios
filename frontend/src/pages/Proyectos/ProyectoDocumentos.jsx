import { useState, useEffect, useCallback, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Check, Palette, ChevronRight } from 'lucide-react';
import {
  listarDocumentos,
  subirDocumento,
  subirVersionDocumento,
  eliminarDocumento,
  actualizarDocumento,
} from '../../api/documentos';
import {
  listarCarpetas,
  crearCarpeta,
  eliminarCarpeta,
  actualizarCarpeta,
} from '../../api/carpetas';
import VisorDocumento from '../../components/VisorDocumento';
import IconoArchivo from '../../components/IconoArchivo';
import ExploradorArchivos from './ExploradorArchivos';
import IconoCarpeta from './IconoCarpeta';
import { prepararSubida, nombreSinExtension } from './subidaArrastre';
import { agruparPor } from './arbol';
import { COLORES_CARPETA, COLOR_CARPETA_DEFECTO } from './coloresCarpeta';
import shared from '../../styles/shared.module.css';
import styles from './ProyectoDocumentos.module.css';

function SelectorColor({ valor, onChange }) {
  return (
    <div className={styles.paleta} role="radiogroup" aria-label="Color de la carpeta">
      {COLORES_CARPETA.map((c) => (
        <button
          key={c.valor}
          type="button"
          role="radio"
          aria-checked={valor === c.valor}
          aria-label={c.nombre}
          title={c.nombre}
          className={`${styles.muestraColor} ${valor === c.valor ? styles.muestraActiva : ''}`}
          style={{ background: c.valor }}
          onClick={() => onChange(c.valor)}
        >
          {valor === c.valor && <Check size={14} strokeWidth={3} />}
        </button>
      ))}
    </div>
  );
}

// Arbol lateral estilo explorador de archivos: subcarpetas y luego archivos, con lineas guia por nivel
function NodoCarpeta({ carpeta, arbol, carpetaActivaId, expandidas, docActivoId, acciones }) {
  const hijos = arbol.hijos.get(carpeta.id) || [];
  const archivos = arbol.docs.get(carpeta.id) || [];
  const tieneContenido = hijos.length > 0 || archivos.length > 0;
  const expandida = expandidas.has(carpeta.id);
  const activa = carpetaActivaId === carpeta.id;

  return (
    <div>
      <div className={`${styles.nodo} ${activa ? styles.nodoActivo : ''}`} onClick={() => acciones.onSeleccionar(carpeta.id)}>
        {tieneContenido ? (
          <button
            className={styles.toggle}
            onClick={(e) => { e.stopPropagation(); acciones.onToggle(carpeta.id); }}
            aria-label={expandida ? 'Contraer' : 'Desplegar'}
          >
            <ChevronRight size={14} className={`${styles.chevron} ${expandida ? styles.chevronAbierto : ''}`} />
          </button>
        ) : (
          <span className={styles.toggleVacio} />
        )}
        <span className={styles.nodoNombre} title={carpeta.nombre}>
          <IconoCarpeta color={carpeta.color} size={17} />
          <span className={styles.nodoTexto}>{carpeta.nombre}</span>
        </span>
        <div className={styles.nodoAcciones} onClick={(e) => e.stopPropagation()}>
          <button title="Nueva subcarpeta" onClick={() => acciones.onNuevaSubcarpeta(carpeta.id)}>+</button>
          <button title="Cambiar color" aria-label="Cambiar color" onClick={() => acciones.onCambiarColor(carpeta)}>
            <Palette size={13} />
          </button>
          <button title="Eliminar carpeta" onClick={() => acciones.onEliminar(carpeta.id)}>×</button>
        </div>
      </div>
      {expandida && tieneContenido && (
        <div className={styles.hijos}>
          {hijos.map((hijo) => (
            <NodoCarpeta
              key={hijo.id}
              carpeta={hijo}
              arbol={arbol}
              carpetaActivaId={carpetaActivaId}
              expandidas={expandidas}
              docActivoId={docActivoId}
              acciones={acciones}
            />
          ))}
          {archivos.map((doc) => (
            <div
              key={doc.id}
              className={`${styles.nodo} ${styles.nodoArchivo} ${docActivoId === doc.id ? styles.nodoArchivoActivo : ''}`}
              onClick={() => acciones.onVerArchivo(doc)}
              title={`${doc.nombre}.${doc.tipo}`}
            >
              <span className={styles.toggleVacio} />
              <span className={styles.nodoNombre}>
                <IconoArchivo tipo={doc.tipo} size={16} />
                <span className={styles.nodoTexto}>{doc.nombre}</span>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ProyectoDocumentos() {
  const { proyecto } = useOutletContext();
  const [carpetas, setCarpetas] = useState([]);
  const [documentos, setDocumentos] = useState([]);
  const [loading, setLoading] = useState(true);

  const [carpetaActivaId, setCarpetaActivaId] = useState(null);
  const [expandidas, setExpandidas] = useState(new Set());
  // Historial de navegacion para los botones atras / adelante
  const [historial, setHistorial] = useState({ pila: [], indice: -1 });

  const [showUpload, setShowUpload] = useState(false);
  const [carpetaDestino, setCarpetaDestino] = useState(null);
  const [nombreDoc, setNombreDoc] = useState('');
  const [archivo, setArchivo] = useState(null);
  const [subiendo, setSubiendo] = useState(false);

  const [docVisible, setDocVisible] = useState(null);

  const [versionDocId, setVersionDocId] = useState(null);
  const [archivoVersion, setArchivoVersion] = useState(null);
  const [notasVersion, setNotasVersion] = useState('');

  const [showNuevaCarpeta, setShowNuevaCarpeta] = useState(false);
  const [carpetaPadreNueva, setCarpetaPadreNueva] = useState(null);
  const [nombreCarpeta, setNombreCarpeta] = useState('');
  const [colorCarpeta, setColorCarpeta] = useState(COLOR_CARPETA_DEFECTO);

  const [carpetaEditandoColor, setCarpetaEditandoColor] = useState(null);
  const [colorEdicion, setColorEdicion] = useState(COLOR_CARPETA_DEFECTO);

  const cargarCarpetas = useCallback(async () => {
    const data = await listarCarpetas(proyecto.id);
    setCarpetas(data);
  }, [proyecto.id]);

  // Todos los archivos del proyecto en una sola peticion; la tabla los agrupa por carpeta_id
  const cargarDocumentos = useCallback(async () => {
    try {
      const data = await listarDocumentos(proyecto.id);
      setDocumentos(data);
    } finally {
      setLoading(false);
    }
  }, [proyecto.id]);

  useEffect(() => {
    cargarCarpetas();
  }, [cargarCarpetas]);

  useEffect(() => {
    cargarDocumentos();
  }, [cargarDocumentos]);

  // Todo archivo vive en una carpeta: si no hay una seleccionada (o se borró), abrir la primera
  useEffect(() => {
    if (carpetas.some((c) => c.id === carpetaActivaId)) return;
    const primera = carpetas.find((c) => c.carpeta_padre_id === null);
    setCarpetaActivaId(primera ? primera.id : null);
    setHistorial(primera ? { pila: [primera.id], indice: 0 } : { pila: [], indice: -1 });
  }, [carpetas, carpetaActivaId]);

  // El visor muestra la version mas reciente del archivo (p. ej. tras renombrarlo) y se cierra si se elimina
  useEffect(() => {
    setDocVisible((actual) => (actual ? documentos.find((d) => d.id === actual.id) || null : null));
  }, [documentos]);

  const alternar = (setter) => (id) => {
    setter((prev) => {
      const nuevo = new Set(prev);
      if (nuevo.has(id)) nuevo.delete(id);
      else nuevo.add(id);
      return nuevo;
    });
  };
  const toggleExpandida = alternar(setExpandidas);

  const carpetasPorId = useMemo(() => new Map(carpetas.map((c) => [c.id, c])), [carpetas]);
  const arbol = useMemo(() => ({
    hijos: agruparPor(carpetas, 'carpeta_padre_id'),
    docs: agruparPor(documentos, 'carpeta_id'),
  }), [carpetas, documentos]);

  const rutaDe = (id) => {
    const r = [];
    let actual = carpetasPorId.get(id);
    while (actual) {
      r.unshift(actual);
      actual = carpetasPorId.get(actual.carpeta_padre_id);
    }
    return r;
  };

  // Abre una carpeta y despliega su camino en el arbol lateral
  const mostrarCarpeta = (id) => {
    setCarpetaActivaId(id);
    setExpandidas((prev) => {
      const nuevo = new Set(prev).add(id);
      let padre = carpetasPorId.get(id)?.carpeta_padre_id;
      while (padre) {
        nuevo.add(padre);
        padre = carpetasPorId.get(padre)?.carpeta_padre_id;
      }
      return nuevo;
    });
  };

  const entrarCarpeta = (id) => {
    if (id === carpetaActivaId) return;
    mostrarCarpeta(id);
    setHistorial(({ pila, indice }) => {
      const nueva = [...pila.slice(0, indice + 1), id];
      return { pila: nueva, indice: nueva.length - 1 };
    });
  };

  const moverEnHistorial = (paso) => {
    const indice = historial.indice + paso;
    const id = historial.pila[indice];
    if (id === undefined || !carpetasPorId.has(id)) return;
    setHistorial({ ...historial, indice });
    mostrarCarpeta(id);
  };

  const abrirNuevaCarpeta = (padreId = null) => {
    setCarpetaPadreNueva(padreId);
    setNombreCarpeta('');
    setColorCarpeta(COLOR_CARPETA_DEFECTO);
    setShowNuevaCarpeta(true);
  };

  const handleCrearCarpeta = async () => {
    if (!nombreCarpeta.trim()) return;
    try {
      await crearCarpeta({
        nombre: nombreCarpeta,
        proyecto_id: proyecto.id,
        carpeta_padre_id: carpetaPadreNueva,
        color: colorCarpeta,
      });
      setShowNuevaCarpeta(false);
      if (carpetaPadreNueva) {
        setExpandidas((prev) => new Set(prev).add(carpetaPadreNueva));
      }
      cargarCarpetas();
      toast.success('Carpeta creada');
    } catch (err) {
      toast.error('No se pudo crear la carpeta.');
    }
  };

  const abrirCambiarColor = (carpeta) => {
    setCarpetaEditandoColor(carpeta);
    setColorEdicion(carpeta.color || COLOR_CARPETA_DEFECTO);
  };

  const handleGuardarColor = async () => {
    try {
      await actualizarCarpeta(carpetaEditandoColor.id, { color: colorEdicion });
      setCarpetaEditandoColor(null);
      cargarCarpetas();
      toast.success('Color actualizado');
    } catch (err) {
      toast.error('No se pudo cambiar el color.');
    }
  };

  const handleEliminarCarpeta = async (id) => {
    if (!confirm('¿Eliminar esta carpeta y sus subcarpetas?')) return;
    try {
      await eliminarCarpeta(id);
      cargarCarpetas();
      toast.success('Carpeta eliminada');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'No se pudo eliminar la carpeta.');
    }
  };

  // Crea "carpeta sin título" (como el Finder) para renombrarla en el sitio
  const crearCarpetaRapida = async (padreId) => {
    const nombres = new Set((arbol.hijos.get(padreId) || []).map((c) => c.nombre));
    let nombre = 'carpeta sin título';
    for (let n = 2; nombres.has(nombre); n += 1) nombre = `carpeta sin título ${n}`;
    try {
      const nueva = await crearCarpeta({ nombre, proyecto_id: proyecto.id, carpeta_padre_id: padreId });
      setExpandidas((prev) => new Set(prev).add(padreId));
      await cargarCarpetas();
      return nueva;
    } catch (err) {
      toast.error('No se pudo crear la carpeta.');
      return null;
    }
  };

  const renombrar = async (tipo, id, nombre) => {
    try {
      if (tipo === 'carpeta') {
        await actualizarCarpeta(id, { nombre });
        await cargarCarpetas();
      } else {
        await actualizarDocumento(id, { nombre });
        await cargarDocumentos();
      }
    } catch (err) {
      toast.error('No se pudo renombrar.');
    }
  };

  const cambiarColor = async (id, color) => {
    try {
      await actualizarCarpeta(id, { color });
      await cargarCarpetas();
    } catch (err) {
      toast.error('No se pudo cambiar el color.');
    }
  };

  // Archivos (y carpetas completas) arrastrados desde el equipo
  const subirDesdeEquipo = async (destinoId, entradas) => {
    const aviso = toast.loading('Preparando archivos...');
    try {
      const { tareas, noPermitidos, muyGrandes, carpetasCreadas } = await prepararSubida(entradas, destinoId, (nombre, padreId) =>
        crearCarpeta({ nombre, proyecto_id: proyecto.id, carpeta_padre_id: padreId }));
      if (carpetasCreadas) {
        setExpandidas((prev) => new Set(prev).add(destinoId));
        await cargarCarpetas();
      }

      let hechos = 0;
      const fallidos = [];
      const subirUno = async ({ archivo, carpetaId }) => {
        const formData = new FormData();
        formData.append('nombre', nombreSinExtension(archivo.name));
        formData.append('proyecto_id', proyecto.id);
        formData.append('carpeta_id', carpetaId);
        formData.append('archivo', archivo);
        try {
          await subirDocumento(formData);
        } catch (err) {
          fallidos.push(archivo.name);
        }
        hechos += 1;
        toast.loading(`Subiendo ${hechos} de ${tareas.length}...`, { id: aviso });
      };
      // Tres subidas a la vez: rapido sin saturar el servidor
      const cola = [...tareas];
      await Promise.all(
        Array.from({ length: Math.min(3, cola.length) }, async () => {
          while (cola.length) await subirUno(cola.shift());
        }),
      );
      await cargarDocumentos();

      const subidos = tareas.length - fallidos.length;
      if (subidos || carpetasCreadas) {
        const partes = [];
        if (subidos) partes.push(`${subidos} archivo${subidos === 1 ? '' : 's'}`);
        if (carpetasCreadas) partes.push(`${carpetasCreadas} carpeta${carpetasCreadas === 1 ? '' : 's'}`);
        toast.success(`Subido: ${partes.join(' y ')}`, { id: aviso });
      } else {
        toast.dismiss(aviso);
      }
      const avisar = (lista, texto) => lista.length && toast.error(`${texto}: ${lista.join(', ')}`, { duration: 6000 });
      avisar(fallidos, 'No se pudieron subir');
      avisar(muyGrandes, 'Superan el máximo de 10 MB');
      avisar(noPermitidos, 'Tipo de archivo no permitido');
    } catch (err) {
      toast.error('No se pudo completar la subida.', { id: aviso });
      cargarCarpetas();
      cargarDocumentos();
    }
  };

  const abrirSubida = (carpetaId) => {
    setCarpetaDestino(carpetaId);
    setShowUpload(true);
  };

  const handleSubir = async () => {
    if (!nombreDoc.trim() || !archivo || !carpetaDestino) return;
    try {
      setSubiendo(true);
      const formData = new FormData();
      formData.append('nombre', nombreDoc);
      formData.append('proyecto_id', proyecto.id);
      formData.append('carpeta_id', carpetaDestino);
      formData.append('archivo', archivo);
      await subirDocumento(formData);
      setNombreDoc('');
      setArchivo(null);
      setShowUpload(false);
      cargarDocumentos();
      toast.success('Archivo subido');
    } catch (err) {
      toast.error('No se pudo subir el archivo.');
    } finally {
      setSubiendo(false);
    }
  };

  const handleSubirVersion = async () => {
    if (!archivoVersion || !versionDocId) return;
    try {
      setSubiendo(true);
      const formData = new FormData();
      formData.append('archivo', archivoVersion);
      if (notasVersion.trim()) formData.append('notas', notasVersion);
      await subirVersionDocumento(versionDocId, formData);
      setVersionDocId(null);
      setArchivoVersion(null);
      setNotasVersion('');
      cargarDocumentos();
      toast.success('Nueva versión subida');
    } catch (err) {
      toast.error('No se pudo subir la versión.');
    } finally {
      setSubiendo(false);
    }
  };

  const handleEliminarDocumento = async (id) => {
    if (!confirm('¿Eliminar este archivo y todas sus versiones?')) return;
    try {
      await eliminarDocumento(id);
      setDocumentos((prev) => prev.filter((d) => d.id !== id));
      toast.success('Archivo eliminado');
    } catch (err) {
      toast.error('No se pudo eliminar.');
    }
  };

  const carpetasRaiz = arbol.hijos.get(null) || [];
  const hayModal = showUpload || !!versionDocId || showNuevaCarpeta || !!carpetaEditandoColor;
  const accionesArbol = {
    onSeleccionar: entrarCarpeta,
    onToggle: toggleExpandida,
    onNuevaSubcarpeta: abrirNuevaCarpeta,
    onCambiarColor: abrirCambiarColor,
    onEliminar: handleEliminarCarpeta,
    onVerArchivo: setDocVisible,
  };

  return (
    <div className={`${styles.layout} ${docVisible ? styles.layoutConVisor : ''}`}>
      <aside className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <span>Carpetas</span>
          <button title="Nueva carpeta" onClick={() => abrirNuevaCarpeta(null)}>+</button>
        </div>
        {carpetasRaiz.length === 0 && (
          <p className={styles.sinCarpetas}>Aún no hay carpetas.</p>
        )}
        {carpetasRaiz.map((carpeta) => (
          <NodoCarpeta
            key={carpeta.id}
            carpeta={carpeta}
            arbol={arbol}
            carpetaActivaId={carpetaActivaId}
            expandidas={expandidas}
            docActivoId={docVisible?.id}
            acciones={accionesArbol}
          />
        ))}
      </aside>

      <div className={styles.contenido}>
        {carpetaActivaId === null ? (
          <div className={styles.vacio}>
            <p className={styles.vacioTitulo}>Crea una carpeta para empezar</p>
            <p className={styles.vacioTexto}>Los archivos del proyecto se organizan en carpetas.</p>
            <button className={shared.btnPrimary} onClick={() => abrirNuevaCarpeta(null)}>
              + Nueva carpeta
            </button>
          </div>
        ) : (
          loading ? (
            <p className={shared.loadingText}>Cargando...</p>
          ) : (
            <ExploradorArchivos
              proyectoId={proyecto.id}
              carpetaId={carpetaActivaId}
              arbol={arbol}
              carpetasPorId={carpetasPorId}
              docActivoId={docVisible?.id}
              compacto={!!docVisible}
              atajosActivos={!hayModal}
              navegacion={{
                entrar: entrarCarpeta,
                atras: () => moverEnHistorial(-1),
                adelante: () => moverEnHistorial(1),
                puedeAtras: historial.indice > 0,
                puedeAdelante: historial.indice < historial.pila.length - 1,
              }}
              acciones={{
                ver: setDocVisible,
                cerrarVisor: () => setDocVisible(null),
                nuevaVersion: setVersionDocId,
                subirEn: abrirSubida,
                soltarArchivos: subirDesdeEquipo,
                crearCarpeta: crearCarpetaRapida,
                renombrar,
                cambiarColor,
                eliminarArchivo: handleEliminarDocumento,
                eliminarCarpeta: handleEliminarCarpeta,
              }}
            />
          )
        )}
      </div>

      {docVisible && (
        <VisorDocumento documento={docVisible} onClose={() => setDocVisible(null)} />
      )}

      {showUpload && (
        <div className={shared.overlay} onClick={() => setShowUpload(false)}>
          <div className={shared.modal} onClick={(e) => e.stopPropagation()}>
            <h3 className={shared.modalTitle}>Subir archivo</h3>
            <p className={styles.modalContexto}>Se subirá en: <strong>{rutaDe(carpetaDestino).map((c) => c.nombre).join(' / ')}</strong></p>
            <div className={shared.field}>
              <label>Nombre</label>
              <input value={nombreDoc} onChange={(e) => setNombreDoc(e.target.value)} placeholder="Nombre del archivo" />
            </div>
            <div className={shared.field}>
              <label>Archivo</label>
              <input type="file" onChange={(e) => setArchivo(e.target.files[0] || null)} />
            </div>
            <div className={shared.modalActions}>
              <button className={shared.btnSecondary} onClick={() => setShowUpload(false)}>Cancelar</button>
              <button className={shared.btnPrimary} onClick={handleSubir} disabled={subiendo || !nombreDoc.trim() || !archivo}>
                {subiendo ? 'Subiendo...' : 'Subir'}
              </button>
            </div>
          </div>
        </div>
      )}

      {versionDocId && (
        <div className={shared.overlay} onClick={() => setVersionDocId(null)}>
          <div className={shared.modal} onClick={(e) => e.stopPropagation()}>
            <h3 className={shared.modalTitle}>Nueva versión</h3>
            <div className={shared.field}>
              <label>Archivo</label>
              <input type="file" onChange={(e) => setArchivoVersion(e.target.files[0] || null)} />
            </div>
            <div className={shared.field}>
              <label>Notas (opcional)</label>
              <input value={notasVersion} onChange={(e) => setNotasVersion(e.target.value)} placeholder="¿Qué cambió?" />
            </div>
            <div className={shared.modalActions}>
              <button className={shared.btnSecondary} onClick={() => setVersionDocId(null)}>Cancelar</button>
              <button className={shared.btnPrimary} onClick={handleSubirVersion} disabled={subiendo || !archivoVersion}>
                {subiendo ? 'Subiendo...' : 'Subir versión'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showNuevaCarpeta && (
        <div className={shared.overlay} onClick={() => setShowNuevaCarpeta(false)}>
          <div className={shared.modal} onClick={(e) => e.stopPropagation()}>
            <h3 className={shared.modalTitle}>Nueva carpeta</h3>
            <div className={shared.field}>
              <label>Nombre</label>
              <input
                value={nombreCarpeta}
                onChange={(e) => setNombreCarpeta(e.target.value)}
                placeholder="Nombre de la carpeta"
                autoFocus
              />
            </div>
            <div className={shared.field}>
              <label>Color</label>
              <SelectorColor valor={colorCarpeta} onChange={setColorCarpeta} />
            </div>
            <div className={shared.modalActions}>
              <button className={shared.btnSecondary} onClick={() => setShowNuevaCarpeta(false)}>Cancelar</button>
              <button className={shared.btnPrimary} onClick={handleCrearCarpeta} disabled={!nombreCarpeta.trim()}>
                Crear
              </button>
            </div>
          </div>
        </div>
      )}

      {carpetaEditandoColor && (
        <div className={shared.overlay} onClick={() => setCarpetaEditandoColor(null)}>
          <div className={shared.modal} onClick={(e) => e.stopPropagation()}>
            <h3 className={shared.modalTitle}>Color de carpeta</h3>
            <p className={styles.modalContexto}>
              Carpeta: <strong>{carpetaEditandoColor.nombre}</strong>
            </p>
            <div className={shared.field}>
              <SelectorColor valor={colorEdicion} onChange={setColorEdicion} />
            </div>
            <div className={shared.modalActions}>
              <button className={shared.btnSecondary} onClick={() => setCarpetaEditandoColor(null)}>Cancelar</button>
              <button
                className={shared.btnPrimary}
                onClick={handleGuardarColor}
                disabled={colorEdicion === carpetaEditandoColor.color}
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
