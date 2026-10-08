import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Download, Lock, Link2, ChevronRight, UploadCloud, CheckCircle2, AlertCircle, FolderDown } from 'lucide-react';
import { verEnlace, descargarDeEnlace, descargarZipDeEnlace, enviarAEnlace } from '../../api/compartido';
import MarcaEmpresa from '../../components/MarcaEmpresa';
import IconoArchivo from '../../components/IconoArchivo';
import IconoCarpeta from '../Proyectos/IconoCarpeta';
import { formatoTamano, fechaRelativa } from '../Proyectos/formato';
import { analizarSubida } from '../Proyectos/subidaLocal';
import styles from './Compartido.module.css';

function guardar(blob, nombre) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  a.click();
  URL.revokeObjectURL(url);
}

const nombreCompleto = (d) => (d.tipo ? `${d.nombre}.${d.tipo}` : d.nombre);
const PREVISUALIZABLES = new Set(['pdf', 'png', 'jpg', 'jpeg', 'txt']);

/** Un archivo compartido: vista previa (pdf, imagen o texto) y descarga */
function VistaDocumento({ token, clave, documento }) {
  const [blob, setBlob] = useState(null);
  const [vista, setVista] = useState(null);
  const tipo = (documento.tipo || '').toLowerCase();

  useEffect(() => {
    let url = null;
    let cancelado = false;
    descargarDeEnlace(token, clave)
      .then(async (datos) => {
        if (cancelado) return;
        setBlob(datos);
        if (tipo === 'txt') setVista({ texto: await datos.text() });
        else if (PREVISUALIZABLES.has(tipo)) {
          url = URL.createObjectURL(datos);
          setVista({ url });
        }
      })
      .catch(() => {});
    return () => {
      cancelado = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [token, clave, tipo]);

  return (
    <div className={styles.documento}>
      <div className={styles.fichaDocumento}>
        <IconoArchivo tipo={documento.tipo} size={44} />
        <div className={styles.fichaTexto}>
          <h1 className={styles.titulo}>{nombreCompleto(documento)}</h1>
          <span>{formatoTamano(documento.tamano)} · actualizado {fechaRelativa(documento.updated_at)}</span>
        </div>
        <button className={styles.primario} onClick={() => blob && guardar(blob, nombreCompleto(documento))} disabled={!blob}>
          <Download size={16} /> Descargar
        </button>
      </div>
      {vista?.url && tipo === 'pdf' && <iframe className={styles.previa} src={vista.url} title={documento.nombre} />}
      {vista?.url && tipo !== 'pdf' && <div className={styles.previaImagen}><img src={vista.url} alt={documento.nombre} /></div>}
      {vista?.texto !== undefined && <pre className={styles.previaTexto}>{vista.texto}</pre>}
      {!PREVISUALIZABLES.has(tipo) && (
        <p className={styles.sinPrevia}>La vista previa no está disponible para este tipo de archivo. Descárgalo para abrirlo.</p>
      )}
    </div>
  );
}

/** Una carpeta compartida: navegar por subcarpetas y descargar archivos o todo en ZIP */
function VistaCarpeta({ token, clave, datos }) {
  const [actual, setActual] = useState(datos.carpeta_id);
  const [ocupado, setOcupado] = useState(null);

  const porId = new Map(datos.carpetas.map((c) => [c.id, c]));
  const ruta = [];
  for (let c = porId.get(actual); c; c = porId.get(c.carpeta_padre_id)) ruta.unshift(c);
  const subcarpetas = datos.carpetas.filter((c) => c.carpeta_padre_id === actual).sort((a, b) => a.nombre.localeCompare(b.nombre));
  const archivos = datos.documentos.filter((d) => d.carpeta_id === actual);

  const descargar = async (doc) => {
    setOcupado(doc.id);
    try {
      guardar(await descargarDeEnlace(token, clave, doc.id), nombreCompleto(doc));
    } finally {
      setOcupado(null);
    }
  };

  const descargarTodo = async () => {
    setOcupado('zip');
    try {
      guardar(await descargarZipDeEnlace(token, clave), `${datos.nombre}.zip`);
    } finally {
      setOcupado(null);
    }
  };

  return (
    <div className={styles.carpeta}>
      <div className={styles.cabeceraCarpeta}>
        <nav className={styles.migas} aria-label="Ruta">
          <button onClick={() => setActual(datos.carpeta_id)} className={actual === datos.carpeta_id ? styles.migaActual : ''}>
            <IconoCarpeta size={18} /> {datos.nombre}
          </button>
          {ruta.map((c) => (
            <span key={c.id} className={styles.miga}>
              <ChevronRight size={14} />
              <button onClick={() => setActual(c.id)} className={actual === c.id ? styles.migaActual : ''}>{c.nombre}</button>
            </span>
          ))}
        </nav>
        <button className={styles.primario} onClick={descargarTodo} disabled={!!ocupado}>
          <FolderDown size={16} /> {ocupado === 'zip' ? 'Preparando…' : 'Descargar todo (ZIP)'}
        </button>
      </div>

      {subcarpetas.length === 0 && archivos.length === 0 ? (
        <p className={styles.sinPrevia}>Esta carpeta está vacía.</p>
      ) : (
        <ul className={styles.listaArchivos}>
          {subcarpetas.map((c) => (
            <li key={`c${c.id}`}>
              <button className={styles.filaCarpeta} onClick={() => setActual(c.id)}>
                <IconoCarpeta size={24} />
                <span className={styles.nombreFila}>{c.nombre}</span>
                <ChevronRight size={16} />
              </button>
            </li>
          ))}
          {archivos.map((d) => (
            <li key={`d${d.id}`} className={styles.filaArchivo}>
              <IconoArchivo tipo={d.tipo} size={24} />
              <span className={styles.nombreFila} title={nombreCompleto(d)}>{nombreCompleto(d)}</span>
              <span className={styles.datoFila}>{formatoTamano(d.tamano)}</span>
              <button
                className={styles.botonIcono}
                onClick={() => descargar(d)}
                disabled={!!ocupado}
                aria-label={`Descargar ${nombreCompleto(d)}`}
                title="Descargar"
              >
                <Download size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Solicitar archivos: se envian a la carpeta sin ver lo que hay dentro */
function VistaRecibir({ token, clave, nombre }) {
  const [remitente, setRemitente] = useState('');
  const [archivos, setArchivos] = useState([]);
  const [arrastrando, setArrastrando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const selector = useRef(null);

  const agregar = (lista) => {
    const { archivos: validos, omitidos } = analizarSubida({
      archivos: [...lista].map((archivo) => ({ archivo, carpetas: [] })),
      carpetas: [],
    });
    setArchivos((prev) => [
      ...prev.filter((a) => a.estado !== 'listo'),
      ...validos.map(({ archivo }, i) => ({ id: `${Date.now()}-${i}`, archivo, estado: 'pendiente', progreso: 0 })),
      ...omitidos.map((o, i) => ({ id: `o${Date.now()}-${i}`, archivo: { name: o.ruta }, estado: 'omitido', motivo: o.motivo })),
    ]);
  };

  const actualizar = (id, cambios) => setArchivos((prev) => prev.map((a) => (a.id === id ? { ...a, ...cambios } : a)));

  const enviar = async () => {
    setEnviando(true);
    for (const a of archivos.filter((x) => x.estado === 'pendiente' || x.estado === 'error')) {
      actualizar(a.id, { estado: 'enviando', progreso: 0 });
      try {
        const { nombre: guardado } = await enviarAEnlace(token, clave, a.archivo, remitente.trim(), (e) => e.total && actualizar(a.id, { progreso: e.loaded / e.total }));
        actualizar(a.id, { estado: 'listo', guardado });
      } catch (err) {
        actualizar(a.id, { estado: 'error', motivo: err.response?.data?.detail || 'No se pudo enviar' });
      }
    }
    setEnviando(false);
  };

  const pendientes = archivos.filter((a) => a.estado === 'pendiente' || a.estado === 'error').length;
  const enviados = archivos.filter((a) => a.estado === 'listo').length;

  return (
    <div className={styles.recibir}>
      <h1 className={styles.titulo}>Enviar archivos a «{nombre}»</h1>
      <p className={styles.explicacion}>Los archivos que envíes llegarán a esta carpeta. No podrás ver lo que hay dentro.</p>

      <label className={styles.campoRemitente}>
        Tu nombre <span>(para que sepan quién envía)</span>
        <input value={remitente} onChange={(e) => setRemitente(e.target.value)} maxLength={100} placeholder="Ej: Ana Gómez — Grupo 3" />
      </label>

      <div
        className={`${styles.zona} ${arrastrando ? styles.zonaActiva : ''}`}
        onDragOver={(e) => { e.preventDefault(); setArrastrando(true); }}
        onDragLeave={() => setArrastrando(false)}
        onDrop={(e) => { e.preventDefault(); setArrastrando(false); agregar(e.dataTransfer.files); }}
      >
        <UploadCloud size={36} strokeWidth={1.5} />
        <p><strong>Arrastra tus archivos aquí</strong> o</p>
        <button type="button" className={styles.secundario} onClick={() => selector.current?.click()}>Elegir archivos</button>
        <small>PDF, Word, Excel, PowerPoint, imágenes, TXT o CSV · máximo 10 MB por archivo</small>
        <input ref={selector} type="file" multiple hidden onChange={(e) => { agregar(e.target.files); e.target.value = ''; }} />
      </div>

      {archivos.length > 0 && (
        <ul className={styles.envios}>
          {archivos.map((a) => (
            <li key={a.id}>
              <IconoArchivo tipo={a.archivo.name.split('.').pop()} size={22} />
              <span className={styles.nombreFila} title={a.archivo.name}>{a.estado === 'listo' ? a.guardado : a.archivo.name}</span>
              {a.estado === 'pendiente' && <span className={styles.datoFila}>{formatoTamano(a.archivo.size)}</span>}
              {a.estado === 'enviando' && <span className={styles.datoFila}>{Math.round(a.progreso * 100)} %</span>}
              {a.estado === 'listo' && <span className={styles.ok}><CheckCircle2 size={16} /> Enviado</span>}
              {(a.estado === 'error' || a.estado === 'omitido') && <span className={styles.error}><AlertCircle size={16} /> {a.motivo}</span>}
            </li>
          ))}
        </ul>
      )}

      <div className={styles.pieRecibir}>
        {enviados > 0 && !pendientes && <span className={styles.ok}><CheckCircle2 size={16} /> {enviados} archivo{enviados === 1 ? '' : 's'} enviado{enviados === 1 ? '' : 's'}. ¡Gracias!</span>}
        <button className={styles.primario} onClick={enviar} disabled={!pendientes || enviando}>
          {enviando ? 'Enviando…' : `Enviar${pendientes ? ` ${pendientes} archivo${pendientes === 1 ? '' : 's'}` : ''}`}
        </button>
      </div>
    </div>
  );
}

export default function Compartido() {
  const { token } = useParams();
  // cargando | no-disponible | contrasena | listo
  const [estado, setEstado] = useState('cargando');
  const [datos, setDatos] = useState(null);
  // La contrasena correcta se guarda en memoria para las descargas (no en el navegador)
  const [clave, setClave] = useState('');
  const [escrita, setEscrita] = useState('');
  const [claveIncorrecta, setClaveIncorrecta] = useState(false);

  const cargar = useCallback(async (contrasena) => {
    try {
      const respuesta = await verEnlace(token, contrasena);
      if (respuesta.requiere_contrasena) {
        setEstado('contrasena');
        return;
      }
      setClave(contrasena || '');
      setDatos(respuesta);
      setEstado('listo');
      document.title = respuesta.nombre;
    } catch (err) {
      if (err.response?.status === 403) {
        setClaveIncorrecta(true);
        setEstado('contrasena');
      } else {
        setEstado('no-disponible');
      }
    }
  }, [token]);

  useEffect(() => {
    cargar('');
  }, [cargar]);

  const entrar = (e) => {
    e.preventDefault();
    setClaveIncorrecta(false);
    cargar(escrita);
  };

  return (
    <div className={styles.pagina}>
      <header className={styles.cabecera}>
        <MarcaEmpresa tamanoLogo={34} />
      </header>

      <main className={styles.principal}>
        <section className={`${styles.tarjeta} ${estado === 'listo' && datos?.tipo === 'documento' ? styles.tarjetaAncha : ''}`}>
          {estado === 'cargando' && <p className={styles.sinPrevia}>Cargando…</p>}

          {estado === 'no-disponible' && (
            <div className={styles.aviso}>
              <Link2 size={36} strokeWidth={1.5} />
              <h1 className={styles.titulo}>Este enlace no está disponible</h1>
              <p>Puede que haya vencido o que lo hayan revocado. Pide un enlace nuevo a quien te lo compartió.</p>
            </div>
          )}

          {estado === 'contrasena' && (
            <form className={styles.aviso} onSubmit={entrar}>
              <Lock size={36} strokeWidth={1.5} />
              <h1 className={styles.titulo}>Este enlace está protegido</h1>
              <p>Escribe la contraseña que te dieron para abrirlo.</p>
              <input
                className={`${styles.clave} ${claveIncorrecta ? styles.claveMala : ''}`}
                type="password"
                value={escrita}
                onChange={(e) => setEscrita(e.target.value)}
                placeholder="Contraseña"
                aria-label="Contraseña"
                aria-invalid={claveIncorrecta}
                autoFocus
              />
              {claveIncorrecta && <span className={styles.error}>Contraseña incorrecta</span>}
              <button className={styles.primario} type="submit" disabled={!escrita}>Abrir</button>
            </form>
          )}

          {estado === 'listo' && datos.tipo === 'documento' && <VistaDocumento token={token} clave={clave} documento={datos.documento} />}
          {estado === 'listo' && datos.tipo === 'carpeta' && datos.permiso === 'ver' && <VistaCarpeta token={token} clave={clave} datos={datos} />}
          {estado === 'listo' && datos.permiso === 'subir' && <VistaRecibir token={token} clave={clave} nombre={datos.nombre} />}
        </section>
        {estado === 'listo' && datos.expira_at && (
          <p className={styles.vence}>Este enlace vence {fechaRelativa(datos.expira_at)}.</p>
        )}
      </main>

      <footer className={styles.pie}>Compartido de forma segura con Helios</footer>
    </div>
  );
}
