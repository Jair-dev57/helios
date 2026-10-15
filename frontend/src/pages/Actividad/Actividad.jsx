import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { FileText, ListTodo, FolderKanban, Folder, Search, X } from 'lucide-react';
import { obtenerActividad, obtenerResumenActividad, enlaceEvento } from '../../api/historial';
import PageContainer from '../../components/PageContainer';
import Avatar from '../../components/Avatar';
import { fechaCompleta, plural } from '../Proyectos/formato';
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
const ICONOS = { documento: FileText, carpeta: Folder, tarea: ListTodo, proyecto: FolderKanban };
const SUSTANTIVO = { proyecto: 'el proyecto', tarea: 'la tarea', documento: 'el archivo', carpeta: 'la carpeta' };

// Clase de cada accion: da el color de la etiqueta, del punto en la linea de tiempo y del resumen
const CLASE_ACCION = {
  creado: 'nuevo',
  recibido: 'nuevo',
  actualizado: 'editado',
  restringido: 'acceso',
  acceso_abierto: 'acceso',
  completado: 'completado',
  papelera: 'papelera',
  eliminado: 'papelera',
  restaurado: 'restaurado',
};
const ETIQUETA_CLASE = {
  nuevo: 'Nuevo',
  editado: 'Editado',
  completado: 'Completado',
  papelera: 'Papelera',
  restaurado: 'Restaurado',
  acceso: 'Acceso',
};

// [tercera persona, segunda persona]
const VERBOS = {
  creado: ['creó', 'creaste'],
  actualizado: ['actualizó', 'actualizaste'],
  completado: ['completó', 'completaste'],
  eliminado: ['eliminó', 'eliminaste'],
  papelera: ['movió a la papelera', 'moviste a la papelera'],
  restaurado: ['restauró', 'restauraste'],
  restringido: ['restringió el acceso a', 'restringiste el acceso a'],
  acceso_abierto: ['abrió a todo el equipo', 'abriste a todo el equipo'],
};

function verbo(e, propio) {
  const i = propio ? 1 : 0;
  if (e.tipo === 'documento' && e.numero_version === 1) return ['subió', 'subiste'][i];
  if (e.tipo === 'documento' && e.numero_version > 1) return `${['subió', 'subiste'][i]} la versión ${e.numero_version} de`;
  return VERBOS[e.accion]?.[i] || e.accion;
}

const formatoDia = new Intl.DateTimeFormat('es-CO', { weekday: 'long', day: 'numeric', month: 'long' });
const formatoHora = new Intl.DateTimeFormat('es-CO', { hour: 'numeric', minute: '2-digit' });
const formatoInicial = new Intl.DateTimeFormat('es-CO', { weekday: 'narrow' });
const formatoDiaLargo = new Intl.DateTimeFormat('es-CO', { weekday: 'long', day: 'numeric', month: 'short' });

const claveDia = (iso) => { const d = new Date(iso); return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; };
function tituloDia(iso) {
  const d = new Date(iso);
  const hoy = new Date();
  const ayer = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - 1);
  const texto = formatoDia.format(d);
  if (claveDia(d) === claveDia(hoy)) return `Hoy · ${texto}`;
  if (claveDia(d) === claveDia(ayer)) return `Ayer · ${texto}`;
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

// "2026-09-25" -> "25 sep" (con año si no es el actual)
const fechaLocal = (aaaammdd) => { const [a, m, d] = aaaammdd.split('-').map(Number); return new Date(a, m - 1, d); };
function valorCambio(valor) {
  if (valor === null || valor === undefined) return 'Sin valor';
  if (/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
    const fecha = fechaLocal(valor);
    return fecha.toLocaleDateString('es-CO', {
      day: 'numeric',
      month: 'short',
      year: fecha.getFullYear() === new Date().getFullYear() ? undefined : 'numeric',
    });
  }
  return valor.length > 80 ? `${valor.slice(0, 80)}…` : valor;
}

