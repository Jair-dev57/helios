import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Plus, Globe, Users } from 'lucide-react';
import { listarEspacios } from '../../api/espacios';
import PageContainer from '../../components/PageContainer';
import IconoCarpeta from '../Proyectos/IconoCarpeta';
import { fechaRelativa, plural } from '../Proyectos/formato';
import { useAuth } from '../../hooks/useAuth';
import ModalEspacio from './ModalEspacio';
import listado from '../../styles/listado.module.css';
import shared from '../../styles/shared.module.css';
import styles from './Archivos.module.css';

/** Espacios de archivos por area (Planeación, Talento humano…): cada uno con su explorador */
export default function ArchivosEquipo() {
  const { esAdministrador } = useAuth();
  const [espacios, setEspacios] = useState(null);
  const [creando, setCreando] = useState(false);

  const cargar = () => listarEspacios()
    .then((e) => setEspacios(e.equipo))
    .catch(() => { setEspacios([]); toast.error('No se pudieron cargar los espacios.'); });

  useEffect(() => { cargar(); }, []);

  return (
    <PageContainer wide>
      <header className={listado.header}>
        <div>
          <h1 className={listado.title}>Áreas</h1>
          <p className={styles.subtitulo}>Los archivos de cada área (Talento Humano, Planeación…): solo los ven sus miembros, fuera de los proyectos.</p>
        </div>
        {esAdministrador && (
          <button className={shared.btnPrimary} onClick={() => setCreando(true)}>
            <Plus size={16} /> Nueva área
          </button>
        )}
      </header>

      {espacios === null ? (
        <p className={shared.loadingText}>Cargando…</p>
      ) : espacios.length === 0 ? (
        <div className={listado.vacio}>
          <b>{esAdministrador ? 'Aún no hay áreas' : 'Todavía no estás en ningún área'}</b>
          <span>
            {esAdministrador
              ? 'Crea uno por área (Planeación, Talento humano, Plantillas…) y elige quién lo ve.'
              : 'Cuando un administrador te agregue a un área, aparecerá aquí.'}
          </span>
          {esAdministrador && (
            <button className={shared.btnPrimary} onClick={() => setCreando(true)}><Plus size={16} /> Crear la primera</button>
          )}
        </div>
      ) : (
        <ul className={styles.espacios}>
          {espacios.map((e) => (
            <li key={e.id}>
              <Link to={`/archivos/equipo/${e.id}`} className={styles.tarjetaEspacio}>
                <IconoCarpeta color={e.color} size={40} />
                <span className={styles.tarjetaTexto}>
                  <b>{e.nombre}</b>
                  {e.descripcion && <small>{e.descripcion}</small>}
                </span>
                <span className={styles.tarjetaPie}>
                  <span>{plural(e.archivos, 'archivo', 'archivos')}</span>
                  {e.ultima_modificacion && <span>· {fechaRelativa(e.ultima_modificacion)}</span>}
                  <span className={styles.acceso}>
                    {e.abierto ? <><Globe size={13} /> Todos</> : <><Users size={13} /> {e.miembro_ids.length}</>}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {creando && (
        <ModalEspacio
          onClose={() => setCreando(false)}
          onGuardado={() => { setCreando(false); cargar(); }}
        />
      )}
    </PageContainer>
  );
}
