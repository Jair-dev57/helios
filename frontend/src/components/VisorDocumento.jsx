import { useEffect, useRef, useState } from 'react';
import { X, Download } from 'lucide-react';
import { descargarArchivoDocumento } from '../api/documentos';
import styles from './VisorDocumento.module.css';

const IMAGENES = ['png', 'jpg', 'jpeg'];
const HOJAS = ['xlsx', 'xls', 'csv'];

function tipoVista(tipo) {
  const t = (tipo || '').toLowerCase();
  if (t === 'pdf') return 'pdf';
  if (IMAGENES.includes(t)) return 'imagen';
  if (t === 'txt') return 'texto';
  if (HOJAS.includes(t)) return 'hoja';
  if (t === 'docx') return 'docx';
  return 'no-soportado';
}

function guardarArchivo(blob, nombreArchivo) {
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = objectUrl;
  a.download = nombreArchivo;
  a.click();
  URL.revokeObjectURL(objectUrl);
}

function VistaHoja({ buffer }) {
  const [hojas, setHojas] = useState(null);
  const [activa, setActiva] = useState(0);

  useEffect(() => {
    let cancelado = false;
    import('xlsx').then((XLSX) => {
      const libro = XLSX.read(buffer, { type: 'array' });
      const datos = libro.SheetNames.map((nombre) => ({
        nombre,
        filas: XLSX.utils.sheet_to_json(libro.Sheets[nombre], { header: 1, defval: '' }),
      }));
      if (!cancelado) setHojas(datos);
    });
    return () => { cancelado = true; };
  }, [buffer]);

  if (!hojas) return <p className={styles.mensaje}>Cargando hoja de cálculo...</p>;

  const filas = hojas[activa]?.filas ?? [];
  return (
    <div className={styles.hoja}>
      {hojas.length > 1 && (
        <div className={styles.pestanas}>
          {hojas.map((h, i) => (
            <button
              key={h.nombre}
              className={i === activa ? styles.pestanaActiva : ''}
              onClick={() => setActiva(i)}
            >
              {h.nombre}
            </button>
          ))}
        </div>
      )}
      <div className={styles.tablaScroll}>
        {filas.length === 0 ? (
          <p className={styles.mensaje}>Hoja vacía.</p>
        ) : (
          <table className={styles.tabla}>
            <tbody>
              {filas.map((fila, i) => (
                <tr key={i}>
                  {fila.map((celda, j) => <td key={j}>{String(celda)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function VistaDocx({ buffer }) {
  const contenedor = useRef(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    import('docx-preview')
      .then(({ renderAsync }) => renderAsync(buffer, contenedor.current, null, { inWrapper: true }))
      .catch(() => setError(true));
  }, [buffer]);

  if (error) return <p className={styles.mensaje}>No se pudo mostrar el documento.</p>;
  return <div ref={contenedor} className={styles.docx} />;
}

export default function VisorDocumento({ documento, onClose }) {
  const vista = tipoVista(documento.tipo);
  const nombreArchivo = `${documento.nombre}.${documento.tipo}`;

  const [blob, setBlob] = useState(null);
  const [contenido, setContenido] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    let cancelado = false;
    let objectUrl = null;
    setBlob(null);
    setContenido(null);
    setError(false);
    descargarArchivoDocumento(documento.ruta)
      .then(async (data) => {
        let resultado = null;
        if (vista === 'pdf' || vista === 'imagen') {
          objectUrl = URL.createObjectURL(data);
          resultado = objectUrl;
        } else if (vista === 'texto') {
          resultado = await data.text();
        } else if (vista === 'hoja' || vista === 'docx') {
          resultado = await data.arrayBuffer();
        }
        if (cancelado) return;
        setBlob(data);
        setContenido(resultado);
      })
      .catch(() => { if (!cancelado) setError(true); });
    return () => {
      cancelado = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [documento.ruta, vista]);

  const descargar = () => blob && guardarArchivo(blob, nombreArchivo);

  const renderCuerpo = () => {
    if (error) return <p className={styles.mensaje}>No se pudo cargar el archivo.</p>;
    if (!blob) return <p className={styles.mensaje}>Cargando...</p>;
    switch (vista) {
      case 'pdf':
        return <iframe className={styles.iframe} src={contenido} title={documento.nombre} />;
      case 'imagen':
        return <div className={styles.imagenWrap}><img src={contenido} alt={documento.nombre} /></div>;
      case 'texto':
        return <pre className={styles.texto}>{contenido}</pre>;
      case 'hoja':
        return <VistaHoja buffer={contenido} />;
      case 'docx':
        return <VistaDocx buffer={contenido} />;
      default:
        return (
          <div className={styles.mensaje}>
            <p>La vista previa no está disponible para archivos .{documento.tipo}.</p>
            <button className={styles.btnDescargar} onClick={descargar}>
              <Download size={15} /> Descargar
            </button>
          </div>
        );
    }
  };

  return (
    <aside className={styles.visor}>
      <header className={styles.header}>
        <div className={styles.titulo}>
          <strong>{documento.nombre}</strong>
          <span>.{documento.tipo} · v{documento.version_actual}</span>
        </div>
        <div className={styles.acciones}>
          <button
            className={styles.iconBtn}
            onClick={descargar}
            disabled={!blob}
            title="Descargar"
            aria-label="Descargar documento"
          >
            <Download size={17} />
          </button>
          <button className={styles.iconBtn} onClick={onClose} title="Cerrar" aria-label="Cerrar visor">
            <X size={18} />
          </button>
        </div>
      </header>
      <div className={styles.cuerpo} key={documento.id}>{renderCuerpo()}</div>
    </aside>
  );
}
