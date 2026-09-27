import { useState, useEffect, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Eye, Upload, Trash2, Folder, Check } from 'lucide-react';
import {
  listarDocumentos,
  subirDocumento,
  subirVersionDocumento,
  eliminarDocumento,
} from '../../api/documentos';
import {
  listarCarpetas,
  crearCarpeta,
  eliminarCarpeta,
} from '../../api/carpetas';
import VisorDocumento from '../../components/VisorDocumento';
import IconoArchivo from '../../components/IconoArchivo';
import shared from '../../styles/shared.module.css';
import styles from './ProyectoDocumentos.module.css';

// El primero es el color por defecto (el mismo que pone la base de datos)
const COLORES_CARPETA = [
  { valor: '#eab308', nombre: 'Amarillo' },
  { valor: '#f97316', nombre: 'Naranja' },
  { valor: '#ef4444', nombre: 'Rojo' },
  { valor: '#ec4899', nombre: 'Rosa' },
  { valor: '#a855f7', nombre: 'Morado' },
  { valor: '#3b82f6', nombre: 'Azul' },
  { valor: '#14b8a6', nombre: 'Turquesa' },
  { valor: '#22c55e', nombre: 'Verde' },
  { valor: '#64748b', nombre: 'Gris' },
];
const COLOR_CARPETA_DEFECTO = COLORES_CARPETA[0].valor;

function NodoCarpeta({ carpeta, carpetas, nivel, carpetaActivaId, expandidas, onSeleccionar, onToggle, onNuevaSubcarpeta, onEliminar }) {
  const hijos = carpetas.filter((c) => c.carpeta_padre_id === carpeta.id);
  const expandida = expandidas.has(carpeta.id);
  const activa = carpetaActivaId === carpeta.id;

  return (
    <div>
      <div
        className={`${styles.nodo} ${activa ? styles.nodoActivo : ''}`}
        style={{ paddingLeft: `${nivel * 16 + 8}px` }}
      >
        {hijos.length > 0 ? (
          <button className={styles.toggle} onClick={() => onToggle(carpeta.id)}>
            {expandida ? '▾' : '▸'}
          </button>
        ) : (
          <span className={styles.toggleVacio} />
        )}
        <span className={styles.nodoNombre} onClick={() => onSeleccionar(carpeta.id)}>
          <Folder
            size={15}
            className={styles.iconoCarpeta}
            color={carpeta.color || COLOR_CARPETA_DEFECTO}
            fill={carpeta.color || COLOR_CARPETA_DEFECTO}
            fillOpacity={0.3}
          />
          <span className={styles.nodoTexto}>{carpeta.nombre}</span>
        </span>
        <div className={styles.nodoAcciones}>
          <button title="Nueva subcarpeta" onClick={() => onNuevaSubcarpeta(carpeta.id)}>+</button>
          <button title="Eliminar carpeta" onClick={() => onEliminar(carpeta.id)}>×</button>
        </div>
      </div>
      {expandida && hijos.map((hijo) => (
        <NodoCarpeta
          key={hijo.id}
          carpeta={hijo}
          carpetas={carpetas}
          nivel={nivel + 1}
          carpetaActivaId={carpetaActivaId}
          expandidas={expandidas}
          onSeleccionar={onSeleccionar}
          onToggle={onToggle}
          onNuevaSubcarpeta={onNuevaSubcarpeta}
          onEliminar={onEliminar}
        />
      ))}
    </div>
  );
}

const formatoFecha = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });
const formatoFechaHora = new Intl.DateTimeFormat('es-CO', { dateStyle: 'long', timeStyle: 'short' });
const formatoRelativo = new Intl.RelativeTimeFormat('es', { numeric: 'auto' });

// "hace 5 minutos", "ayer", "hace 3 días"; pasada una semana, la fecha corta
function fechaRelativa(fechaIso) {
  const segundos = (new Date(fechaIso) - Date.now()) / 1000;
  const abs = Math.abs(segundos);
  if (abs < 60) return 'hace un momento';
  if (abs < 3600) return formatoRelativo.format(Math.round(segundos / 60), 'minute');
  if (abs < 86400) return formatoRelativo.format(Math.round(segundos / 3600), 'hour');
  if (abs < 7 * 86400) return formatoRelativo.format(Math.round(segundos / 86400), 'day');
  return formatoFecha.format(new Date(fechaIso));
}

