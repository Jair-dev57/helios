import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Star } from 'lucide-react';
import { obtenerFavoritosGlobal, marcarFavorito } from '../../api/favoritos';
import PageContainer from '../../components/PageContainer';
import ObjetoCompartido from './ObjetoCompartido';
import { fechaRelativa, fechaCompleta } from '../Proyectos/formato';
import listado from '../../styles/listado.module.css';
import shared from '../../styles/shared.module.css';
import styles from './Archivos.module.css';

const clave = (o) => `${o.tipo}:${o.id}`;

/** Carpetas y archivos con estrella, en todos tus proyectos y espacios */
export default function Favoritos() {
  const [favoritos, setFavoritos] = useState(null);

  useEffect(() => {
    obtenerFavoritosGlobal()
      .then(setFavoritos)
      .catch(() => { setFavoritos([]); toast.error('No se pudieron cargar los favoritos.'); });
  }, []);

  const quitar = async (o) => {
    setFavoritos((prev) => prev.filter((x) => clave(x) !== clave(o)));
    try {
      await marcarFavorito(o.tipo === 'documento' ? { documento_id: o.id } : { carpeta_id: o.id }, false);
    } catch {
      setFavoritos((prev) => [...prev, o]);
      toast.error('No se pudo quitar de favoritos.');
    }
  };

  return (
    <PageContainer>
      <header className={listado.header}>
        <div>
          <h1 className={listado.title}>Favoritos</h1>
          <p className={styles.subtitulo}>Las carpetas y archivos que marcaste con estrella, en todos tus proyectos y espacios.</p>
        </div>
      </header>

      {favoritos === null ? (
        <p className={shared.loadingText}>Cargando…</p>
      ) : favoritos.length === 0 ? (
        <div className={listado.vacio}>
          <b>No tienes favoritos</b>
          <span>Marca una carpeta o un archivo con la estrella para tenerlo siempre a mano.</span>
        </div>
      ) : (
        <ul className={styles.filas}>
          {favoritos.map((o) => (
            <li key={clave(o)} className={styles.filaCompartida}>
              <ObjetoCompartido
                objeto={o}
                detalle={o.tipo === 'documento' && <span title={fechaCompleta(o.updated_at)}>modificado {fechaRelativa(o.updated_at)}</span>}
              />
              <span className={styles.accionesFila}>
                <button className={`${styles.botonFila} ${styles.botonEstrella}`} onClick={() => quitar(o)} title="Quitar de favoritos" aria-label={`Quitar ${o.nombre} de favoritos`}>
                  <Star size={14} fill="currentColor" />
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </PageContainer>
  );
}
