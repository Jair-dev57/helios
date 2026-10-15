import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileText, ListTodo, FolderKanban, Folder } from 'lucide-react';
import { obtenerActividad, enlaceEvento } from '../../api/historial';
import Avatar from '../../components/ui/Avatar';
import { fechaCompleta } from '../../utils/formato';
import tablero from '../../styles/tablero.module.css';
import styles from './Inicio.module.css';

const POR_PAGINA = 40;
// Filas a la vista y cuantas agrega «Ver más»
const INICIALES = 3;
const MAS = 6;
const FILTROS = [
  ['documento', 'Archivos', FileText],
  ['tarea', 'Tareas', ListTodo],
  ['proyecto', 'Proyectos', FolderKanban],
];
const ICONOS = { documento: FileText, tarea: ListTodo, proyecto: FolderKanban, carpeta: Folder };
const TONOS = { documento: 'var(--info)', tarea: 'var(--success)', proyecto: 'var(--accent)', carpeta: 'var(--warning)' };
const VERBOS = {
  creado: 'creó',
  actualizado: 'actualizó',
  completado: 'completó',
  eliminado: 'eliminó',
  papelera: 'movió a la papelera',
  restaurado: 'restauró',
  restringido: 'restringió',
  acceso_abierto: 'abrió el acceso a',
  recibido: 'recibió',
};
const ARTICULO = { tarea: 'la tarea ', proyecto: 'el proyecto ', carpeta: 'la carpeta ' };

const formatoHora = new Intl.DateTimeFormat('es-CO', { hour: 'numeric', minute: '2-digit' });
const formatoDia = new Intl.DateTimeFormat('es-CO', { weekday: 'short', day: 'numeric', month: 'short' });

// «subió», «modificó», «movió a En revisión»…, segun el tipo y lo que cambio
function verbo(e) {
  if (e.tipo === 'documento' && e.numero_version) return e.numero_version === 1 ? 'subió' : 'modificó';
  if (e.tipo === 'tarea' && e.accion === 'actualizado') {
    const columna = e.detalle?.match(/columna: .+? → ([^;]+)/)?.[1];
    if (columna) return `movió a ${columna}`;
  }
  const texto = VERBOS[e.accion] || e.accion;
  return e.accion === 'completado' ? texto : `${texto} ${ARTICULO[e.tipo] || ''}`.trim();
}

// Con «Tú» el verbo va en segunda persona: «Tú moviste», «Tú subiste»
const SEGUNDA_PERSONA = {
  creó: 'creaste', actualizó: 'actualizaste', completó: 'completaste', eliminó: 'eliminaste', movió: 'moviste',
  restauró: 'restauraste', restringió: 'restringiste', abrió: 'abriste', recibió: 'recibiste', subió: 'subiste', modificó: 'modificaste',
};
const conjugar = (frase, tu) => {
  if (!tu) return frase;
  const [primera, ...resto] = frase.split(' ');
  return [SEGUNDA_PERSONA[primera] || primera, ...resto].join(' ');
};

// «Hoy · 5:51 p. m.», «Ayer · …», «sáb 10 oct · …»
function cuando(iso) {
  const f = new Date(iso);
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const dia = new Date(f);
  dia.setHours(0, 0, 0, 0);
  const dias = Math.round((hoy - dia) / 86400000);
  const texto = dias === 0 ? 'Hoy' : dias === 1 ? 'Ayer' : formatoDia.format(f).replace(/\./g, '');
  return `${texto} · ${formatoHora.format(f)}`;
}

/**
 * Lo que paso en el periodo, al lado del mapa de calor y con su misma altura: «Ver más» agrega filas
 * dentro de la tarjeta (con scroll) sin agrandarla.
 */
