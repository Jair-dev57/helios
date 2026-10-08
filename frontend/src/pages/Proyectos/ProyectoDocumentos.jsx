import { useState, useEffect, useCallback, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Lock, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { Check, Palette, ChevronRight } from 'lucide-react';
import {
  listarDocumentos,
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
import { listarPapelera, restaurarDePapelera } from '../../api/papelera';
import VisorDocumento from '../../components/VisorDocumento';
import IconoArchivo from '../../components/IconoArchivo';
import ExploradorArchivos from './ExploradorArchivos';
import ModalAccesoDocumento from './ModalAccesoDocumento';
import Papelera from './Papelera';
import ModalRevisarSubida from './ModalRevisarSubida';
import PanelSubida from './PanelSubida';
import { useSubidaLocal } from './useSubidaLocal';
import { useAuth } from '../../hooks/useAuth';
import IconoCarpeta from './IconoCarpeta';
import { leerEntradas, leerSelector } from './subidaLocal';
import { agruparPor } from './arbol';
import { COLORES_CARPETA, COLOR_CARPETA_DEFECTO } from './coloresCarpeta';
import shared from '../../styles/shared.module.css';
import styles from './ProyectoDocumentos.module.css';
import estilosPapelera from './Papelera.module.css';

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
                {doc.restringido && <Lock size={11} className={styles.candado} aria-label="Restringido" />}
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
  const { esAdministrador } = useAuth();
  const [carpetas, setCarpetas] = useState([]);
  const [documentos, setDocumentos] = useState([]);
  const [loading, setLoading] = useState(true);

  const [carpetaActivaId, setCarpetaActivaId] = useState(null);
  // La papelera ocupa el lugar del explorador; enPapelera es el contador del menu lateral
  const [viendoPapelera, setViendoPapelera] = useState(false);
  const [enPapelera, setEnPapelera] = useState(0);
  const [expandidas, setExpandidas] = useState(new Set());
  // Historial de navegacion para los botones atras / adelante
  const [historial, setHistorial] = useState({ pila: [], indice: -1 });

  const [subiendo, setSubiendo] = useState(false);

  const [docVisible, setDocVisible] = useState(null);
  // Abrir el visor con el panel de versiones desplegado
  const [conVersiones, setConVersiones] = useState(false);
  // Archivo cuyo acceso se esta editando (solo administradores)
  const [docAcceso, setDocAcceso] = useState(null);

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

  const contarPapelera = useCallback(async () => {
    try {
      setEnPapelera((await listarPapelera(proyecto.id)).length);
    } catch (err) {
      setEnPapelera(0);
    }
  }, [proyecto.id]);

  useEffect(() => {
    cargarCarpetas();
  }, [cargarCarpetas]);

  useEffect(() => {
    contarPapelera();
  }, [contarPapelera]);

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

  // Borrar no pregunta: va a la papelera y el aviso permite deshacer
  const restaurarBorrado = async (tipo, id) => {
    try {
      await restaurarDePapelera(tipo, id);
      await Promise.all([cargarCarpetas(), cargarDocumentos(), contarPapelera()]);
      toast.success('Restaurado');
    } catch (err) {
      toast.error('No se pudo restaurar.');
    }
  };

  const enviarAPapelera = async (tipo, id, nombre) => {
    try {
      if (tipo === 'carpeta') {
        await eliminarCarpeta(id);
        // Sus archivos se van con ella
        await Promise.all([cargarCarpetas(), cargarDocumentos()]);
      } else {
        await eliminarDocumento(id);
        setDocumentos((prev) => prev.filter((d) => d.id !== id));
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'No se pudo mover a la papelera.');
      return;
    }
    contarPapelera();
    toast((t) => (
      <span className={estilosPapelera.aviso}>
        «{nombre}» se movió a la papelera
        <button onClick={() => { toast.dismiss(t.id); restaurarBorrado(tipo, id); }}>Deshacer</button>
      </span>
    ), { duration: 6000, icon: <Trash2 size={16} /> });
  };

  const handleEliminarCarpeta = (id) => enviarAPapelera('carpeta', id, carpetasPorId.get(id)?.nombre || 'Carpeta');

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

  // Archivos y carpetas del equipo (arrastrados o elegidos): revision previa y panel de progreso
  const subidaLocal = useSubidaLocal({
    proyectoId: proyecto.id,
    carpetas,
    documentos,
    alCrearCarpetas: (destinoId) => {
      setExpandidas((prev) => new Set(prev).add(destinoId));
      cargarCarpetas();
    },
    recargarDocumentos: cargarDocumentos,
  });

  const handleSubirVersion = async () => {
    if (!archivoVersion || !versionDocId) return;
    try {
      setSubiendo(true);
      const formData = new FormData();
      formData.append('archivo', archivoVersion);
      if (notasVersion.trim()) formData.append('notas', notasVersion);
      const anterior = documentos.find((d) => d.id === versionDocId);
      const doc = await subirVersionDocumento(versionDocId, formData);
      setVersionDocId(null);
      setArchivoVersion(null);
      setNotasVersion('');
      cargarDocumentos();
      if (anterior && doc.version_actual === anterior.version_actual) {
        toast('El archivo es igual a la versión actual: no se creó una versión nueva.');
      } else {
        toast.success('Nueva versión subida');
      }
    } catch (err) {
      toast.error('No se pudo subir la versión.');
    } finally {
      setSubiendo(false);
    }
  };

  const handleEliminarDocumento = (id) => {
    const doc = documentos.find((d) => d.id === id);
    return enviarAPapelera('documento', id, doc ? `${doc.nombre}${doc.tipo ? `.${doc.tipo}` : ''}` : 'Archivo');
  };

  // Desde la papelera: recargar lo que volvio y el contador; "Ver" abre la carpeta donde quedo
  const alCambiarPapelera = () => Promise.all([cargarCarpetas(), cargarDocumentos(), contarPapelera()]);
  const abrirDesdePapelera = (carpetaId) => {
    setViendoPapelera(false);
    entrarCarpeta(carpetaId);
  };

  const cerrarAcceso = useCallback(() => setDocAcceso(null), []);

  const carpetasRaiz = arbol.hijos.get(null) || [];
  const hayModal = !!subidaLocal.revision || !!versionDocId || showNuevaCarpeta || !!carpetaEditandoColor || !!docAcceso;
  const accionesArbol = {
    onSeleccionar: (id) => {
      setViendoPapelera(false);
      entrarCarpeta(id);
    },
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
        <button
          className={`${styles.entradaPapelera} ${viendoPapelera ? styles.entradaPapeleraActiva : ''}`}
          onClick={() => { setViendoPapelera(true); setDocVisible(null); }}
          aria-pressed={viendoPapelera}
        >
          <Trash2 size={15} />
          <span>Papelera</span>
          {enPapelera > 0 && <span className={styles.contador}>{enPapelera}</span>}
        </button>
      </aside>

      <div className={styles.contenido}>
        {viendoPapelera ? (
          <Papelera
            proyectoId={proyecto.id}
            esAdministrador={esAdministrador}
            onCambio={alCambiarPapelera}
            onAbrir={abrirDesdePapelera}
          />
        ) : carpetaActivaId === null ? (
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
                ver: (doc) => { setConVersiones(false); setDocVisible(doc); },
                verVersiones: (doc) => { setConVersiones(true); setDocVisible(doc); },
                cerrarVisor: () => setDocVisible(null),
                nuevaVersion: setVersionDocId,
                soltarArchivos: (destino, entradas) => subidaLocal.preparar(destino, leerEntradas(entradas)),
                elegirArchivos: (destino, lista) => subidaLocal.preparar(destino, leerSelector(lista)),
                crearCarpeta: crearCarpetaRapida,
                renombrar,
                cambiarColor,
                eliminarArchivo: handleEliminarDocumento,
                eliminarCarpeta: handleEliminarCarpeta,
                ...(esAdministrador && { gestionarAcceso: setDocAcceso }),
              }}
            />
          )
        )}
      </div>

      {docVisible && (
        <VisorDocumento
          documento={docVisible}
          onClose={() => setDocVisible(null)}
          onRestaurado={cargarDocumentos}
          mostrarVersiones={conVersiones}
        />
      )}

      {docAcceso && (
        <ModalAccesoDocumento
          documento={docAcceso}
          onClose={cerrarAcceso}
          onGuardado={() => { setDocAcceso(null); cargarDocumentos(); }}
        />
      )}

      {subidaLocal.revision && (
        <ModalRevisarSubida
          revision={subidaLocal.revision}
          rutaDestino={rutaDe(subidaLocal.revision.destinoId).map((c) => c.nombre).join(' / ')}
          puedeRestringir={esAdministrador}
          onConfirmar={subidaLocal.confirmar}
          onCancelar={subidaLocal.cancelarRevision}
        />
      )}

      {subidaLocal.subida && (
        <PanelSubida
          subida={subidaLocal.subida}
          onPausar={subidaLocal.pausar}
          onReanudar={subidaLocal.reanudar}
          onCancelar={subidaLocal.cancelar}
          onReintentar={subidaLocal.reintentar}
          onCerrar={subidaLocal.cerrar}
        />
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
