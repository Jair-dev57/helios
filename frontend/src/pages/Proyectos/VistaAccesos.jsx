import { useState } from 'react';
import { Star, Clock, LayoutGrid } from 'lucide-react';
import IconoArchivo from '../../components/IconoArchivo';
import IconoCarpeta from './IconoCarpeta';
import { fechaRelativa, fechaCompleta, formatoTamano } from './formato';
import styles from './Etiquetas.module.css';

const VISTAS = {
  todos: {
    titulo: 'Todos los archivos',
    Icono: LayoutGrid,
    color: 'var(--accent)',
    vacio: 'Este proyecto aún no tiene archivos.',
    ordenable: true,
  },
  favoritos: {
    titulo: 'Favoritos',
    Icono: Star,
    color: '#eab308',
    vacio: 'Aún no tienes favoritos. Marca un archivo o una carpeta con clic derecho → «Agregar a favoritos».',
  },
  recientes: {
    titulo: 'Recientes',
    Icono: Clock,
    color: 'var(--text-secondary)',
    vacio: 'Los archivos que abras aparecerán aquí.',
  },
};

const ORDENES = {
  fecha: (a, b) => new Date(b.updated_at) - new Date(a.updated_at),
  nombre: (a, b) => a.nombre.localeCompare(b.nombre, 'es', { numeric: true }),
  tamano: (a, b) => (b.tamano || 0) - (a.tamano || 0),
};

/** Lista plana de archivos (todos, favoritos o recientes) en el lugar del explorador */
export default function VistaAccesos({ tipo, carpetas = [], documentos, etiquetasPorId, rutaDe, docActivoId, onAbrirCarpeta, onAbrir }) {
  const { titulo, Icono, color, vacio, ordenable } = VISTAS[tipo];
  const [orden, setOrden] = useState('fecha');
  const lista = ordenable ? [...documentos].sort(ORDENES[orden]) : documentos;
  const total = carpetas.length + documentos.length;
  const ruta = (id) => rutaDe(id).map((c) => c.nombre).join(' / ');

  return (
    <section className={styles.vista} aria-labelledby="titulo-accesos">
      <header className={styles.vistaCabecera}>
        <div className={styles.vistaTitulo}>
          <Icono size={18} style={{ color }} />
          <h2 id="titulo-accesos">{titulo}</h2>
          <span className={styles.cuenta}>{total} elemento{total === 1 ? '' : 's'}</span>
        </div>
        {ordenable && total > 0 && (
          <label className={styles.orden}>
            Ordenar por
            <select id="orden-archivos" value={orden} onChange={(e) => setOrden(e.target.value)}>
              <option value="fecha">Modificado</option>
              <option value="nombre">Nombre</option>
              <option value="tamano">Tamaño</option>
            </select>
          </label>
        )}
      </header>

      {total === 0 ? (
        <p className={styles.vistaVacia}>{vacio}</p>
      ) : (
        <ul className={styles.vistaLista}>
          {carpetas.map((c) => (
            <li key={`c${c.id}`}>
              <button className={styles.fila} onClick={() => onAbrirCarpeta(c.id)}>
                <IconoCarpeta color={c.color} size={26} />
                <span className={styles.filaInfo}>
                  <span className={styles.filaNombre}>{c.nombre}</span>
                  <small>{ruta(c.carpeta_padre_id) || 'Carpeta principal'}</small>
                </span>
              </button>
            </li>
          ))}
          {lista.map((d) => (
            <li key={`d${d.id}`}>
              <button className={`${styles.fila} ${docActivoId === d.id ? styles.filaActiva : ''}`} onClick={() => onAbrir(d)}>
                <IconoArchivo tipo={d.tipo} size={26} />
                <span className={styles.filaInfo}>
                  <span className={styles.filaNombre}>{d.nombre}{d.tipo ? `.${d.tipo}` : ''}</span>
                  <small>{ruta(d.carpeta_id) || 'Sin carpeta'}</small>
                </span>
                <span className={styles.filaEtiquetas}>
                  {(d.etiquetas || []).map((id) => etiquetasPorId.get(id)).filter(Boolean).map((e) => (
                    <span key={e.id} className={styles.chip}><span className={styles.punto} style={{ background: e.color }} />{e.nombre}</span>
                  ))}
                </span>
                {ordenable && <small className={styles.filaFecha}>{formatoTamano(d.tamano)}</small>}
                <small className={styles.filaFecha} title={fechaCompleta(d.updated_at)}>{fechaRelativa(d.updated_at)}</small>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
