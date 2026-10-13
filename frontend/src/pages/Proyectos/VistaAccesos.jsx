import { Star, Clock } from 'lucide-react';
import IconoArchivo from '../../components/IconoArchivo';
import IconoCarpeta from './IconoCarpeta';
import { fechaRelativa, fechaCompleta } from './formato';
import styles from './Etiquetas.module.css';

const VISTAS = {
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

/** Lista de accesos rapidos (favoritos o recientes) en el lugar del explorador */
export default function VistaAccesos({ tipo, carpetas = [], documentos, etiquetasPorId, rutaDe, docActivoId, onAbrirCarpeta, onAbrir }) {
  const { titulo, Icono, color, vacio } = VISTAS[tipo];
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
          {documentos.map((d) => (
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
                <small className={styles.filaFecha} title={fechaCompleta(d.updated_at)}>{fechaRelativa(d.updated_at)}</small>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