function formatoTamano(bytes) {
  if (bytes == null) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ProyectoDocumentos() {
  const { proyecto } = useOutletContext();
  const [carpetas, setCarpetas] = useState([]);
  const [documentos, setDocumentos] = useState([]);
  const [loading, setLoading] = useState(true);

  const [carpetaActivaId, setCarpetaActivaId] = useState(null);
  const [expandidas, setExpandidas] = useState(new Set());

  const [showUpload, setShowUpload] = useState(false);
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

  const cargarCarpetas = useCallback(async () => {
    const data = await listarCarpetas(proyecto.id);
    setCarpetas(data);
  }, [proyecto.id]);

  const cargarDocumentos = useCallback(async () => {
    if (carpetaActivaId === null) {
      setDocumentos([]);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const data = await listarDocumentos(proyecto.id, carpetaActivaId);
      setDocumentos(data);
    } finally {
      setLoading(false);
    }
  }, [proyecto.id, carpetaActivaId]);

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
  }, [carpetas, carpetaActivaId]);

  const toggleExpandida = (id) => {
    setExpandidas((prev) => {
      const nuevo = new Set(prev);
      nuevo.has(id) ? nuevo.delete(id) : nuevo.add(id);
      return nuevo;
    });
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

  const handleSubir = async () => {
    if (!nombreDoc.trim() || !archivo || !carpetaActivaId) return;
    try {
      setSubiendo(true);
      const formData = new FormData();
      formData.append('nombre', nombreDoc);
      formData.append('proyecto_id', proyecto.id);
      formData.append('carpeta_id', carpetaActivaId);
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

  const carpetasRaiz = carpetas.filter((c) => c.carpeta_padre_id === null);
  const nombreCarpetaActiva = carpetas.find((c) => c.id === carpetaActivaId)?.nombre;

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
            carpetas={carpetas}
            nivel={0}
            carpetaActivaId={carpetaActivaId}
            expandidas={expandidas}
            onSeleccionar={setCarpetaActivaId}
            onToggle={toggleExpandida}
            onNuevaSubcarpeta={abrirNuevaCarpeta}
            onEliminar={handleEliminarCarpeta}
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
          <>
            <div className={styles.header}>
              <h2 className={styles.titulo}>{nombreCarpetaActiva}</h2>
              <button className={shared.btnPrimary} onClick={() => setShowUpload(true)}>
                + Subir archivo
              </button>
            </div>

            {loading ? (
              <p className={shared.loadingText}>Cargando...</p>
            ) : documentos.length === 0 ? (
              <p className={shared.emptyText}>Esta carpeta está vacía.</p>
            ) : (
              <div className={shared.tableWrapper}>
                {/* Con el visor abierto la lista es angosta: se ocultan Por y Tamaño */}
                <table className={`${shared.table} ${styles.tablaArchivos} ${docVisible ? styles.tablaCompacta : ''}`}>
                  <colgroup>
                    <col className={styles.colNombre} />
                    <col className={styles.colTipo} />
                    <col className={styles.colModificado} />
                    {!docVisible && <col className={styles.colPor} />}
                    {!docVisible && <col className={styles.colTamano} />}
                    <col className={styles.colAcciones} />
                  </colgroup>
                  <thead>
                    <tr>
                      <th>Nombre</th>
                      <th>Tipo</th>
                      <th>Modificado</th>
                      {!docVisible && <th>Por</th>}
                      {!docVisible && <th>Tamaño</th>}
                      <th className={styles.thAcciones}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {documentos.map((doc) => (
                      <tr
                        key={doc.id}
                        className={`${styles.fila} ${docVisible?.id === doc.id ? styles.filaActiva : ''}`}
                        onClick={() => setDocVisible(doc)}
                      >
                        <td>
                          <div className={styles.nombreArchivo}>
                            <span className={styles.nombreTexto}>{doc.nombre}</span>
                            {doc.version_actual > 1 && (
                              <span className={styles.version}>v{doc.version_actual}</span>
                            )}
                          </div>
                        </td>
                        <td>
                          <IconoArchivo tipo={doc.tipo} size={30} />
                        </td>
                        <td title={formatoFechaHora.format(new Date(doc.updated_at))}>
                          {fechaRelativa(doc.updated_at)}
                        </td>
                        {!docVisible && (
                          <>
                            <td>
                              {doc.modificado_por ? (
                                <div className={styles.autor}>
                                  <span className={styles.avatar}>{doc.modificado_por.charAt(0).toUpperCase()}</span>
                                  <span className={styles.autorNombre}>{doc.modificado_por}</span>
                                </div>
                              ) : '—'}
                            </td>
                            <td>{formatoTamano(doc.tamano)}</td>
                          </>
                        )}
                        <td>
                          <div className={shared.iconBtnGroup} onClick={(e) => e.stopPropagation()}>
                            <button
                              className={shared.iconBtn}
                              onClick={() => setDocVisible(doc)}
                              title="Ver"
                              aria-label="Ver archivo"
                            >
                              <Eye size={15} />
                            </button>
                            <button
                              className={shared.iconBtn}
                              onClick={() => setVersionDocId(doc.id)}
                              title="Nueva versión"
                              aria-label="Subir nueva versión"
                            >
                              <Upload size={15} />
                            </button>
                            <button
                              className={`${shared.iconBtn} ${shared.iconBtnDanger}`}
                              onClick={() => handleEliminarDocumento(doc.id)}
                              title="Eliminar"
                              aria-label="Eliminar archivo"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>

      {docVisible && (
        <VisorDocumento documento={docVisible} onClose={() => setDocVisible(null)} />
      )}

      {showUpload && (
        <div className={shared.overlay} onClick={() => setShowUpload(false)}>
          <div className={shared.modal} onClick={(e) => e.stopPropagation()}>
            <h3 className={shared.modalTitle}>Subir archivo</h3>
            <p className={styles.modalContexto}>Se subirá en: <strong>{nombreCarpetaActiva}</strong></p>
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
              <div className={styles.paleta} role="radiogroup" aria-label="Color de la carpeta">
                {COLORES_CARPETA.map((c) => (
                  <button
                    key={c.valor}
                    type="button"
                    role="radio"
                    aria-checked={colorCarpeta === c.valor}
                    aria-label={c.nombre}
                    title={c.nombre}
                    className={`${styles.muestraColor} ${colorCarpeta === c.valor ? styles.muestraActiva : ''}`}
                    style={{ background: c.valor }}
                    onClick={() => setColorCarpeta(c.valor)}
                  >
                    {colorCarpeta === c.valor && <Check size={14} strokeWidth={3} />}
                  </button>
                ))}
              </div>
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
    </div>
  );
}
