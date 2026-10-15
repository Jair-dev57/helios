import { useState, useEffect, useCallback, useMemo } from 'react';
import { useOutletContext, useSearchParams } from 'react-router-dom';
import { Lock, Trash2, Star, Clock, LayoutGrid, Share2, Check, Palette, ChevronRight, Inbox } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  listarDocumentos,
  subirVersionDocumento,
  bloquearDocumento,
  desbloquearDocumento,
  eliminarDocumento,
  actualizarDocumento,
} from '../../api/documentos';
import {
  listarCarpetas,
  crearCarpeta,
  eliminarCarpeta,
  actualizarCarpeta,
  descargarZipCarpeta,
} from '../../api/carpetas';
import { listarPapelera, restaurarDePapelera } from '../../api/papelera';
import { obtenerFavoritos, marcarFavorito, obtenerRecientes, registrarVisto, EVENTO_FAVORITOS_ARCHIVOS } from '../../api/favoritos';
import { listarEtiquetas } from '../../api/etiquetas';
import { obtenerCompartidos, obtenerCompartidosGlobal } from '../../api/enlaces';
import VisorDocumento from '../../components/documentos/VisorDocumento';
import IconoArchivo from '../../components/ui/IconoArchivo';
import ExploradorArchivos from './ExploradorArchivos';
import ModalAccesoDocumento from './ModalAccesoDocumento';
import Papelera from './Papelera';
import ModalCompartir from '../../components/compartir/ModalCompartir';
import ModalEtiquetas from './ModalEtiquetas';
import VistaEtiqueta from './VistaEtiqueta';
import VistaAccesos from './VistaAccesos';
import ModalRevisarSubida from './ModalRevisarSubida';
import PanelSubida from './PanelSubida';
import { useSubidaLocal } from '../../hooks/useSubidaLocal';
import { useAuth } from '../../hooks/useAuth';
import IconoCarpeta from '../../components/ui/IconoCarpeta';
import CarpetaProyectos from './CarpetaProyectos';
import Solicitudes from '../../components/compartir/Solicitudes';
import { leerEntradas, leerSelector } from '../../utils/subidaLocal';
import { agruparPor } from '../../utils/arbol';
import { formatoTamano, nombreArchivo } from '../../utils/formato';

const nombreDoc = (doc) => nombreArchivo(doc.nombre, doc.tipo);
import { COLORES_CARPETA, COLOR_CARPETA_DEFECTO } from '../../utils/coloresCarpeta';
import shared from '../../styles/shared.module.css';
import styles from './Documentos.module.css';
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
              title={nombreDoc(doc)}
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

