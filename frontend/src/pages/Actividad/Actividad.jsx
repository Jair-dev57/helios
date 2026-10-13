import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { FileText, ListTodo, FolderKanban } from 'lucide-react';
import { obtenerActividad } from '../../api/historial';
import PageContainer from '../../components/PageContainer';
import Avatar from '../../components/Avatar';
import { fechaCompleta } from '../Proyectos/formato';
import { useAuth } from '../../hooks/useAuth';
import { useVistaGuardada } from '../../hooks/useVistaGuardada';
import listado from '../../styles/listado.module.css';
import styles from './Actividad.module.css';

const POR_PAGINA = 40;
const FILTROS = [
  ['', 'Todo'],
  ['documento', 'Archivos'],
  ['tarea', 'Tareas'],
  ['proyecto', 'Proyectos'],
];
const ICONOS = { documento: FileText, tarea: ListTodo, proyecto: FolderKanban };

const formatoDia = new Intl.DateTimeFormat('es-CO', { weekday: 'long', day: 'numeric', month: 'long' });
const formatoHora = new Intl.DateTimeFormat('es-CO', { hour: 'numeric', minute: '2-digit' });

const claveDia = (iso) => { const d = new Date(iso); return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; };
function tituloDia(iso) {
  const d = new Date(iso);
  const hoy = new Date();
  const ayer = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - 1);
  if (claveDia(d) === claveDia(hoy)) return 'Hoy';
  if (claveDia(d) === claveDia(ayer)) return 'Ayer';
  const texto = formatoDia.format(d);
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

// A donde lleva cada evento; lo eliminado ya no tiene a donde ir
function enlaceDe(e) {
  if (e.accion === 'eliminado' || !e.proyecto_id) return null;
  if (e.tipo === 'documento') return e.accion === 'papelera' ? null : `/proyectos/${e.proyecto_id}/documentos?doc=${e.entidad_id}`;
  if (e.tipo === 'tarea') return `/proyectos/${e.proyecto_id}/tareas?tarea=${e.entidad_id}`;
  return `/proyectos/${e.proyecto_id}`;
}

// Los eventos seguidos del mismo dia van juntos bajo su fecha
function agruparPorDia(eventos) {
  const grupos = [];
  for (const e of eventos) {
    const clave = claveDia(e.created_at);
    if (grupos.at(-1)?.clave !== clave) grupos.push({ clave, titulo: tituloDia(e.created_at), eventos: [] });
    grupos.at(-1).eventos.push(e);
  }
  return grupos;
}

export default function Actividad() {
  const { user } = useAuth();
  const [tipo, setTipo] = useState('');
  const [alcance, setAlcance] = useVistaGuardada('actividad.alcance', ['todos', 'mias'], 'todos');
  const [eventos, setEventos] = useState(null);
  const [hayMas, setHayMas] = useState(false);
  const [cargandoMas, setCargandoMas] = useState(false);

  const pedir = useCallback(
    (antesDe) => obtenerActividad({ tipo, soloMias: alcance === 'mias', antesDe, limite: POR_PAGINA }),
    [tipo, alcance],
  );

  useEffect(() => {
    let cancelado = false;
    setEventos(null);
    pedir()
      .then((lista) => {
        if (cancelado) return;
        setEventos(lista);
        setHayMas(lista.length === POR_PAGINA);
      })
      .catch(() => {
        if (cancelado) return;
        setEventos([]);
        toast.error('No se pudo cargar la actividad.');
      });
    return () => { cancelado = true; };
  }, [pedir]);

  const cargarMas = async () => {
    setCargandoMas(true);
    try {
      const lista = await pedir(eventos.at(-1).id);
      setEventos((prev) => [...prev, ...lista]);
      setHayMas(lista.length === POR_PAGINA);
    } catch {
      toast.error('No se pudo cargar más actividad.');
    } finally {
      setCargandoMas(false);
    }
  };

  return (
    <PageContainer>
      <header className={listado.header}>
        <div>
          <h1 className={listado.title}>Actividad</h1>
          <p className={styles.resumen}>Lo que pasa en Helios: archivos, tareas y proyectos de todo el equipo.</p>
        </div>
      </header>

      <div className={listado.herramientas}>
        <div className={listado.pestanas} role="group" aria-label="Qué mostrar">
          {FILTROS.map(([id, texto]) => (
            <button key={id || 'todo'} type="button" aria-pressed={tipo === id} onClick={() => setTipo(id)}>{texto}</button>
          ))}
        </div>
        <div className={listado.espacio} />
        <div className={listado.vista} role="group" aria-label="De quién">
          <button type="button" aria-pressed={alcance === 'todos'} onClick={() => setAlcance('todos')}>Todo el equipo</button>
          <button type="button" aria-pressed={alcance === 'mias'} onClick={() => setAlcance('mias')}>Solo lo mío</button>
        </div>
      </div>

      {eventos === null ? (
        <p className={styles.cargando}>Cargando…</p>
      ) : eventos.length === 0 ? (
        <div className={listado.vacio}>
          <b>Sin actividad</b>
          <span>{alcance === 'mias' ? 'Aún no has hecho cambios de este tipo.' : 'Cuando el equipo cree o cambie algo, aparecerá aquí.'}</span>
        </div>
      ) : (
        <>
          {agruparPorDia(eventos).map((g) => (
            <section key={g.clave} className={styles.dia}>
              <h2 className={styles.diaTitulo}>{g.titulo}</h2>
              <ol className={styles.lista}>
                {g.eventos.map((e) => {
                  const Icono = ICONOS[e.tipo] || FileText;
                  const destino = enlaceDe(e);
                  const propio = e.usuario_id && e.usuario_id === user?.id;
                  return (
                    <li key={e.id} className={styles.evento}>
                      <span className={styles.quien}>
                        <Avatar usuario={{ nombre: e.usuario_nombre || '?', avatar_url: e.usuario_avatar_url }} size={34} />
                        <span className={`${styles.tipo} ${styles[e.tipo] || ''}`}><Icono size={11} /></span>
                      </span>
                      <div className={styles.cuerpo}>
                        <p className={styles.texto}>
                          <b>{propio ? 'Tú' : e.usuario_nombre || 'Alguien de afuera'}</b>{' · '}
                          {destino ? <Link to={destino}>{e.texto}</Link> : e.texto}
                        </p>
                        {e.detalle && <p className={styles.detalle}>{e.detalle}</p>}
                        <p className={styles.meta}>
                          <time dateTime={e.created_at} title={fechaCompleta(e.created_at)}>{formatoHora.format(new Date(e.created_at))}</time>
                          {e.proyecto_nombre && e.tipo !== 'proyecto' && (
                            <> · <Link to={`/proyectos/${e.proyecto_id}`}>{e.proyecto_nombre}</Link></>
                          )}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </section>
          ))}
          {hayMas && (
            <button className={styles.mas} onClick={cargarMas} disabled={cargandoMas}>
              {cargandoMas ? 'Cargando…' : 'Ver actividad anterior'}
            </button>
          )}
        </>
      )}
    </PageContainer>
  );
}