// Ediciones seguidas del mismo elemento, por la misma persona y en menos de una hora, van en una sola fila
const UNA_HORA = 60 * 60 * 1000;
function agruparEdiciones(eventos) {
  const filas = [];
  for (const e of eventos) {
    const anterior = filas.at(-1);
    if (
      anterior &&
      e.accion === 'actualizado' && anterior.accion === 'actualizado' &&
      e.tipo === anterior.tipo && e.entidad_id === anterior.entidad_id && e.usuario_id === anterior.usuario_id &&
      !e.numero_version && claveDia(e.created_at) === claveDia(anterior.created_at) &&
      new Date(anterior.grupo.at(-1).created_at) - new Date(e.created_at) < UNA_HORA
    ) {
      anterior.grupo.push(e);
    } else {
      filas.push({ ...e, grupo: [e] });
    }
  }
  return filas;
}

// Las filas seguidas del mismo dia van juntas bajo su fecha
function agruparPorDia(filas) {
  const dias = [];
  for (const f of filas) {
    const clave = claveDia(f.created_at);
    if (dias.at(-1)?.clave !== clave) dias.push({ clave, titulo: tituloDia(f.created_at), filas: [], total: 0 });
    dias.at(-1).filas.push(f);
    dias.at(-1).total += f.grupo.length;
  }
  return dias;
}

function Cambios({ fila }) {
  const [abierto, setAbierto] = useState(false);
  const conCambios = fila.grupo.filter((e) => e.cambios?.length);
  if (!conCambios.length) {
    return fila.detalle ? <p className={styles.detalle}>{fila.detalle}</p> : null;
  }
  const visibles = abierto ? conCambios : conCambios.slice(0, 1);
  return (
    <>
      <div className={styles.cambios}>
        {visibles.flatMap((e) =>
          e.cambios.map((c, i) => (
            <div key={`${e.id}-${i}`} className={styles.cambio}>
              <span className={styles.campo}>{c.etiqueta}</span>
              <s title={c.antes || undefined}>{valorCambio(c.antes)}</s>
              <span aria-hidden="true">→</span>
              <strong title={c.despues || undefined}>{valorCambio(c.despues)}</strong>
            </div>
          ))
        )}
      </div>
      {conCambios.length > 1 && (
        <button type="button" className={styles.verCambios} onClick={() => setAbierto(!abierto)}>
          {abierto ? 'Ver menos' : `Ver los ${conCambios.length} cambios`}
        </button>
      )}
    </>
  );
}

function Evento({ fila, propio }) {
  const Icono = ICONOS[fila.tipo] || FileText;
  const destino = enlaceEvento(fila);
  const clase = CLASE_ACCION[fila.accion] || 'editado';
  const nombre = destino ? <Link to={destino}>«{fila.entidad_nombre}»</Link> : <span>«{fila.entidad_nombre}»</span>;
  const quien = propio ? 'Tú' : fila.usuario_nombre || 'Alguien de afuera';

  return (
    <li className={`${styles.evento} ${styles[clase]}`}>
      <Avatar usuario={{ nombre: fila.usuario_nombre || '?', avatar_url: fila.usuario_avatar_url }} size={32} />
      <div className={styles.cuerpo}>
        <p className={styles.texto}>
          <span className={styles.etiqueta}>{ETIQUETA_CLASE[clase]}</span>
          {fila.accion === 'recibido' ? (
            <>Llegó {SUSTANTIVO[fila.tipo] || ''} {nombre} por un enlace para solicitar archivos</>
          ) : (
            <><b>{quien}</b> {verbo(fila, propio)} {SUSTANTIVO[fila.tipo] || fila.tipo} {nombre}</>
          )}
          {fila.grupo.length > 1 && <span className={styles.veces}> · {fila.grupo.length} cambios</span>}
        </p>
        <Cambios fila={fila} />
      </div>
      <div className={styles.lado}>
        <time dateTime={fila.created_at} title={fechaCompleta(fila.created_at)}>{formatoHora.format(new Date(fila.created_at))}</time>
        {fila.proyecto_nombre && fila.tipo !== 'proyecto' && (
          <Link to={`/proyectos/${fila.proyecto_id}`} className={styles.proyecto}>
            <Icono size={12} />
            {fila.proyecto_nombre}
          </Link>
        )}
      </div>
    </li>
  );
}

