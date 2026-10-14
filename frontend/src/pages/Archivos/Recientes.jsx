import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { obtenerRecientesGlobal } from '../../api/favoritos';
import ListaArchivos from './ListaArchivos';
import { fechaRelativa, fechaCompleta } from '../Proyectos/formato';

const DIA_MS = 24 * 60 * 60 * 1000;

// Hoy, Ayer, Esta semana o Antes, segun el dia en que se abrio
function grupoDe(fecha) {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const dias = Math.floor((hoy - new Date(fecha).setHours(0, 0, 0, 0)) / DIA_MS);
  if (dias <= 0) return 'Hoy';
  if (dias === 1) return 'Ayer';
  if (dias < 7) return 'Esta semana';
  return 'Antes';
}

/** Los archivos que abriste hace poco, en todos tus proyectos y espacios */
export default function Recientes() {
  const [recientes, setRecientes] = useState(null);

  useEffect(() => {
    obtenerRecientesGlobal()
      .then(setRecientes)
      .catch(() => { setRecientes([]); toast.error('No se pudieron cargar los recientes.'); });
  }, []);

  return (
    <ListaArchivos
      titulo="Recientes"
      items={recientes}
      grupo={(r) => grupoDe(r.visto_at)}
      columnas={[
        { clave: 'abierto', titulo: 'Abierto', valor: (r) => r.visto_at, celda: (r) => <span title={fechaCompleta(r.visto_at)}>{fechaRelativa(r.visto_at)}</span> },
        { clave: 'modificado', titulo: 'Modificado', valor: (r) => r.updated_at, celda: (r) => <span title={fechaCompleta(r.updated_at)}>{fechaRelativa(r.updated_at)}</span> },
      ]}
      vacio={<><b>Aún no has abierto archivos</b>Cada archivo que abras aparecerá aquí.</>}
    />
  );
}