export default function ActividadInicio({ desde, hasta, soloMias, usuarioId, periodo, className = '' }) {
  const [tipo, setTipo] = useState('');
  const [eventos, setEventos] = useState(null);
  const [hayMas, setHayMas] = useState(false);
  const [visibles, setVisibles] = useState(INICIALES);
  const lista = useRef(null);

  // Lleva la lista hasta la fila indicada (la primera nueva, o arriba al ver menos)
  const desplazarA = (fila) => requestAnimationFrame(() => {
    const el = lista.current;
    if (el) el.scrollTo({ top: fila ? el.children[fila]?.offsetTop ?? el.scrollHeight : 0, behavior: 'smooth' });
  });

  useEffect(() => {
    let cancelado = false;
    setEventos(null);
    setVisibles(INICIALES);
    obtenerActividad({ tipo, soloMias, desde, hasta, limite: POR_PAGINA })
      .then((lista) => { if (!cancelado) { setEventos(lista); setHayMas(lista.length === POR_PAGINA); } })
      .catch(() => { if (!cancelado) { setEventos([]); setHayMas(false); } });
    return () => { cancelado = true; };
  }, [tipo, soloMias, desde, hasta]);

  const verMas = async () => {
    // Trae la pagina siguiente si lo cargado no alcanza
    if (visibles + MAS > eventos.length && hayMas) {
      try {
        const lista = await obtenerActividad({ tipo, soloMias, desde, hasta, antesDe: eventos.at(-1).id, limite: POR_PAGINA });
        setEventos((prev) => [...prev, ...lista]);
        setHayMas(lista.length === POR_PAGINA);
      } catch {
        setHayMas(false);
      }
    }
    setVisibles(visibles + MAS);
    desplazarA(visibles);
  };

  return (
    <section className={`${tablero.tarjeta} ${tablero.panel} ${className}`}>
      <header className={tablero.panelCabecera}>
        <h2>Actividad<small>{periodo}</small></h2>
        <div className={styles.tipos} role="group" aria-label="Filtrar actividad">
          {eventos && visibles > INICIALES && (
            <button type="button" className={styles.enlace} onClick={() => { setVisibles(INICIALES); desplazarA(0); }}>Ver menos</button>
          )}
          {eventos && (eventos.length > visibles || hayMas) && (
            <button type="button" className={styles.enlace} onClick={verMas}>Ver más</button>
          )}
          {FILTROS.map(([valor, nombre, Icono]) => (
            <button
              key={valor}
              type="button"
              className={styles.tipo}
              aria-pressed={tipo === valor}
              title={nombre}
              aria-label={nombre}
              onClick={() => setTipo((t) => (t === valor ? '' : valor))}
            >
              <Icono size={14} />
            </button>
          ))}
        </div>
      </header>

      <div className={styles.eventosCaja}>
        {eventos === null ? (
          <p className={tablero.vacio}>Cargando…</p>
        ) : eventos.length === 0 ? (
          <p className={tablero.vacio}>Sin actividad en este periodo.</p>
        ) : (
          <ul ref={lista} className={styles.eventos}>
            {eventos.slice(0, visibles).map((e) => {
              const Icono = ICONOS[e.tipo] || FileText;
              const destino = enlaceEvento(e);
              const tu = e.usuario_id === usuarioId;
              const quien = tu ? 'Tú' : e.usuario_nombre?.split(' ')[0] || 'Alguien de afuera';
              const contenido = (
                <>
                  <span className={styles.evAvatar}>
                    <Avatar usuario={{ nombre: e.usuario_nombre || '?', avatar_url: e.usuario_avatar_url }} size={28} />
                    <span className={styles.evIcono} style={{ background: TONOS[e.tipo] || 'var(--text-muted)' }}><Icono size={9} strokeWidth={3} /></span>
                  </span>
                  <span className={styles.evTexto}>
                    <span className={styles.evFrase}><b>{quien}</b> {conjugar(verbo(e), tu)} <b>{e.entidad_nombre}</b></span>
                    <small>{e.proyecto_nombre}</small>
                  </span>
                  <time className={styles.evCuando} dateTime={e.created_at} title={fechaCompleta(e.created_at)}>{cuando(e.created_at)}</time>
                </>
              );
              return (
                <li key={e.id}>
                  {destino
                    ? <Link to={destino} className={styles.evento}>{contenido}</Link>
                    : <div className={styles.evento}>{contenido}</div>}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
