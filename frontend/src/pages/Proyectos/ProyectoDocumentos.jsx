import { useState, useEffect, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import toast from 'react-hot-toast';
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
import shared from '../../styles/shared.module.css';
import styles from './ProyectoDocumentos.module.css';

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
          📁 {carpeta.nombre}
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

  const [versionDocId, setVersionDocId] = useState(null);
  const [archivoVersion, setArchivoVersion] = useState(null);
  const [notasVersion, setNotasVersion] = useState('');

  const [showNuevaCarpeta, setShowNuevaCarpeta] = useState(false);
  const [carpetaPadreNueva, setCarpetaPadreNueva] = useState(null);
  const [nombreCarpeta, setNombreCarpeta] = useState('');

  const cargarCarpetas = useCallback(async () => {
    const data = await listarCarpetas(proyecto.id);
    setCarpetas(data);
  }, [proyecto.id]);

  const cargarDocumentos = useCallback(async () => {
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
    setShowNuevaCarpeta(true);
  };

  const handleCrearCarpeta = async () => {
    if (!nombreCarpeta.trim()) return;
    try {
      await crearCarpeta({
        nombre: nombreCarpeta,
        proyecto_id: proyecto.id,
        carpeta_padre_id: carpetaPadreNueva,
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
    if (!confirm('¿Eliminar esta carpeta y sus subcarpetas? Los documentos dentro no se eliminan, quedan sin carpeta.')) return;
    try {
      await eliminarCarpeta(id);
      if (carpetaActivaId === id) setCarpetaActivaId(null);
      cargarCarpetas();
      toast.success('Carpeta eliminada');
    } catch (err) {
      toast.error('No se pudo eliminar la carpeta.');
    }
  };

  const handleSubir = async () => {
    if (!nombreDoc.trim() || !archivo) return;
    try {
      setSubiendo(true);
      const formData = new FormData();
      formData.append('nombre', nombreDoc);
      formData.append('proyecto_id', proyecto.id);
      if (carpetaActivaId) formData.append('carpeta_id', carpetaActivaId);
      formData.append('archivo', archivo);
      await subirDocumento(formData);
      setNombreDoc('');
      setArchivo(null);
      setShowUpload(false);
      cargarDocumentos();
      toast.success('Documento subido');
    } catch (err) {
      toast.error('No se pudo subir el documento.');
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
    if (!confirm('¿Eliminar este documento y todas sus versiones?')) return;
    try {
      await eliminarDocumento(id);
      setDocumentos((prev) => prev.filter((d) => d.id !== id));
      toast.success('Documento eliminado');
    } catch (err) {
      toast.error('No se pudo eliminar.');
    }
  };

  const carpetasRaiz = carpetas.filter((c) => c.carpeta_padre_id === null);
  const nombreCarpetaActiva = carpetaActivaId
    ? carpetas.find((c) => c.id === carpetaActivaId)?.nombre
    : 'Raíz del proyecto';

  return (
    <div className={styles.layout}>
      <aside className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <span>Carpetas</span>
          <button title="Nueva carpeta" onClick={() => abrirNuevaCarpeta(null)}>+</button>
        </div>
        <div
          className={`${styles.nodo} ${carpetaActivaId === null ? styles.nodoActivo : ''}`}
          onClick={() => setCarpetaActivaId(null)}
        >
          <span className={styles.toggleVacio} />
          <span className={styles.nodoNombre}>🏠 Raíz del proyecto</span>
        </div>
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
        <div className={styles.header}>
          <h2 className={styles.titulo}>{nombreCarpetaActiva}</h2>
          <button className={shared.btnPrimary} onClick={() => setShowUpload(true)}>
            + Subir documento
          </button>
        </div>

        {loading ? (
          <p className={shared.loadingText}>Cargando...</p>
        ) : documentos.length === 0 ? (
          <p className={shared.emptyText}>No hay documentos en esta ubicación.</p>
        ) : (
          <table className={shared.table}>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Tipo</th>
                <th>Versión</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {documentos.map((doc) => (
                <tr key={doc.id}>
                  <td>{doc.nombre}</td>
                  <td>{doc.tipo}</td>
                  <td>v{doc.version_actual}</td>
                  <td className={shared.tableActions}>
                    <a href={doc.ruta} target="_blank" rel="noreferrer" className={shared.linkBtn}>Ver</a>
                    <button className={shared.linkBtn} onClick={() => setVersionDocId(doc.id)}>Nueva versión</button>
                    <button className={`${shared.linkBtn} ${shared.linkBtnDanger}`} onClick={() => handleEliminarDocumento(doc.id)}>Eliminar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showUpload && (
        <div className={shared.overlay} onClick={() => setShowUpload(false)}>
          <div className={shared.modal} onClick={(e) => e.stopPropagation()}>
            <h3 className={shared.modalTitle}>Subir documento</h3>
            <p className={styles.modalContexto}>Se subirá en: <strong>{nombreCarpetaActiva}</strong></p>
            <div className={shared.field}>
              <label>Nombre</label>
              <input value={nombreDoc} onChange={(e) => setNombreDoc(e.target.value)} placeholder="Nombre del documento" />
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