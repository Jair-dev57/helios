import { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import IconoArchivo from '../../components/IconoArchivo';
import IconoCarpeta from './IconoCarpeta';
import { extensionDe } from './subidaLocal';
import { formatoTamano } from './formato';
import shared from '../../styles/shared.module.css';
import styles from './SubidaLocal.module.css';

// Una carpeta enorme no se pinta entera: la vista previa es para revisar, no para navegar
const MAX_FILAS = 300;
const MAX_OMITIDOS = 6;

/** Arbol de la vista previa: carpetas y luego archivos, por orden alfabetico, con su nivel de sangria */
function filasDelArbol({ carpetas, archivos, omitidos }) {
  const raiz = { carpetas: new Map(), archivos: [] };
  const nodo = (ruta) => ruta.reduce((n, nombre) => {
    if (!n.carpetas.has(nombre)) n.carpetas.set(nombre, { carpetas: new Map(), archivos: [] });
    return n.carpetas.get(nombre);
  }, raiz);
  carpetas.forEach(nodo);
  archivos.forEach(({ archivo, carpetas: ruta }) => nodo(ruta).archivos.push({ nombre: archivo.name, tamano: archivo.size }));
  omitidos.forEach(({ ruta, motivo }) => {
    const partes = ruta.split('/');
    nodo(partes.slice(0, -1)).archivos.push({ nombre: partes.at(-1), motivo });
  });

  const contar = (n) => n.archivos.filter((a) => !a.motivo).length
    + [...n.carpetas.values()].reduce((suma, hijo) => suma + contar(hijo), 0);
  const filas = [];
  const recorrer = (n, nivel) => {
    [...n.carpetas.entries()].sort(([a], [b]) => a.localeCompare(b)).forEach(([nombre, hijo]) => {
      filas.push({ tipo: 'carpeta', nombre, nivel, cantidad: contar(hijo) });
      recorrer(hijo, nivel + 1);
    });
    n.archivos.sort((a, b) => a.nombre.localeCompare(b.nombre)).forEach((a) => filas.push({ tipo: 'archivo', nivel, ...a }));
  };
  recorrer(raiz, 0);
  return filas;
}

const plural = (n, singular, varios = `${singular}s`) => `${n} ${n === 1 ? singular : varios}`;

export default function ModalRevisarSubida({ revision, rutaDestino, puedeRestringir, onConfirmar, onCancelar }) {
  const [conflicto, setConflicto] = useState('version');
  const [restringir, setRestringir] = useState(false);
  const filas = useMemo(() => filasDelArbol(revision), [revision]);
  const { archivos, carpetas, omitidos, totalBytes, conflictos, carpetasNuevas, titulo } = revision;
  const fusionadas = carpetas.length - carpetasNuevas;

  return (
    <div className={shared.overlay} onClick={onCancelar}>
      <div className={styles.modal} role="dialog" aria-labelledby="titulo-subida" onClick={(e) => e.stopPropagation()}>
        <header className={styles.cabecera}>
          <div>
            <h3 id="titulo-subida" className={styles.titulo}>Subir {titulo}</h3>
            <p className={styles.subtitulo}>Revisa lo que se va a subir. Se conserva la misma estructura de subcarpetas.</p>
          </div>
          <button className={styles.cerrar} onClick={onCancelar} aria-label="Cerrar"><X size={16} /></button>
        </header>

        <div className={styles.cifras}>
          <div><strong>{carpetas.length}</strong><span>{carpetas.length === 1 ? 'carpeta' : 'carpetas'}{fusionadas > 0 && ` · ${fusionadas} ya existe${fusionadas === 1 ? '' : 'n'}`}</span></div>
          <div><strong>{archivos.length}</strong><span>archivos a subir</span></div>
          <div><strong>{formatoTamano(totalBytes)}</strong><span>tamaño total</span></div>
          <div className={omitidos.length ? styles.cifraAviso : ''}><strong>{omitidos.length}</strong><span>se omitirán</span></div>
        </div>

        <div className={styles.cuerpo}>
          <div className={styles.vistaPrevia}>
            <span className={styles.etiqueta}>Vista previa</span>
            <ul className={styles.arbol}>
              {filas.slice(0, MAX_FILAS).map((f, i) => (
                <li key={i} style={{ paddingLeft: `${f.nivel * 18}px` }} className={f.motivo ? styles.omitido : ''}>
                  {f.tipo === 'carpeta'
                    ? <IconoCarpeta size={16} />
                    : <IconoArchivo tipo={extensionDe(f.nombre)} size={15} />}
                  <span className={f.tipo === 'carpeta' ? styles.nombreCarpeta : styles.nombreArchivo} title={f.nombre}>{f.nombre}</span>
                  <span className={styles.dato}>
                    {f.tipo === 'carpeta' ? f.cantidad : f.motivo || formatoTamano(f.tamano)}
                  </span>
                </li>
              ))}
            </ul>
            {filas.length > MAX_FILAS && <p className={styles.mas}>y {filas.length - MAX_FILAS} elementos más…</p>}
          </div>

          <div className={styles.opciones}>
            <div className={styles.grupo}>
              <span className={styles.etiqueta}>Destino</span>
              <div className={styles.destino}><IconoCarpeta size={16} />{rutaDestino}</div>
            </div>

            {conflictos > 0 && (
              <fieldset className={styles.grupo}>
                <legend className={styles.etiqueta}>{plural(conflictos, 'archivo ya existe', 'archivos ya existen')} con el mismo nombre</legend>
                <label className={styles.opcion}>
                  <input type="radio" name="conflicto" checked={conflicto === 'version'} onChange={() => setConflicto('version')} />
                  <span><strong>Agregar como nueva versión</strong><small>Recomendado: conserva el historial. Los idénticos se saltan.</small></span>
                </label>
                <label className={styles.opcion}>
                  <input type="radio" name="conflicto" checked={conflicto === 'copia'} onChange={() => setConflicto('copia')} />
                  <span>Crear una copia «nombre (2)»</span>
                </label>
                <label className={styles.opcion}>
                  <input type="radio" name="conflicto" checked={conflicto === 'omitir'} onChange={() => setConflicto('omitir')} />
                  <span>Omitir esos archivos</span>
                </label>
              </fieldset>
            )}

            {omitidos.length > 0 && (
              <div className={styles.avisoOmitidos}>
                <strong>{plural(omitidos.length, 'archivo no se subirá', 'archivos no se subirán')}</strong>
                {omitidos.slice(0, MAX_OMITIDOS).map((o) => (
                  <span key={o.ruta} title={o.ruta}>{o.ruta.split('/').at(-1)} · {o.motivo}</span>
                ))}
                {omitidos.length > MAX_OMITIDOS && <span>y {omitidos.length - MAX_OMITIDOS} más</span>}
              </div>
            )}
          </div>
        </div>

        <footer className={styles.pie}>
          {puedeRestringir ? (
            <label className={styles.restringir}>
              <input type="checkbox" checked={restringir} onChange={(e) => setRestringir(e.target.checked)} />
              Restringir los archivos nuevos (solo el administrador decide quién los ve)
            </label>
          ) : <span />}
          <button className={shared.btnSecondary} onClick={onCancelar}>Cancelar</button>
          <button
            className={shared.btnPrimary}
            onClick={() => onConfirmar({ conflicto, restringir })}
            autoFocus
          >
            {archivos.length ? `Subir ${plural(archivos.length, 'archivo')}` : `Crear ${plural(carpetas.length, 'carpeta')}`}
          </button>
        </footer>
      </div>
    </div>
  );
}
