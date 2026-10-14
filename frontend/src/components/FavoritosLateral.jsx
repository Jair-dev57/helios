import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { X } from 'lucide-react';
import toast from 'react-hot-toast';
import { listarProyectos } from '../api/proyectos';
import { rutaObjeto } from '../api/espacios';
import {
  obtenerProyectosFavoritos, obtenerFavoritosGlobal, marcarFavorito, ordenarProyectosFavoritos, ordenarArchivosFavoritos,
  EVENTO_FAVORITOS_PROYECTOS, EVENTO_FAVORITOS_ARCHIVOS,
} from '../api/favoritos';
import IconoProyecto from '../pages/Proyectos/IconoProyecto';
import IconoCarpeta from '../pages/Proyectos/IconoCarpeta';
import IconoArchivo from './IconoArchivo';
import { nombreArchivo } from '../pages/Proyectos/formato';
import { TIPO_ARRASTRE, TIPO_ARCHIVO } from './Explorador';
import styles from './Sidebar.module.css';

// Cada favorito: { clave, nombre, to, icono }. La clave es lo que viaja al arrastrar y al ordenar.
const MODOS = {
  proyectos: {
    cargar: async () => {
      const [ids, proyectos] = await Promise.all([obtenerProyectosFavoritos(), listarProyectos()]);
      return ids.map((id) => proyectos.find((p) => p.id === id)).filter(Boolean)
        .map((p) => ({ clave: String(p.id), nombre: p.nombre, to: `/proyectos/${p.id}`, icono: <IconoProyecto size={18} /> }));
    },
    evento: EVENTO_FAVORITOS_PROYECTOS,
    tipo: TIPO_ARRASTRE,
    objetivo: (clave) => ({ proyecto_id: Number(clave) }),
    ordenar: (claves) => ordenarProyectosFavoritos(claves.map(Number)),
    verTodo: '/proyectos/favoritos',
    pista: 'Arrastra un proyecto aquí para tenerlo a mano.',
  },
  archivos: {
    cargar: async () => (await obtenerFavoritosGlobal()).map((o) => ({
      clave: `${o.tipo === 'documento' ? 'd' : 'c'}:${o.id}`,
      nombre: o.tipo === 'documento' ? nombreArchivo(o.nombre, o.extension) : o.nombre,
      to: rutaObjeto(o),
      icono: o.tipo === 'documento' ? <IconoArchivo tipo={o.extension} size={18} /> : <IconoCarpeta color={o.color} size={18} />,
    })),
    evento: EVENTO_FAVORITOS_ARCHIVOS,
    tipo: TIPO_ARCHIVO,
    objetivo: (clave) => (clave.startsWith('d:') ? { documento_id: Number(clave.slice(2)) } : { carpeta_id: Number(clave.slice(2)) }),
    ordenar: ordenarArchivosFavoritos,
    verTodo: '/archivos/favoritos',
    pista: 'Arrastra una carpeta o un archivo aquí para tenerlo a mano.',
  },
};

/**
 * Favoritos fijados en la barra lateral, como en Finder: se agregan arrastrando (o con la estrella),
 * se ordenan arrastrando dentro y se quitan con la ✕. modo: 'proyectos' o 'archivos'.
 */
export default function FavoritosLateral({ modo = 'proyectos', onCerrar }) {
  const config = MODOS[modo];
  const { pathname, search } = useLocation();
  const [favoritos, setFavoritos] = useState([]);
  // Mientras se arrastra: la zona se resalta y se marca antes de que elemento caeria
  const [encima, setEncima] = useState(null);

  useEffect(() => {
    let cancelado = false;
    const cargar = () => config.cargar()
      .then((lista) => { if (!cancelado) setFavoritos(lista); })
      .catch(() => {});
    cargar();
    window.addEventListener(config.evento, cargar);
    return () => { cancelado = true; window.removeEventListener(config.evento, cargar); };
  }, [config]);

  const trae = (e) => e.dataTransfer.types.includes(config.tipo);

  const soltar = async (e) => {
    e.preventDefault();
    const destino = encima;
    setEncima(null);
    const clave = e.dataTransfer.getData(config.tipo);
    if (!clave) return;
    const claves = favoritos.map((f) => f.clave);
    const era = claves.includes(clave);
    const nuevas = claves.filter((x) => x !== clave);
    const i = destino === 'fin' || destino === null ? nuevas.length : nuevas.indexOf(destino);
    nuevas.splice(i < 0 ? nuevas.length : i, 0, clave);
    try {
      if (!era) await marcarFavorito(config.objetivo(clave), true);
      if (era || i < nuevas.length - 1) await config.ordenar(nuevas);
      if (!era) toast.success('Añadido a Favoritos');
    } catch {
      toast.error('No se pudo cambiar Favoritos.');
    }
  };

  const quitar = async (e, favorito) => {
    e.preventDefault();
    e.stopPropagation();
    setFavoritos((prev) => prev.filter((f) => f.clave !== favorito.clave));
    try {
      await marcarFavorito(config.objetivo(favorito.clave), false);
    } catch {
      toast.error('No se pudo quitar de Favoritos.');
    }
  };

  const activo = (to) => (to.includes('?') ? `${pathname}${search}` === to : pathname === to || pathname.startsWith(`${to}/`));

  return (
    <div className={styles.grupo}>
      <div className={styles.grupoCabecera}>
        <span className={styles.grupoTitulo}>Favoritos</span>
        <Link to={config.verTodo} onClick={onCerrar} className={styles.grupoEnlace}>Ver todo</Link>
      </div>
      <div
        className={`${styles.zonaFavoritos} ${encima !== null ? styles.zonaActiva : ''}`}
        onDragOver={(e) => {
          if (!trae(e)) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = e.dataTransfer.effectAllowed === 'move' ? 'move' : 'copy';
          const fila = e.target.closest('[data-favorito]');
          setEncima(fila ? fila.dataset.favorito : 'fin');
        }}
        onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setEncima(null); }}
        onDrop={soltar}
      >
        {favoritos.length === 0 && <p className={styles.pistaFavoritos}>{config.pista}</p>}
        {favoritos.map((f) => (
          <Link
            key={f.clave}
            to={f.to}
            onClick={onCerrar}
            data-favorito={f.clave}
            draggable
            onDragStart={(e) => { e.dataTransfer.setData(config.tipo, f.clave); e.dataTransfer.effectAllowed = 'move'; }}
            className={[
              styles.navItem,
              styles.favorito,
              activo(f.to) ? styles.navItemActive : '',
              encima === f.clave ? styles.favoritoEncima : '',
            ].join(' ')}
            title={f.nombre}
          >
            {f.icono}
            <span className={styles.texto}>{f.nombre}</span>
            <button type="button" className={styles.quitarFavorito} onClick={(e) => quitar(e, f)} aria-label={`Quitar ${f.nombre} de Favoritos`} title="Quitar de Favoritos">
              <X size={13} />
            </button>
          </Link>
        ))}
      </div>
    </div>
  );
}
