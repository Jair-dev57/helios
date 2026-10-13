import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { obtenerRecientesGlobal } from '../../api/favoritos';
import PageContainer from '../../components/PageContainer';
import ObjetoCompartido from './ObjetoCompartido';
import { fechaRelativa, fechaCompleta } from '../Proyectos/formato';
import listado from '../../styles/listado.module.css';
import shared from '../../styles/shared.module.css';
import styles from './Archivos.module.css';

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

  const grupos = [];
  for (const r of recientes || []) {
    const titulo = grupoDe(r.visto_at);
    if (grupos.at(-1)?.titulo !== titulo) grupos.push({ titulo, items: [] });
    grupos.at(-1).items.push(r);
  }

  return (
    <PageContainer>
      <header className={listado.header}>
        <div>
          <h1 className={listado.title}>Recientes</h1>
          <p className={styles.subtitulo}>Los archivos que abriste hace poco, en todos tus proyectos y espacios.</p>
        </div>
      </header>

      {recientes === null ? (
        <p className={shared.loadingText}>Cargando…</p>
      ) : recientes.length === 0 ? (
        <div className={listado.vacio}>
          <b>Aún no has abierto archivos</b>
          <span>Cada archivo que abras en el visor aparecerá aquí.</span>
        </div>
      ) : grupos.map((g) => (
        <section key={g.titulo}>
          <h2 className={styles.tituloSeccion}>{g.titulo}</h2>
          <ul className={styles.filas}>
            {g.items.map((r) => (
              <li key={r.id} className={styles.filaCompartida}>
                <ObjetoCompartido objeto={r} />
                <span className={styles.datosEnlace}>
                  <span title={fechaCompleta(r.visto_at)}>abierto {fechaRelativa(r.visto_at)}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </PageContainer>
  );
}
