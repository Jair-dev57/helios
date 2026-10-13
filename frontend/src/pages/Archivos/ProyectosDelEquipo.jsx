import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { listarProyectos } from '../../api/proyectos';
import { colorCliente, NOMBRE_ESTADO } from '../Proyectos/formato';
import IconoCarpeta from '../Proyectos/IconoCarpeta';
import styles from './Archivos.module.css';

/**
 * Proyectos de un equipo (area_id) dentro de sus Archivos: la carpeta «Proyectos» del panel es un acceso directo,
 * no una copia; cada proyecto guarda sus documentos en el proyecto. null mientras carga o sin equipo.
 */
export function useProyectosDelEquipo(equipoId) {
  const [proyectos, setProyectos] = useState(null);
  useEffect(() => {
    if (!equipoId) return undefined;
    let cancelado = false;
    setProyectos(null);
    listarProyectos()
      .then((lista) => { if (!cancelado) setProyectos(lista.filter((p) => p.area_id === equipoId)); })
      .catch(() => { if (!cancelado) setProyectos([]); });
    return () => { cancelado = true; };
  }, [equipoId]);
  return proyectos;
}

const colorProyecto = (p) => colorCliente(p.cliente_id || p.id);

/** Contenido de la carpeta «Proyectos»: una carpeta por proyecto que abre sus documentos */
export function CarpetaProyectos({ equipo, proyectos, onVolver }) {
  return (
    <section>
      <p className={styles.rutaEquipo}>
        <button type="button" onClick={onVolver}>Archivos de {equipo.nombre}</button>
        <ChevronRight size={13} aria-hidden="true" />
        <b>Proyectos</b>
      </p>
      <p className={styles.notaEquipo}>Cada carpeta es un proyecto del equipo. Lo que subas ahí queda guardado en ese proyecto.</p>
      <div className={styles.carpetasProyectos}>
        {(proyectos || []).map((p) => (
          <Link key={p.id} to={`/proyectos/${p.id}/documentos`} className={styles.carpetaProyecto}>
            <IconoCarpeta color={colorProyecto(p)} size={48} />
            <b>{p.nombre}</b>
            <small>{NOMBRE_ESTADO[p.estado] || p.estado}</small>
          </Link>
        ))}
      </div>
    </section>
  );
}
