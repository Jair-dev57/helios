import { useEffect, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { X } from 'lucide-react';
import toast from 'react-hot-toast';
import { listarProyectos } from '../api/proyectos';
import {
  obtenerProyectosFavoritos, marcarFavorito, ordenarProyectosFavoritos, EVENTO_FAVORITOS_PROYECTOS,
} from '../api/favoritos';
import IconoProyecto from '../pages/Proyectos/IconoProyecto';
import { TIPO_ARRASTRE } from './Explorador';
import styles from './Sidebar.module.css';

/**
 * Favoritos de Proyectos fijados en la barra lateral, como en Finder: se agregan arrastrando un proyecto
 * (o con la estrella), se ordenan arrastrando dentro y se quitan con la ✕.
 */
export default function FavoritosLateral({ onCerrar }) {
  const [favoritos, setFavoritos] = useState([]);
  // Mientras se arrastra: la zona se resalta y se marca antes de que elemento caeria
  const [encima, setEncima] = useState(null);

  useEffect(() => {
    let cancelado = false;
    const cargar = () => Promise.all([obtenerProyectosFavoritos(), listarProyectos()])
      .then(([ids, proyectos]) => {
        if (cancelado) return;
        setFavoritos(ids.map((id) => proyectos.find((p) => p.id === id)).filter(Boolean));
      })
      .catch(() => {});
    cargar();
    window.addEventListener(EVENTO_FAVORITOS_PROYECTOS, cargar);
    return () => { cancelado = true; window.removeEventListener(EVENTO_FAVORITOS_PROYECTOS, cargar); };
  }, []);

  const arrastraProyecto = (e) => e.dataTransfer.types.includes(TIPO_ARRASTRE);

  const soltar = async (e) => {
    e.preventDefault();
    const destino = encima;
    setEncima(null);
    const id = Number(e.dataTransfer.getData(TIPO_ARRASTRE));
    if (!id) return;
    const ids = favoritos.map((p) => p.id);
    const era = ids.includes(id);
    const nuevos = ids.filter((x) => x !== id);
    const i = destino === 'fin' || destino === null ? nuevos.length : nuevos.indexOf(destino);
    nuevos.splice(i < 0 ? nuevos.length : i, 0, id);
    try {
      if (!era) await marcarFavorito({ proyecto_id: id }, true);
      if (era || i < nuevos.length - 1) await ordenarProyectosFavoritos(nuevos);
      if (!era) toast.success('Añadido a Favoritos');
    } catch {
      toast.error('No se pudo cambiar Favoritos.');
    }
  };

  const quitar = async (e, proyecto) => {
    e.preventDefault();
    e.stopPropagation();
    setFavoritos((prev) => prev.filter((p) => p.id !== proyecto.id));
    try {
      await marcarFavorito({ proyecto_id: proyecto.id }, false);
    } catch {
      toast.error('No se pudo quitar de Favoritos.');
    }
  };

  return (
    <div className={styles.grupo}>
      <div className={styles.grupoCabecera}>
        <span className={styles.grupoTitulo}>Favoritos</span>
        <Link to="/proyectos/favoritos" onClick={onCerrar} className={styles.grupoEnlace}>Ver todo</Link>
      </div>
      <div
        className={`${styles.zonaFavoritos} ${encima !== null ? styles.zonaActiva : ''}`}
        onDragOver={(e) => {
          if (!arrastraProyecto(e)) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = e.dataTransfer.effectAllowed === 'move' ? 'move' : 'copy';
          const fila = e.target.closest('[data-favorito]');
          setEncima(fila ? Number(fila.dataset.favorito) : 'fin');
        }}
        onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setEncima(null); }}
        onDrop={soltar}
      >
        {favoritos.length === 0 && <p className={styles.pistaFavoritos}>Arrastra un proyecto aquí para tenerlo a mano.</p>}
        {favoritos.map((p) => (
          <NavLink
            key={p.id}
            to={`/proyectos/${p.id}`}
            end={false}
            onClick={onCerrar}
            data-favorito={p.id}
            draggable
            onDragStart={(e) => { e.dataTransfer.setData(TIPO_ARRASTRE, String(p.id)); e.dataTransfer.effectAllowed = 'move'; }}
            className={({ isActive }) => [
              styles.navItem,
              styles.favorito,
              isActive ? styles.navItemActive : '',
              encima === p.id ? styles.favoritoEncima : '',
            ].join(' ')}
            title={p.nombre}
          >
            <IconoProyecto size={18} />
            <span className={styles.texto}>{p.nombre}</span>
            <button type="button" className={styles.quitarFavorito} onClick={(e) => quitar(e, p)} aria-label={`Quitar ${p.nombre} de Favoritos`} title="Quitar de Favoritos">
              <X size={13} />
            </button>
          </NavLink>
        ))}
      </div>
    </div>
  );
}
