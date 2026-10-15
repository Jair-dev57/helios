import { useEffect, useState } from 'react';
import { listarProyectos } from '../api/proyectos';

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