export default function Documentos() {
  // enArchivos: dentro del modulo Archivos (Mis archivos y equipos). Su menu ya tiene Recientes, Favoritos,
  // Compartidos y Papelera, asi que no hay panel lateral: se navega desde la raiz con la ruta del explorador
  // Un equipo si lleva el panel: sus Recientes, Favoritos y Papelera son solo los del equipo.
  // proyectosEquipo: sus proyectos, que el panel muestra como la carpeta «Proyectos» (acceso directo)
  const { proyecto, enArchivos = false, proyectosEquipo = null } = useOutletContext();
  const conPanel = !enArchivos || proyecto.tipo === 'equipo';
  const [viendoProyectos, setViendoProyectos] = useState(false);
  const { esAdministrador, user } = useAuth();
  const [carpetas, setCarpetas] = useState([]);
  const [documentos, setDocumentos] = useState([]);
  const [loading, setLoading] = useState(true);

  const [carpetaActivaId, setCarpetaActivaId] = useState(null);
  // La papelera ocupa el lugar del explorador; enPapelera es el contador del menu lateral
  const [viendoPapelera, setViendoPapelera] = useState(false);
  const [enPapelera, setEnPapelera] = useState(0);
  // Accesos rapidos del usuario: claves 'd:id' / 'c:id' con estrella y documentos abiertos hace poco
  const [favoritos, setFavoritos] = useState(new Set());
  const [recientes, setRecientes] = useState([]);
  // Etiquetas del proyecto; etiquetaVista: la que se esta mirando (ocupa el lugar del explorador)
  const [etiquetas, setEtiquetas] = useState([]);
  const [etiquetaVista, setEtiquetaVista] = useState(null);
  // 'todos' | 'favoritos' | 'recientes' | 'compartidos' | 'solicitudes': vista rapida en el lugar del explorador
  const [vistaRapida, setVistaRapida] = useState(null);
  const [compartidos, setCompartidos] = useState({ conmigo: [], enlaces: [] });
  // Solicitudes de archivos (enlaces «subir») de este proyecto; null mientras carga
  const [solicitudes, setSolicitudes] = useState(null);
  const [docEtiquetas, setDocEtiquetas] = useState(null);
  const [expandidas, setExpandidas] = useState(new Set());
  // Historial de navegacion para los botones atras / adelante
  const [historial, setHistorial] = useState({ pila: [], indice: -1 });

  const [subiendo, setSubiendo] = useState(false);

  const [docVisible, setDocVisible] = useState(null);
  // Abrir el visor con el panel de versiones o de comentarios desplegado
  const [conVersiones, setConVersiones] = useState(false);
  const [conComentarios, setConComentarios] = useState(false);
  // ?doc=ID&ver=comentarios: abrir un archivo al llegar desde una notificacion
  const [parametros, setParametros] = useSearchParams();
  // Documento o carpeta cuyos enlaces publicos se gestionan: { tipo, id, nombre }
  const [compartiendo, setCompartiendo] = useState(null);
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

  const cargarFavoritos = useCallback(async () => {
    try {
      const f = await obtenerFavoritos(proyecto.id);
      setFavoritos(new Set([...f.documentos.map((id) => `d:${id}`), ...f.carpetas.map((id) => `c:${id}`)]));
    } catch {
      setFavoritos(new Set());
    }
  }, [proyecto.id]);

  const cargarRecientes = useCallback(async () => {
    try {
      setRecientes(await obtenerRecientes(proyecto.id));
    } catch {
      setRecientes([]);
    }
  }, [proyecto.id]);

  const cargarSolicitudes = useCallback(async () => {
    try {
      const { enlaces } = await obtenerCompartidosGlobal();
      setSolicitudes(enlaces.filter((e) => e.permiso === 'subir' && e.objeto?.proyecto_id === proyecto.id));
    } catch {
      setSolicitudes([]);
    }
  }, [proyecto.id]);

  const cargarCompartidos = useCallback(async () => {
    try {
      setCompartidos(await obtenerCompartidos(proyecto.id));
    } catch {
      setCompartidos({ conmigo: [], enlaces: [] });
    }
  }, [proyecto.id]);

  const cargarEtiquetas = useCallback(async () => {
    try {
      setEtiquetas(await listarEtiquetas(proyecto.id));
    } catch {
      setEtiquetas([]);
    }
  }, [proyecto.id]);

  useEffect(() => {
    cargarFavoritos();
    cargarRecientes();
    cargarEtiquetas();
  }, [cargarFavoritos, cargarRecientes, cargarEtiquetas]);

  // Las estrellas siguen a Favoritos aunque se cambien desde la barra lateral
  useEffect(() => {
    window.addEventListener(EVENTO_FAVORITOS_ARCHIVOS, cargarFavoritos);
    return () => window.removeEventListener(EVENTO_FAVORITOS_ARCHIVOS, cargarFavoritos);
  }, [cargarFavoritos]);

  const contarPapelera = useCallback(async () => {
    try {
      setEnPapelera((await listarPapelera(proyecto.id)).length);
    } catch {
      setEnPapelera(0);
    }
  }, [proyecto.id]);

  useEffect(() => {
    cargarCarpetas();
    cargarDocumentos();
    contarPapelera();
  }, [cargarCarpetas, cargarDocumentos, contarPapelera]);

  // Todo archivo vive en una carpeta: si no hay una seleccionada (o se borró), abrir la primera.
  // En Archivos se abre la raiz (null), que muestra las carpetas principales
  useEffect(() => {
    if (carpetas.some((c) => c.id === carpetaActivaId)) return;
    if (enArchivos) {
      if (carpetaActivaId !== null || historial.pila.length === 0) {
        setCarpetaActivaId(null);
        setHistorial({ pila: [null], indice: 0 });
      }
      return;
    }
    const primera = carpetas.find((c) => c.carpeta_padre_id === null);
    setCarpetaActivaId(primera ? primera.id : null);
    setHistorial(primera ? { pila: [primera.id], indice: 0 } : { pila: [], indice: -1 });
  }, [carpetas, carpetaActivaId, enArchivos, historial.pila.length]);

  // Llegada desde una notificacion: abrir la carpeta del archivo y el archivo (con sus comentarios)
  const docPedido = parametros.get('doc');
  useEffect(() => {
    if (!docPedido || loading || !carpetas.length) return;
    const doc = documentos.find((d) => d.id === Number(docPedido));
    if (doc) {
      salirDeVistas();
      if (doc.carpeta_id) entrarCarpeta(doc.carpeta_id);
      setConVersiones(false);
      setConComentarios(parametros.get('ver') === 'comentarios');
      setDocVisible(doc);
    } else {
      toast.error('Ese archivo ya no está disponible.');
    }
    setParametros({}, { replace: true });
  // Solo al llegar un ?doc= nuevo o terminar de cargar; entrarCarpeta cambia en cada render
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docPedido, loading, carpetas.length, documentos]);

  // ?carpeta=ID (p. ej. desde Compartidos o Solicitudes): abrir esa carpeta
  const carpetaPedida = Number(parametros.get('carpeta'));
  useEffect(() => {
    if (!carpetaPedida || !carpetas.length) return;
    if (carpetasPorId.has(carpetaPedida)) {
      salirDeVistas();
      entrarCarpeta(carpetaPedida);
    } else {
      toast.error('Esa carpeta ya no está disponible.');
    }
    setParametros({}, { replace: true });
  // Solo al llegar un ?carpeta= nuevo o cargar las carpetas; entrarCarpeta cambia en cada render
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carpetaPedida, carpetas.length]);

  // El visor muestra la version mas reciente del archivo (p. ej. tras renombrarlo) y se cierra si se elimina
  useEffect(() => {
    setDocVisible((actual) => (actual ? documentos.find((d) => d.id === actual.id) || null : null));
  }, [documentos]);

  const toggleExpandida = (id) => {
    setExpandidas((prev) => {
      const nuevo = new Set(prev);
      if (nuevo.has(id)) nuevo.delete(id);
      else nuevo.add(id);
      return nuevo;
    });
  };

  // Volver al explorador de carpetas desde papelera, etiqueta, favoritos o recientes
  const salirDeVistas = () => {
    setViendoPapelera(false);
    setViendoProyectos(false);
    setEtiquetaVista(null);
    setVistaRapida(null);
  };
  const abrirVista = (vista) => {
    salirDeVistas();
    setVistaRapida(vista);
    if (vista === 'compartidos') cargarCompartidos();
    if (vista === 'solicitudes') cargarSolicitudes();
  };

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

  // En la raiz solo caben carpetas: los archivos sueltos necesitan una carpeta de destino
  const prepararSubida = (destino, lectura) => {
    if (destino == null && lectura.archivos.some((a) => a.carpetas.length === 0)) {
      toast.error('Los archivos van dentro de una carpeta: abre una o súbelos como carpeta.');
      return;
    }
    subidaLocal.preparar(destino, lectura);
  };

  const moverEnHistorial = (paso) => {
    const indice = historial.indice + paso;
    const id = historial.pila[indice];
    // null es la raiz (solo en Archivos)
    if (id === undefined || (id !== null && !carpetasPorId.has(id))) return;
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
    } catch {
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
    } catch {
      toast.error('No se pudo cambiar el color.');
    }
  };

  const descargarZip = async (id) => {
    const nombre = carpetasPorId.get(id)?.nombre || 'carpeta';
    const aviso = toast.loading(`Preparando «${nombre}.zip»…`);
    try {
      const blob = await descargarZipCarpeta(id);
      const url = URL.createObjectURL(blob);
      const enlace = document.createElement('a');
      enlace.href = url;
      enlace.download = `${nombre}.zip`;
      enlace.click();
      URL.revokeObjectURL(url);
      toast.success('Descarga lista', { id: aviso });
    } catch {
      toast.error('No se pudo descargar la carpeta.', { id: aviso });
    }
  };

  // Borrar no pregunta: va a la papelera y el aviso permite deshacer
  const restaurarBorrado = async (tipo, id) => {
    try {
      await restaurarDePapelera(tipo, id);
      await Promise.all([cargarCarpetas(), cargarDocumentos(), contarPapelera()]);
      toast.success('Restaurado');
    } catch {
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

  // Arrastrar dentro del explorador: clave «c:ID» (carpeta) o «d:ID» (archivo) a la carpeta destino
  const mover = async (clave, destinoId) => {
    const [tipo, id] = clave.split(':');
    try {
      if (tipo === 'c') await actualizarCarpeta(Number(id), { carpeta_padre_id: destinoId });
      else await actualizarDocumento(Number(id), { carpeta_id: destinoId });
      await Promise.all([cargarCarpetas(), cargarDocumentos()]);
      toast.success(`Movido a ${carpetasPorId.get(destinoId)?.nombre || 'la carpeta'}`);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'No se pudo mover.');
    }
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
    } catch {
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
      toast.error(err.response?.data?.detail || 'No se pudo renombrar.');
    }
  };

  const cambiarColor = async (id, color) => {
    try {
      await actualizarCarpeta(id, { color });
      await cargarCarpetas();
    } catch {
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
      toast.error(err.response?.data?.detail || 'No se pudo subir la versión.');
    } finally {
      setSubiendo(false);
    }
  };

  const handleEliminarDocumento = (id) => {
    const doc = documentos.find((d) => d.id === id);
    return enviarAPapelera('documento', id, doc ? nombreDoc(doc) : 'Archivo');
  };

  // Desde la papelera: recargar lo que volvio y el contador; "Ver" abre la carpeta donde quedo
  const alCambiarPapelera = () => Promise.all([cargarCarpetas(), cargarDocumentos(), contarPapelera()]);
  const abrirDesdePapelera = (carpetaId) => {
    salirDeVistas();
    entrarCarpeta(carpetaId);
  };

  // Cada archivo abierto en el visor pasa a "Recientes"
  const docVisibleId = docVisible?.id;
  useEffect(() => {
    if (!docVisibleId) return;
    registrarVisto(docVisibleId).then(cargarRecientes).catch(() => {});
  }, [docVisibleId, cargarRecientes]);


  // Abrir un archivo desde los accesos rapidos: su carpeta en el explorador y el archivo en el visor
  const verDocumento = (doc) => {
    setConVersiones(false);
    setConComentarios(false);
    setDocVisible(doc);
  };

  const alternarFavorito = async (tipo, item) => {
    const clave = `${tipo === 'carpeta' ? 'c' : 'd'}:${item.id}`;
    const marcar = !favoritos.has(clave);
    setFavoritos((prev) => {
      const nuevo = new Set(prev);
      if (marcar) nuevo.add(clave);
      else nuevo.delete(clave);
      return nuevo;
    });
    try {
      await marcarFavorito(tipo === 'carpeta' ? { carpeta_id: item.id } : { documento_id: item.id }, marcar);
    } catch {
      toast.error('No se pudo cambiar el favorito.');
      cargarFavoritos();
    }
  };

  const abrirCompartir = (tipo, item) => {
    if (tipo === 'documento' && item.restringido) {
      toast.error('Los documentos restringidos no se pueden compartir por enlace.');
      return;
    }
    setCompartiendo({ tipo, id: item.id, nombre: tipo === 'documento' ? nombreDoc(item) : item.nombre });
  };

  // Acciones del boton ⋯ del visor: las mismas del clic derecho sobre el archivo
  const menuVisor = (doc) => [
    { etiqueta: 'Subir nueva versión', onClick: () => setVersionDocId(doc.id) },
    { etiqueta: 'Compartir enlace…', onClick: () => abrirCompartir('documento', doc) },
    { etiqueta: favoritos.has(`d:${doc.id}`) ? 'Quitar de favoritos' : 'Agregar a favoritos', onClick: () => alternarFavorito('documento', doc) },
    { etiqueta: 'Etiquetas…', onClick: () => setDocEtiquetas(doc) },
    ...(!doc.bloqueado_por_id ? [{ etiqueta: 'Bloquear para editar', onClick: () => bloquear(doc) }]
      : doc.bloqueado_por_id === user?.id || esAdministrador ? [{ etiqueta: 'Desbloquear', onClick: () => desbloquear(doc) }]
        : []),
    ...(esAdministrador ? [{ etiqueta: doc.restringido ? 'Cambiar acceso…' : 'Restringir acceso…', onClick: () => setDocAcceso(doc) }] : []),
  ];

  const bloquear = async (doc) => {
    try {
      await bloquearDocumento(doc.id);
      await cargarDocumentos();
      toast.success(`«${nombreDoc(doc)}» bloqueado: nadie más podrá cambiarlo hasta que lo desbloquees`);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'No se pudo bloquear.');
    }
  };

  const desbloquear = async (doc) => {
    try {
      await desbloquearDocumento(doc.id);
      await cargarDocumentos();
      toast.success(`«${nombreDoc(doc)}» desbloqueado`);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'No se pudo desbloquear.');
    }
  };

  const etiquetasPorId = useMemo(() => new Map(etiquetas.map((e) => [e.id, e])), [etiquetas]);
  const docsFavoritos = documentos.filter((d) => favoritos.has(`d:${d.id}`));
  const carpetasFavoritas = carpetas.filter((c) => favoritos.has(`c:${c.id}`));
  const totalFavoritos = carpetasFavoritas.length + docsFavoritos.length;
  const docsRecientes = recientes.map((id) => documentos.find((d) => d.id === id)).filter(Boolean);
  const etiquetaActual = etiquetasPorId.get(etiquetaVista);
  // Un enlace por elemento (el mas reciente) para la vista Compartidos
  const enlacesPorItem = useMemo(() => {
    const m = new Map();
    for (const e of compartidos.enlaces) {
      const clave = e.carpeta_id ? `c:${e.carpeta_id}` : `d:${e.documento_id}`;
      if (!m.has(clave)) m.set(clave, e);
    }
    return m;
  }, [compartidos.enlaces]);
  const gruposVista = vistaRapida === 'compartidos'
    ? [
      { titulo: 'Compartidos contigo', carpetas: [], documentos: documentos.filter((d) => compartidos.conmigo.includes(d.id)) },
      {
        titulo: 'Con enlace público',
        carpetas: carpetas.filter((c) => enlacesPorItem.has(`c:${c.id}`)),
        documentos: documentos.filter((d) => enlacesPorItem.has(`d:${d.id}`)),
      },
    ]
    : [{
      carpetas: vistaRapida === 'favoritos' ? carpetasFavoritas : [],
      documentos: { todos: documentos, favoritos: docsFavoritos, recientes: docsRecientes }[vistaRapida] || [],
    }];
  const enExplorador = !viendoPapelera && !viendoProyectos && !etiquetaActual && !vistaRapida;
  const bytesUsados = documentos.reduce((total, d) => total + (d.tamano || 0), 0);

  const cerrarAcceso = useCallback(() => setDocAcceso(null), []);

  const carpetasRaiz = arbol.hijos.get(null) || [];
  const hayModal = !!subidaLocal.revision || !!compartiendo || !!docEtiquetas || !!versionDocId || showNuevaCarpeta || !!carpetaEditandoColor || !!docAcceso;
  const accionesArbol = {
    onSeleccionar: (id) => {
      salirDeVistas();
      entrarCarpeta(id);
    },
    onToggle: toggleExpandida,
    onNuevaSubcarpeta: abrirNuevaCarpeta,
    onCambiarColor: abrirCambiarColor,
    onEliminar: handleEliminarCarpeta,
    onVerArchivo: setDocVisible,
  };

  // Filtro por etiqueta: en el panel lateral o, dentro de Archivos (sin panel), sobre el explorador
  const chipsEtiquetas = () => (
    etiquetas.map((e) => (
      <button
        key={e.id}
        className={`${styles.chipEtiqueta} ${etiquetaVista === e.id ? styles.chipActivo : ''}`}
        onClick={() => {
          const otra = etiquetaVista !== e.id;
          salirDeVistas();
          if (otra) setEtiquetaVista(e.id);
        }}
        aria-pressed={etiquetaVista === e.id}
        title={`${e.documentos} archivo${e.documentos === 1 ? '' : 's'}`}
      >
        <span className={styles.puntoEtiqueta} style={{ background: e.color }} />
        {e.nombre}
      </button>
    ))
  );

  return (
    <div className={`${styles.layout} ${conPanel ? '' : styles.layoutSinPanel} ${docVisible ? styles.layoutConVisor : ''}`}>
      {conPanel && (
        <aside className={styles.sidebar}>
          <nav className={styles.vistas} aria-label="Vistas">
            <button
              className={`${styles.entrada} ${vistaRapida === 'todos' ? styles.entradaActiva : ''}`}
              onClick={() => abrirVista('todos')}
              aria-pressed={vistaRapida === 'todos'}
            >
              <LayoutGrid size={16} />
              <span>Todos los archivos</span>
              {documentos.length > 0 && <small className={styles.cuenta}>{documentos.length}</small>}
            </button>
            <button
              className={`${styles.entrada} ${vistaRapida === 'recientes' ? styles.entradaActiva : ''}`}
              onClick={() => abrirVista('recientes')}
              aria-pressed={vistaRapida === 'recientes'}
            >
              <Clock size={16} />
              <span>Recientes</span>
            </button>
            <button
              className={`${styles.entrada} ${vistaRapida === 'favoritos' ? styles.entradaActiva : ''}`}
              onClick={() => abrirVista('favoritos')}
              aria-pressed={vistaRapida === 'favoritos'}
            >
              <Star size={16} />
              <span>Favoritos</span>
              {totalFavoritos > 0 && <small className={styles.cuenta}>{totalFavoritos}</small>}
            </button>
            <button
              className={`${styles.entrada} ${vistaRapida === 'compartidos' ? styles.entradaActiva : ''}`}
              onClick={() => abrirVista('compartidos')}
              aria-pressed={vistaRapida === 'compartidos'}
            >
              <Share2 size={16} />
              <span>Compartidos</span>
            </button>
            <button
              className={`${styles.entrada} ${vistaRapida === 'solicitudes' ? styles.entradaActiva : ''}`}
              onClick={() => abrirVista('solicitudes')}
              aria-pressed={vistaRapida === 'solicitudes'}
              title="Enlaces para que personas de afuera envíen archivos a una carpeta"
            >
              <Inbox size={16} />
              <span>Solicitudes</span>
            </button>
          </nav>

          <div className={styles.grupo}>
            <div className={styles.sidebarHeader}>
              <span>Carpetas</span>
              <button title="Nueva carpeta" aria-label="Nueva carpeta" onClick={() => abrirNuevaCarpeta(null)}>+</button>
            </div>
            {proyectosEquipo?.length > 0 && (
              <button
                className={`${styles.entrada} ${viendoProyectos ? styles.entradaActiva : ''}`}
                onClick={() => { salirDeVistas(); setViendoProyectos(true); setDocVisible(null); }}
                aria-pressed={viendoProyectos}
                title="Acceso directo a los documentos de cada proyecto del equipo"
              >
                <IconoCarpeta size={16} />
                <span>Proyectos</span>
                <small className={styles.cuenta}>{proyectosEquipo.length}</small>
              </button>
            )}
            {carpetasRaiz.length === 0 && (
              <p className={styles.sinCarpetas}>Aún no hay carpetas.</p>
            )}
            {carpetasRaiz.map((carpeta) => (
              <NodoCarpeta
                key={carpeta.id}
                carpeta={carpeta}
                arbol={arbol}
                carpetaActivaId={enExplorador ? carpetaActivaId : null}
                expandidas={expandidas}
                docActivoId={docVisible?.id}
                acciones={accionesArbol}
              />
            ))}
          </div>

          {etiquetas.length > 0 && (
            <div className={styles.grupo}>
              <div className={styles.sidebarHeader}><span>Etiquetas</span></div>
              <div className={styles.chips}>{chipsEtiquetas()}</div>
            </div>
          )}

          <div className={styles.pie}>
            <button
              className={`${styles.entrada} ${styles.entradaPapelera} ${viendoPapelera ? styles.entradaActiva : ''}`}
              onClick={() => { salirDeVistas(); setViendoPapelera(true); setDocVisible(null); }}
              aria-pressed={viendoPapelera}
            >
              <Trash2 size={16} />
              <span>Papelera</span>
              {enPapelera > 0 && <small className={styles.contador}>{enPapelera}</small>}
            </button>
            <p className={styles.uso}>
              {formatoTamano(bytesUsados)} en {documentos.length} archivo{documentos.length === 1 ? '' : 's'}
            </p>
          </div>
        </aside>
      )}

      <div className={styles.contenido}>
        {viendoProyectos ? (
          <CarpetaProyectos equipo={proyecto} proyectos={proyectosEquipo} onVolver={() => setViendoProyectos(false)} />
        ) : viendoPapelera ? (
          <Papelera
            proyectoId={proyecto.id}
            esAdministrador={esAdministrador}
            onCambio={alCambiarPapelera}
            onAbrir={abrirDesdePapelera}
          />
        ) : vistaRapida === 'solicitudes' ? (
          <Solicitudes enlaces={solicitudes} lugar={proyecto} onCambio={cargarSolicitudes} />
        ) : vistaRapida ? (
          <VistaAccesos
            tipo={vistaRapida}
            grupos={gruposVista}
            enlaces={enlacesPorItem}
            etiquetasPorId={etiquetasPorId}
            rutaDe={rutaDe}
            docActivoId={docVisible?.id}
            onAbrirCarpeta={accionesArbol.onSeleccionar}
            onAbrir={verDocumento}
            onCompartir={abrirCompartir}
          />
        ) : etiquetaActual ? (
          <VistaEtiqueta
            key={etiquetaActual.id}
            etiqueta={etiquetaActual}
            documentos={documentos.filter((d) => d.etiquetas?.includes(etiquetaActual.id))}
            etiquetasPorId={etiquetasPorId}
            rutaDe={rutaDe}
            docActivoId={docVisible?.id}
            onAbrir={verDocumento}
            onCambio={cargarEtiquetas}
            onEliminada={() => { setEtiquetaVista(null); cargarEtiquetas(); cargarDocumentos(); }}
          />
        ) : carpetaActivaId === null && !(enArchivos && carpetasRaiz.length > 0) ? (
          <div className={styles.vacio}>
            <p className={styles.vacioTitulo}>Crea una carpeta para empezar</p>
            <p className={styles.vacioTexto}>Los archivos se organizan en carpetas.</p>
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
              nombreRaiz={enArchivos ? (proyecto.tipo === 'personal' ? 'Mis archivos' : proyecto.nombre) : null}
              notaLugar={proyecto.tipo === 'personal' ? 'Solo tú lo ves, a menos que compartas algo.' : null}
              extraSubbarra={!conPanel && etiquetas.length > 0 ? chipsEtiquetas() : null}
              arbol={arbol}
              carpetasPorId={carpetasPorId}
              docActivoId={docVisible?.id}
              compacto={!!docVisible}
              atajosActivos={!hayModal}
              favoritos={favoritos}
              etiquetasPorId={etiquetasPorId}
              usuarioId={user?.id}
              esAdministrador={esAdministrador}
              navegacion={{
                entrar: entrarCarpeta,
                atras: () => moverEnHistorial(-1),
                adelante: () => moverEnHistorial(1),
                puedeAtras: historial.indice > 0,
                puedeAdelante: historial.indice < historial.pila.length - 1,
              }}
              acciones={{
                ver: (doc) => { setConVersiones(false); setConComentarios(false); setDocVisible(doc); },
                verVersiones: (doc) => { setConVersiones(true); setConComentarios(false); setDocVisible(doc); },
                cerrarVisor: () => setDocVisible(null),
                nuevaVersion: setVersionDocId,
                soltarArchivos: async (destino, entradas) => prepararSubida(destino, await leerEntradas(entradas)),
                elegirArchivos: (destino, lista) => prepararSubida(destino, leerSelector(lista)),
                crearCarpeta: crearCarpetaRapida,
                renombrar,
                cambiarColor,
                descargarZip,
                alternarFavorito,
                editarEtiquetas: setDocEtiquetas,
                bloquear,
                desbloquear,
                compartir: abrirCompartir,
                eliminarArchivo: handleEliminarDocumento,
                eliminarCarpeta: handleEliminarCarpeta,
                mover,
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
          onComentado={cargarDocumentos}
          mostrarVersiones={conVersiones}
          mostrarComentarios={conComentarios}
          menu={menuVisor(docVisible)}
          ubicacion={rutaDe(docVisible.carpeta_id).map((c) => c.nombre).join(' / ')}
          etiquetas={etiquetas}
        />
      )}

      {docAcceso && (
        <ModalAccesoDocumento
          documento={docAcceso}
          onClose={cerrarAcceso}
          onGuardado={() => { setDocAcceso(null); cargarDocumentos(); }}
        />
      )}

      {docEtiquetas && (
        <ModalEtiquetas
          documento={docEtiquetas}
          proyectoId={proyecto.id}
          etiquetas={etiquetas}
          onClose={() => setDocEtiquetas(null)}
          onEtiquetaCreada={(nueva) => setEtiquetas((prev) => [...prev, nueva].sort((a, b) => a.nombre.localeCompare(b.nombre)))}
          onGuardado={() => { setDocEtiquetas(null); cargarDocumentos(); cargarEtiquetas(); }}
        />
      )}

      {compartiendo && (
        <ModalCompartir
          objetivo={compartiendo}
          onClose={() => { setCompartiendo(null); if (vistaRapida === 'compartidos') cargarCompartidos(); }}
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
