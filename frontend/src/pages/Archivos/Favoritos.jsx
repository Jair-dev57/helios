import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { obtenerFavoritosArchivos, EVENTO_FAVORITOS_ARCHIVOS } from '../../api/favoritos';
import ListaArchivos from './ListaArchivos';
import { fechaRelativa, fechaCompleta } from '../Proyectos/formato';

/** Carpetas y archivos con estrella en Mis archivos y en los equipos, en el orden de la barra lateral */
export default function Favoritos() {
  const [favoritos, setFavoritos] = useState(null);

  useEffect(() => {
    const cargar = () => obtenerFavoritosArchivos()
      .then(setFavoritos)
      .catch(() => { setFavoritos([]); toast.error('No se pudieron cargar los favoritos.'); });
    cargar();
    window.addEventListener(EVENTO_FAVORITOS_ARCHIVOS, cargar);
    return () => window.removeEventListener(EVENTO_FAVORITOS_ARCHIVOS, cargar);
  }, []);

  return (
    <ListaArchivos
      titulo="Favoritos"
      items={favoritos}
      columnas={[
        { clave: 'tipo', titulo: 'Tipo', valor: (o) => o.tipo, celda: (o) => (o.tipo === 'documento' ? 'Archivo' : 'Carpeta') },
        { clave: 'modificado', titulo: 'Modificado', valor: (o) => o.updated_at, celda: (o) => <span title={fechaCompleta(o.updated_at)}>{fechaRelativa(o.updated_at)}</span> },
      ]}
      vacio={<><b>No tienes favoritos</b>Marca una carpeta o un archivo con la estrella, o arrástralo a Favoritos en la barra lateral.</>}
    />
  );
}
