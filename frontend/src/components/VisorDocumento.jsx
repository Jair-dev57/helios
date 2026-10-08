import { useEffect, useRef, useState } from 'react';
import { X, Download, History, RotateCcw } from 'lucide-react';
import toast from 'react-hot-toast';
import { descargarArchivoDocumento, listarVersiones, descargarVersion, restaurarVersion } from '../api/documentos';
import { fechaRelativa, fechaCompleta, formatoTamano } from '../pages/Proyectos/formato';
import IconoArchivo from './IconoArchivo';
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

/** Lista de versiones del archivo: elegir una la muestra en el visor; restaurar crea una version nueva */
function PanelVersiones({ versiones, vista, puedeRestaurar, restaurando, onVer, onDescargar, onRestaurar }) {
  if (!versiones) return <p className={styles.versionesEstado}>Cargando versiones…</p>;
  return (
    <ol className={styles.versiones} aria-label="Versiones">
      {versiones.map((v) => {
        const seleccionada = vista ? vista.numero === v.numero : v.actual;
        return (
          <li key={v.numero} className={seleccionada ? styles.versionSeleccionada : ''}>
            <button
              className={styles.versionInfo}
              onClick={() => onVer(v)}
              disabled={!v.disponible}
              aria-current={seleccionada || undefined}
            >
              <span className={styles.versionNumero}>v{v.numero}</span>
              <span className={styles.versionTexto}>
                <span>
                  <span title={fechaCompleta(v.fecha)}>{fechaRelativa(v.fecha)}</span>
                  {v.autor && ` · ${v.autor}`}
                  {v.actual && <span className={styles.etiquetaActual}>Actual</span>}
                </span>
                <small>
                  {v.disponible ? formatoTamano(v.tamano) : 'Archivo no disponible'}
                  {v.notas && ` · ${v.notas}`}
                </small>
              </span>
            </button>
            {v.disponible && (
              <span className={styles.versionAcciones}>
                <button className={styles.iconBtn} onClick={() => onDescargar(v)} title="Descargar esta versión" aria-label={`Descargar versión ${v.numero}`}>
                  <Download size={15} />
                </button>
                {puedeRestaurar && !v.actual && (
                  <button
                    className={styles.iconBtn}
                    onClick={() => onRestaurar(v)}
                    disabled={restaurando}
                    title="Restaurar esta versión"
                    aria-label={`Restaurar versión ${v.numero}`}
                  >
                    <RotateCcw size={15} />
                  </button>
                )}
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

/**
 * Vista previa del archivo. Con onRestaurado (la pagina recarga el documento) se pueden restaurar versiones;
 * mostrarVersiones abre el panel de versiones al entrar.
 */
export default function VisorDocumento({ documento, onClose, onRestaurado, mostrarVersiones = false }) {
  const [verVersiones, setVerVersiones] = useState(mostrarVersiones);
  const [versiones, setVersiones] = useState(null);
  // Version anterior que se esta mirando (null = la actual)
  const [versionVista, setVersionVista] = useState(null);
  const [restaurando, setRestaurando] = useState(false);

  const tipo = versionVista?.extension || documento.tipo;
  const vista = tipoVista(tipo);
  const nombreArchivo = versionVista
    ? `${documento.nombre} (v${versionVista.numero}).${tipo}`
    : `${documento.nombre}.${documento.tipo}`;

  const [blob, setBlob] = useState(null);
  const [contenido, setContenido] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Otro archivo, o pidieron abrirlo con las versiones a la vista
  useEffect(() => {
    setVersionVista(null);
    setVerVersiones(mostrarVersiones);
  }, [documento.id, mostrarVersiones]);

  // La lista se pide al abrir el panel y cada vez que cambia la version actual
  useEffect(() => {
    if (!verVersiones) return undefined;
    let cancelado = false;
    setVersiones(null);
    listarVersiones(documento.id)
      .then((lista) => { if (!cancelado) setVersiones(lista); })
      .catch(() => { if (!cancelado) setVersiones([]); });
    return () => { cancelado = true; };
  }, [verVersiones, documento.id, documento.version_actual]);

  useEffect(() => {
    let cancelado = false;
    let objectUrl = null;
    setBlob(null);
    setContenido(null);
    setError(false);
    const descarga = versionVista
      ? descargarVersion(documento.id, versionVista.numero)
      : descargarArchivoDocumento(documento.id);
    descarga
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
  // La ruta cambia al subir una version nueva: se vuelve a descargar
  }, [documento.id, documento.ruta, vista, versionVista]);

  const descargar = () => blob && guardarArchivo(blob, nombreArchivo);

  const verVersion = (v) => setVersionVista(v.actual ? null : v);

  const descargarUnaVersion = async (v) => {
    try {
      const datos = v.actual ? await descargarArchivoDocumento(documento.id) : await descargarVersion(documento.id, v.numero);
      guardarArchivo(datos, v.actual ? `${documento.nombre}.${documento.tipo}` : `${documento.nombre} (v${v.numero}).${v.extension || documento.tipo}`);
    } catch (err) {
      toast.error('No se pudo descargar esa versión.');
    }
  };

  const restaurar = async (v) => {
    setRestaurando(true);
    try {
      const doc = await restaurarVersion(documento.id, v.numero);
      setVersionVista(null);
      await onRestaurado(doc);
      toast.success(doc.version_actual === documento.version_actual
        ? 'Esa versión es igual a la actual'
        : `Se restauró la v${v.numero} como v${doc.version_actual}`);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'No se pudo restaurar la versión.');
    } finally {
      setRestaurando(false);
    }
  };

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
            <p>La vista previa no está disponible para archivos .{tipo}.</p>
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
          <IconoArchivo tipo={tipo} />
          <strong>{documento.nombre}</strong>
          <span>.{tipo} · v{versionVista ? versionVista.numero : documento.version_actual}</span>
        </div>
        <div className={styles.acciones}>
          <button
            className={`${styles.iconBtn} ${verVersiones ? styles.iconBtnActivo : ''}`}
            onClick={() => setVerVersiones((v) => !v)}
            title="Versiones"
            aria-label="Versiones del archivo"
            aria-pressed={verVersiones}
          >
            <History size={17} />
          </button>
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
      {verVersiones && (
        <PanelVersiones
          versiones={versiones}
          vista={versionVista}
          puedeRestaurar={!!onRestaurado}
          restaurando={restaurando}
          onVer={verVersion}
          onDescargar={descargarUnaVersion}
          onRestaurar={restaurar}
        />
      )}
      {versionVista && (
        <div className={styles.avisoVersion} role="status">
          <span>
            Estás viendo la <strong>v{versionVista.numero}</strong>, de {fechaCompleta(versionVista.fecha)}
            {versionVista.autor && ` (${versionVista.autor})`}.
          </span>
          <span className={styles.avisoAcciones}>
            {onRestaurado && (
              <button onClick={() => restaurar(versionVista)} disabled={restaurando}>
                {restaurando ? 'Restaurando…' : 'Restaurar esta versión'}
              </button>
            )}
            <button onClick={() => setVersionVista(null)}>Volver a la actual</button>
          </span>
        </div>
      )}
      <div className={styles.cuerpo} key={`${documento.id}-${versionVista?.numero ?? 'actual'}`}>{renderCuerpo()}</div>
    </aside>
  );
}
