import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { colorCliente, NOMBRE_ESTADO } from '../../utils/formato';
import IconoCarpeta from '../../components/ui/IconoCarpeta';
import styles from './CarpetaProyectos.module.css';

const colorProyecto = (p) => colorCliente(p.cliente_id || p.id);

/** Contenido de la carpeta «Proyectos»: una carpeta por proyecto que abre sus documentos */
export default function CarpetaProyectos({ equipo, proyectos, onVolver }) {
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
