import { useState } from 'react';
import { Star, Clock, LayoutGrid, Share2, Link2 } from 'lucide-react';
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
  compartidos: {
    titulo: 'Compartidos',
    Icono: Share2,
    color: 'var(--accent)',
    vacio: 'Nada compartido todavía. Comparte un archivo o una carpeta con clic derecho → «Compartir enlace…». Aquí también verás los archivos restringidos que te compartan.',
  },
};

const ORDENES = {
  fecha: (a, b) => new Date(b.updated_at) - new Date(a.updated_at),
  nombre: (a, b) => a.nombre.localeCompare(b.nombre, 'es', { numeric: true }),
  tamano: (a, b) => (b.tamano || 0) - (a.tamano || 0),
};

const textoEnlace = ({ permiso, accesos }) =>
  `${permiso === 'subir' ? 'Recibe archivos' : 'Enlace público'} · ${accesos} visita${accesos === 1 ? '' : 's'}`;

/**
 * Lista plana (todos, favoritos, recientes o compartidos) en el lugar del explorador.
 * grupos: [{ titulo?, carpetas, documentos }]; enlaces: Map 'c:id' / 'd:id' -> enlace vigente
 */
export default function VistaAccesos({ tipo, grupos, enlaces, etiquetasPorId, rutaDe, docActivoId, onAbrirCarpeta, onAbrir, onCompartir }) {
  const { titulo, Icono, color, vacio, ordenable } = VISTAS[tipo];
  const [orden, setOrden] = useState('fecha');
  const total = grupos.reduce((n, g) => n + g.carpetas.length + g.documentos.length, 0);
  const ruta = (id) => rutaDe(id).map((c) => c.nombre).join(' / ');

  const botonEnlace = (tipoItem, item) => {
    const enlace = enlaces?.get(`${tipoItem === 'carpeta' ? 'c' : 'd'}:${item.id}`);
    if (!enlace) return null;
    return (
      <button className={styles.icono} onClick={() => onCompartir(tipoItem, item)} title={`${textoEnlace(enlace)}. Gestionar enlaces`} aria-label="Gestionar enlaces">
        <Link2 size={15} />
      </button>
    );
  };

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
      ) : grupos.filter((g) => g.carpetas.length + g.documentos.length > 0).map((g) => (
        <div key={g.titulo || 'lista'}>
          {g.titulo && <h3 className={styles.grupoTitulo}>{g.titulo}</h3>}
          <ul className={styles.vistaLista}>
            {g.carpetas.map((c) => (
              <li key={`c${c.id}`} className={styles.item}>
                <button className={styles.fila} onClick={() => onAbrirCarpeta(c.id)}>
                  <IconoCarpeta color={c.color} size={26} />
                  <span className={styles.filaInfo}>
                    <span className={styles.filaNombre}>{c.nombre}</span>
                    <small>{ruta(c.carpeta_padre_id) || 'Carpeta principal'}</small>
                  </span>
                </button>
                {botonEnlace('carpeta', c)}
              </li>
            ))}
            {(ordenable ? [...g.documentos].sort(ORDENES[orden]) : g.documentos).map((d) => (
              <li key={`d${d.id}`} className={styles.item}>
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
                {botonEnlace('documento', d)}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}
