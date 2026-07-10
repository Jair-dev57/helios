import { useState, useEffect, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  listarDocumentos,
  subirDocumento,
  subirVersionDocumento,
  eliminarDocumento,
} from '../../api/documentos';
import styles from './ProyectoDocumentos.module.css';

export default function ProyectoDocumentos() {
  const { proyecto } = useOutletContext();
  const [documentos, setDocumentos] = useState([]);
  const [loading, setLoading] = useState(true);

  const [showUpload, setShowUpload] = useState(false);
  const [nombreDoc, setNombreDoc] = useState('');
  const [archivo, setArchivo] = useState(null);
  const [subiendo, setSubiendo] = useState(false);

  const [versionDocId, setVersionDocId] = useState(null);
  const [archivoVersion, setArchivoVersion] = useState(null);
  const [notasVersion, setNotasVersion] = useState('');

  const cargar = useCallback(async () => {
    try {
      setLoading(true);
      const data = await listarDocumentos(proyecto.id);
      setDocumentos(data);
    } finally {
      setLoading(false);
    }
  }, [proyecto.id]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const handleSubir = async () => {
    if (!nombreDoc.trim() || !archivo) return;
    try {
      setSubiendo(true);
      const formData = new FormData();
      formData.append('nombre', nombreDoc);
      formData.append('proyecto_id', proyecto.id);
      formData.append('archivo', archivo);
      await subirDocumento(formData);
      setNombreDoc('');
      setArchivo(null);
      setShowUpload(false);
      cargar();
    } catch (err) {
      alert('No se pudo subir el documento.');
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
      cargar();
    } catch (err) {
      alert('No se pudo subir la versión.');
    } finally {
      setSubiendo(false);
    }
  };

  const handleEliminar = async (id) => {
    if (!confirm('¿Eliminar este documento y todas sus versiones?')) return;
    try {
      await eliminarDocumento(id);
      setDocumentos((prev) => prev.filter((d) => d.id !== id));
    } catch (err) {
      alert('No se pudo eliminar.');
    }
  };

  return (
    <div>
      <div className={styles.header}>
        <h2 className={styles.titulo}>Documentos del proyecto</h2>
        <button className={styles.btnPrimario} onClick={() => setShowUpload(true)}>
          + Subir documento
        </button>
      </div>

      {loading ? (
        <p className={styles.mensaje}>Cargando...</p>
      ) : documentos.length === 0 ? (
        <p className={styles.mensaje}>Este proyecto aún no tiene documentos.</p>
      ) : (
        <table className={styles.tabla}>
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
                <td className={styles.acciones}>
                  <a href={doc.ruta} target="_blank" rel="noreferrer" className={styles.link}>
                    Ver
                  </a>
                  <button className={styles.linkBtn} onClick={() => setVersionDocId(doc.id)}>
                    Nueva versión
                  </button>
                  <button className={styles.linkBtnDanger} onClick={() => handleEliminar(doc.id)}>
                    Eliminar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {showUpload && (
        <div className={styles.overlay} onClick={() => setShowUpload(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3>Subir documento</h3>
            <label className={styles.label}>Nombre</label>
            <input
              className={styles.input}
              value={nombreDoc}
              onChange={(e) => setNombreDoc(e.target.value)}
              placeholder="Nombre del documento"
            />
            <label className={styles.label}>Archivo</label>
            <input
              type="file"
              className={styles.input}
              onChange={(e) => setArchivo(e.target.files[0] || null)}
            />
            <div className={styles.modalAcciones}>
              <button className={styles.btnSecundario} onClick={() => setShowUpload(false)}>
                Cancelar
              </button>
              <button
                className={styles.btnPrimario}
                onClick={handleSubir}
                disabled={subiendo || !nombreDoc.trim() || !archivo}
              >
                {subiendo ? 'Subiendo...' : 'Subir'}
              </button>
            </div>
          </div>
        </div>
      )}

      {versionDocId && (
        <div className={styles.overlay} onClick={() => setVersionDocId(null)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3>Nueva versión</h3>
            <label className={styles.label}>Archivo</label>
            <input
              type="file"
              className={styles.input}
              onChange={(e) => setArchivoVersion(e.target.files[0] || null)}
            />
            <label className={styles.label}>Notas (opcional)</label>
            <input
              className={styles.input}
              value={notasVersion}
              onChange={(e) => setNotasVersion(e.target.value)}
              placeholder="¿Qué cambió?"
            />
            <div className={styles.modalAcciones}>
              <button className={styles.btnSecundario} onClick={() => setVersionDocId(null)}>
                Cancelar
              </button>
              <button
                className={styles.btnPrimario}
                onClick={handleSubirVersion}
                disabled={subiendo || !archivoVersion}
              >
                {subiendo ? 'Subiendo...' : 'Subir versión'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}