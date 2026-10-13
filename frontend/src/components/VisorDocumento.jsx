import { useEffect, useRef, useState } from 'react';
import {
  X, Download, RotateCcw, Eye, Lock, MoreHorizontal, ChevronDown, Maximize2, Minimize2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { descargarArchivoDocumento, listarVersiones, descargarVersion, restaurarVersion } from '../api/documentos';
import { fechaRelativa, fechaCompleta, formatoTamano, nombreArchivo, claseArchivo } from '../pages/Proyectos/formato';
import IconoArchivo from './IconoArchivo';
import ComentariosDocumento from './ComentariosDocumento';
import { useAuth } from '../hooks/useAuth';
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

function guardarArchivo(blob, nombre) {
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = objectUrl;
  a.download = nombre;
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

/** Linea de tiempo de versiones: la actual arriba; Ver la abre en la vista previa, Restaurar crea una version nueva */
function HistorialVersiones({ versiones, vista, puedeRestaurar, restaurando, onVer, onDescargar, onRestaurar }) {
  if (!versiones) return <p className={styles.mensaje}>Cargando versiones…</p>;
  if (!versiones.length) return <p className={styles.mensaje}>Este archivo no tiene versiones guardadas.</p>;
  return (
    <ol className={styles.historial} aria-label="Versiones">
      {versiones.map((v) => {
        const seleccionada = vista ? vista.numero === v.numero : v.actual;
        return (
          <li key={v.numero} className={`${v.actual ? styles.hitoActual : ''} ${seleccionada ? styles.hitoSeleccionado : ''}`}>
            <span className={styles.punto} aria-hidden="true" />
            <div className={styles.hito}>
              <div className={styles.hitoCabecera}>
                <strong>v{v.numero}</strong>
                {v.actual && <span className={styles.etiquetaActual}>Actual</span>}
                <span className={styles.hitoQuien}>
                  {v.autor || 'Alguien'} · <span title={fechaCompleta(v.fecha)}>{fechaRelativa(v.fecha)}</span>
                </span>
                <small>{v.disponible ? formatoTamano(v.tamano) : 'No disponible'}</small>
              </div>
              {v.notas && <p className={styles.hitoNota}>{v.notas}</p>}
              {v.disponible && (
                <div className={styles.hitoAcciones}>
                  <button className={styles.boton} onClick={() => onVer(v)} aria-current={seleccionada || undefined}>
                    <Eye size={14} /> Ver
                  </button>
                  <button className={styles.boton} onClick={() => onDescargar(v)}>
                    <Download size={14} /> Descargar
                  </button>
                  {puedeRestaurar && !v.actual && (
                    <button className={styles.boton} onClick={() => onRestaurar(v)} disabled={restaurando}>
                      <RotateCcw size={14} /> Restaurar
                    </button>
                  )}
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/** Menu desplegable que se cierra al hacer clic fuera o con Escape */
function useMenu() {
  const [abierto, setAbierto] = useState(false);
  useEffect(() => {
    if (!abierto) return undefined;
    const cerrar = () => setAbierto(false);
    const conTecla = (e) => e.key === 'Escape' && cerrar();
    document.addEventListener('click', cerrar);
    document.addEventListener('keydown', conTecla);
    return () => {
      document.removeEventListener('click', cerrar);
      document.removeEventListener('keydown', conTecla);
    };
  }, [abierto]);
  const alternar = (e) => { e.stopPropagation(); setAbierto((v) => !v); };
  return [abierto, alternar, setAbierto];
}

const PESTANAS = [
  ['vista', 'Vista previa'],
  ['historial', 'Historial'],
  ['comentarios', 'Comentarios'],
  ['detalles', 'Detalles'],
];

/**
 * Vista previa del archivo con pestañas (historial, comentarios, detalles). Expandido y en pantallas anchas
 * la vista previa queda a la izquierda y la pestaña elegida se abre como columna a la derecha.
 * onRestaurado: la pagina recarga el documento (habilita restaurar versiones). mostrarVersiones / mostrarComentarios
 * abren esa pestaña al entrar. menu: [{ etiqueta, onClick }] acciones del boton ⋯. ubicacion y etiquetas: para Detalles.
 */
export default function VisorDocumento({
  documento, onClose, onRestaurado, onComentado, mostrarVersiones = false, mostrarComentarios = false,
  menu = [], ubicacion, etiquetas = [],
}) {
  const pestanaInicial = mostrarVersiones ? 'historial' : mostrarComentarios ? 'comentarios' : 'vista';
  const [pestana, setPestana] = useState(pestanaInicial);
  const [expandido, setExpandido] = useState(false);
  const { user } = useAuth();
  const [menuAbierto, alternarMenu] = useMenu();
  const [selectorAbierto, alternarSelector, setSelectorAbierto] = useMenu();
  const [versiones, setVersiones] = useState(null);
  // Version anterior que se esta mirando (null = la actual)
  const [versionVista, setVersionVista] = useState(null);
  const [restaurando, setRestaurando] = useState(false);

  const tipo = versionVista?.extension || documento.tipo;
  const vista = tipoVista(tipo);
  const nombreDescarga = versionVista
    ? `${documento.nombre} (v${versionVista.numero}).${tipo}`
    : nombreArchivo(documento.nombre, documento.tipo);

  const [blob, setBlob] = useState(null);
  const [contenido, setContenido] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Otro archivo, o pidieron abrirlo con las versiones o los comentarios a la vista
  useEffect(() => {
    setVersionVista(null);
    setPestana(pestanaInicial);
  }, [documento.id, pestanaInicial]);

  // Las versiones alimentan el selector y el historial; se piden de nuevo si cambia la version actual
  useEffect(() => {
    let cancelado = false;
    setVersiones(null);
    listarVersiones(documento.id)
      .then((lista) => { if (!cancelado) setVersiones(lista); })
      .catch(() => { if (!cancelado) setVersiones([]); });
    return () => { cancelado = true; };
  }, [documento.id, documento.version_actual]);

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

  const descargar = () => blob && guardarArchivo(blob, nombreDescarga);

  // Ver una version: en el panel angosto se vuelve a la vista previa para mostrarla
  const verVersion = (v) => {
    setVersionVista(v.actual ? null : v);
    setSelectorAbierto(false);
    if (!expandido) setPestana('vista');
  };

  const descargarUnaVersion = async (v) => {
    try {
      const datos = v.actual ? await descargarArchivoDocumento(documento.id) : await descargarVersion(documento.id, v.numero);
      guardarArchivo(datos, v.actual ? nombreArchivo(documento.nombre, documento.tipo) : `${documento.nombre} (v${v.numero}).${v.extension || documento.tipo}`);
    } catch {
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

  const renderVista = () => {
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

  const renderLateral = () => {
    if (pestana === 'historial') {
      return (
        <HistorialVersiones
          versiones={versiones}
          vista={versionVista}
          puedeRestaurar={!!onRestaurado}
          restaurando={restaurando}
          onVer={verVersion}
          onDescargar={descargarUnaVersion}
          onRestaurar={restaurar}
        />
      );
    }
    if (pestana === 'comentarios') return <ComentariosDocumento documentoId={documento.id} onCambio={onComentado} />;
    if (pestana === 'detalles') {
      const propias = etiquetas.filter((e) => documento.etiquetas?.includes(e.id));
      return (
        <dl className={styles.detalles}>
          {ubicacion && (<><dt>Ubicación</dt><dd>{ubicacion}</dd></>)}
          <dt>Tipo</dt><dd>{claseArchivo(documento.tipo)}</dd>
          <dt>Tamaño</dt><dd>{formatoTamano(documento.tamano)}</dd>
          <dt>Creado</dt><dd title={fechaCompleta(documento.created_at)}>{fechaRelativa(documento.created_at)}</dd>
          <dt>Modificado</dt>
          <dd title={fechaCompleta(documento.updated_at)}>
            {fechaRelativa(documento.updated_at)}{documento.modificado_por && ` · ${documento.modificado_por}`}
          </dd>
          <dt>Etiquetas</dt>
          <dd>
            {propias.length ? propias.map((e) => (
              <span key={e.id} className={styles.chip}><span style={{ background: e.color }} />{e.nombre}</span>
            )) : 'Sin etiquetas'}
          </dd>
          <dt>Acceso</dt><dd>{documento.restringido ? 'Restringido a algunas personas' : 'Todo el equipo del proyecto'}</dd>
          <dt>Edición</dt>
          <dd>{documento.bloqueado_por ? `Bloqueado por ${documento.bloqueado_por} ${fechaRelativa(documento.bloqueado_at)}` : 'Libre'}</dd>
        </dl>
      );
    }
    return null;
  };

  const actual = versiones?.find((v) => v.actual);
  const numeroVisto = versionVista ? versionVista.numero : documento.version_actual;
  const cuentas = { historial: versiones?.length, comentarios: documento.comentarios };

  return (
    <aside className={`${styles.visor} ${expandido ? styles.expandido : ''}`} aria-label={`Vista previa de ${nombreArchivo(documento.nombre, documento.tipo)}`}>
      <header className={styles.header}>
        <IconoArchivo tipo={documento.tipo} />
        <div className={styles.titulo}>
          <strong title={nombreArchivo(documento.nombre, documento.tipo)}>{nombreArchivo(documento.nombre, documento.tipo)}</strong>
          <small>
            v{documento.version_actual} · {formatoTamano(documento.tamano)} · editado{' '}
            <span title={fechaCompleta(documento.updated_at)}>{fechaRelativa(documento.updated_at)}</span>
            {(documento.modificado_por || actual?.autor) && ` por ${documento.modificado_por || actual.autor}`}
          </small>
        </div>
        <div className={styles.acciones}>
          <button className={styles.botonPrimario} onClick={descargar} disabled={!blob} aria-label="Descargar">
            <Download size={15} /> <span>Descargar</span>
          </button>
          {menu.length > 0 && (
            <div className={styles.anclaMenu}>
              <button className={styles.iconBtn} onClick={alternarMenu} aria-haspopup="menu" aria-expanded={menuAbierto} aria-label="Más acciones" title="Más acciones">
                <MoreHorizontal size={18} />
              </button>
              {menuAbierto && (
                <div className={styles.menu} role="menu">
                  {menu.map((m) => (
                    <button key={m.etiqueta} role="menuitem" onClick={m.onClick}>{m.etiqueta}</button>
                  ))}
                </div>
              )}
            </div>
          )}
          <button
            className={`${styles.iconBtn} ${styles.soloAncho}`}
            onClick={() => setExpandido((v) => !v)}
            aria-label={expandido ? 'Volver al panel' : 'Expandir'}
            title={expandido ? 'Volver al panel' : 'Expandir'}
          >
            {expandido ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
          <button className={styles.iconBtn} onClick={onClose} title="Cerrar" aria-label="Cerrar visor">
            <X size={18} />
          </button>
        </div>
      </header>

      <div className={styles.barra}>
        <div className={styles.pestanasVisor} role="tablist">
          {PESTANAS.map(([id, etiqueta]) => (
            <button
              key={id}
              role="tab"
              aria-selected={pestana === id}
              className={pestana === id ? styles.pestanaVisorActiva : ''}
              onClick={() => setPestana(id)}
            >
              {etiqueta}
              {cuentas[id] > 0 && <span className={styles.cuenta}>{cuentas[id]}</span>}
            </button>
          ))}
        </div>
        <div className={styles.anclaMenu}>
          <button
            className={`${styles.selectorVersion} ${versionVista ? styles.selectorAnterior : ''}`}
            onClick={alternarSelector}
            aria-haspopup="menu"
            aria-expanded={selectorAbierto}
            aria-label={`Versión mostrada: v${numeroVisto}`}
          >
            <span className={styles.puntoVersion} />
            v{numeroVisto}{!versionVista && ' · actual'}
            <ChevronDown size={13} />
          </button>
          {selectorAbierto && (
            <div className={`${styles.menu} ${styles.menuVersiones}`} role="menu">
              {(versiones || []).map((v) => (
                <button key={v.numero} role="menuitem" onClick={() => verVersion(v)} disabled={!v.disponible}>
                  <b>v{v.numero}</b>
                  <span>{fechaRelativa(v.fecha)}{v.autor && ` · ${v.autor}`}</span>
                  {v.actual && <span className={styles.etiquetaActual}>Actual</span>}
                </button>
              ))}
              {!versiones && <p className={styles.menuEstado}>Cargando…</p>}
              <button className={styles.menuEnlace} role="menuitem" onClick={() => setPestana('historial')}>Ver historial completo</button>
            </div>
          )}
        </div>
      </div>

      {versionVista ? (
        <div className={`${styles.franja} ${styles.franjaVersion}`} role="status">
          <span>
            Viendo la <strong>v{versionVista.numero}</strong> · {fechaCompleta(versionVista.fecha)}
            {versionVista.autor && ` · ${versionVista.autor}`}
          </span>
          {onRestaurado && (
            <button className={styles.boton} onClick={() => restaurar(versionVista)} disabled={restaurando}>
              <RotateCcw size={14} /> {restaurando ? 'Restaurando…' : 'Restaurar'}
            </button>
          )}
          <button className={styles.boton} onClick={() => setVersionVista(null)}>Volver a la actual</button>
        </div>
      ) : documento.bloqueado_por && (
        <div className={`${styles.franja} ${styles.franjaBloqueo}`} role="status">
          <Lock size={14} />
          <span>
            {documento.bloqueado_por_id === user?.id
              ? 'Lo tienes bloqueado para editar: nadie más puede cambiarlo hasta que lo desbloquees.'
              : `${documento.bloqueado_por} lo está editando: no se pueden subir versiones hasta que lo desbloquee.`}
          </span>
        </div>
      )}

      <div className={styles.zona} data-lateral={pestana !== 'vista' || undefined}>
        {/* La ruta cambia con cada version: se monta de nuevo para no dejar restos de la anterior (p. ej. en Word) */}
        <div className={styles.cuerpo} key={`${documento.id}-${documento.ruta}-${versionVista?.numero ?? 'actual'}`}>
          {renderVista()}
        </div>
        {pestana !== 'vista' && <div className={styles.lateral} role="tabpanel">{renderLateral()}</div>}
      </div>
    </aside>
  );
}