function Resumen({ resumen }) {
  const total = resumen.dias.reduce((n, d) => n + d.total, 0);
  const maximo = Math.max(1, ...resumen.dias.map((d) => d.total));
  const porClase = {};
  for (const [accion, n] of Object.entries(resumen.por_accion)) {
    const clase = CLASE_ACCION[accion] || 'editado';
    porClase[clase] = (porClase[clase] || 0) + n;
  }
  const clases = Object.keys(ETIQUETA_CLASE).filter((c) => porClase[c]);

  return (
    <section className={styles.tarjeta}>
      <h2 className={styles.tarjetaTitulo}>Últimos 7 días</h2>
      <p className={styles.total}><strong>{total}</strong> {total === 1 ? 'cambio' : 'cambios'}</p>
      <div className={styles.barras}>
        {resumen.dias.map((d, i) => (
          <div key={d.fecha} className={styles.columnaBarra} title={`${formatoDiaLargo.format(fechaLocal(d.fecha))}: ${plural(d.total, 'cambio')}`}>
            <span
              className={i === resumen.dias.length - 1 ? styles.barraHoy : styles.barra}
              style={{ height: `${(d.total / maximo) * 100}%` }}
            />
            <span className={styles.inicialDia}>{formatoInicial.format(fechaLocal(d.fecha)).toUpperCase()}</span>
          </div>
        ))}
      </div>
      {clases.length > 0 && (
        <>
          <div className={styles.reparto}>
            {clases.map((c) => <span key={c} className={styles[c]} style={{ flex: porClase[c] }} />)}
          </div>
          <div className={styles.leyenda}>
            {clases.map((c) => (
              <span key={c} className={styles[c]}><i />{ETIQUETA_CLASE[c]} {porClase[c]}</span>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function ListaFiltro({ titulo, filas, activo, onElegir, render }) {
  if (!filas.length) return null;
  const maximo = Math.max(...filas.map((f) => f.total));
  return (
    <section className={styles.tarjeta}>
      <h2 className={styles.tarjetaTitulo}>
        {titulo}
        {activo && <button type="button" onClick={() => onElegir(null)}>Ver todo</button>}
      </h2>
      <div className={styles.filasFiltro}>
        {filas.map((f) => (
          <button
            key={f.id}
            type="button"
            className={f.id === activo ? styles.filaFiltroActiva : styles.filaFiltro}
            aria-pressed={f.id === activo}
            onClick={() => onElegir(f.id === activo ? null : f.id)}
          >
            {render(f)}
            <span className={styles.medidor}><i style={{ width: `${(f.total / maximo) * 100}%` }} /></span>
            <span className={styles.cuenta}>{f.total}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

export default function Actividad() {
  const { user } = useAuth();
  const [tipo, setTipo] = useState('');
  const [alcance, setAlcance] = useVistaGuardada('actividad.alcance', ['todos', 'mias'], 'todos');
  const [persona, setPersona] = useState(null);
  const [proyecto, setProyecto] = useState(null);
  const [texto, setTexto] = useState('');
  const [buscar, setBuscar] = useState('');
  const [eventos, setEventos] = useState(null);
  const [resumen, setResumen] = useState(null);
  const [hayMas, setHayMas] = useState(false);
  const [cargandoMas, setCargandoMas] = useState(false);

  const soloMias = alcance === 'mias';
  const usuarioId = soloMias ? undefined : persona || undefined;

  // La busqueda espera a que se deje de escribir
  useEffect(() => {
    const t = setTimeout(() => setBuscar(texto.trim()), 300);
    return () => clearTimeout(t);
  }, [texto]);

  const pedir = useCallback(
    (antesDe) => obtenerActividad({
      tipo, soloMias, usuarioId, proyectoId: proyecto || undefined, buscar, antesDe, limite: POR_PAGINA,
    }),
    [tipo, soloMias, usuarioId, proyecto, buscar],
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

  useEffect(() => {
    let cancelado = false;
    obtenerResumenActividad({ tipo, soloMias, usuarioId, proyectoId: proyecto || undefined })
      .then((r) => !cancelado && setResumen(r))
      .catch(() => !cancelado && setResumen(null));
    return () => { cancelado = true; };
  }, [tipo, soloMias, usuarioId, proyecto]);

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

  const nombrePersona = resumen?.personas.find((p) => p.usuario_id === persona)?.nombre;
  const nombreProyecto = resumen?.proyectos.find((p) => p.proyecto_id === proyecto)?.nombre;
  const hayFiltros = tipo || (!soloMias && persona) || proyecto || buscar;

  return (
    <PageContainer wide>
      <header className={listado.header}>
        <div>
          <h1 className={listado.title}>Actividad</h1>
          <p className={styles.resumen}>Lo que pasa en Helios: archivos, tareas y proyectos de todo el equipo.</p>
        </div>
        <div className={styles.herramientas}>
          <label className={styles.buscador}>
            <Search size={16} />
            <input
              type="search"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="Buscar en la actividad"
              aria-label="Buscar en la actividad"
            />
          </label>
          <div className={listado.pestanas} role="group" aria-label="De quién">
            <button type="button" aria-pressed={!soloMias} onClick={() => setAlcance('todos')}>Todo el equipo</button>
            <button type="button" aria-pressed={soloMias} onClick={() => setAlcance('mias')}>Solo lo mío</button>
          </div>
        </div>
      </header>

      <div className={styles.distribucion}>
        <div className={styles.principal}>
          <div className={styles.filtros}>
            <div className={listado.pestanas} role="group" aria-label="Qué mostrar">
              {FILTROS.map(([id, nombre]) => (
                <button key={id || 'todo'} type="button" aria-pressed={tipo === id} onClick={() => setTipo(id)}>{nombre}</button>
              ))}
            </div>
            {!soloMias && persona && nombrePersona && (
              <button type="button" className={styles.chipFiltro} onClick={() => setPersona(null)}>
                {persona === user?.id ? 'Tú' : nombrePersona} <X size={14} />
              </button>
            )}
            {proyecto && nombreProyecto && (
              <button type="button" className={styles.chipFiltro} onClick={() => setProyecto(null)}>
                {nombreProyecto} <X size={14} />
              </button>
            )}
          </div>

          {eventos === null ? (
            <p className={styles.cargando}>Cargando…</p>
          ) : eventos.length === 0 ? (
            <div className={listado.vacio}>
              <b>Sin actividad</b>
              <span>
                {hayFiltros
                  ? 'Nada coincide con estos filtros.'
                  : soloMias ? 'Aún no has hecho cambios.' : 'Cuando el equipo cree o cambie algo, aparecerá aquí.'}
              </span>
            </div>
          ) : (
            <>
              {agruparPorDia(agruparEdiciones(eventos)).map((d) => (
                <section key={d.clave} className={styles.dia}>
                  <h2 className={styles.diaTitulo}>
                    {d.titulo}
                    <span>{plural(d.total, 'cambio')}</span>
                  </h2>
                  <ol className={styles.lista}>
                    {d.filas.map((f) => (
                      <Evento key={f.id} fila={f} propio={!!f.usuario_id && f.usuario_id === user?.id} />
                    ))}
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
        </div>

        {resumen && (
          <aside className={styles.lateral}>
            <Resumen resumen={resumen} />
            {!soloMias && (
              <ListaFiltro
                titulo="Personas · 30 días"
                filas={resumen.personas.map((p) => ({ ...p, id: p.usuario_id }))}
                activo={persona}
                onElegir={setPersona}
                render={(p) => (
                  <>
                    <Avatar usuario={{ nombre: p.nombre, avatar_url: p.avatar_url }} size={24} />
                    <span className={styles.nombreFiltro}>{p.usuario_id === user?.id ? `${p.nombre} (tú)` : p.nombre}</span>
                  </>
                )}
              />
            )}
            <ListaFiltro
              titulo="Proyectos · 30 días"
              filas={resumen.proyectos.map((p) => ({ ...p, id: p.proyecto_id }))}
              activo={proyecto}
              onElegir={setProyecto}
              render={(p) => (
                <>
                  <FolderKanban size={16} className={styles.iconoFiltro} />
                  <span className={styles.nombreFiltro}>{p.nombre}</span>
                </>
              )}
            />
          </aside>
        )}
      </div>
    </PageContainer>
  );
}
