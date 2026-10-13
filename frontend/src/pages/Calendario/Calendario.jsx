import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ChevronLeft, ChevronRight, Flag, CheckCircle2, Circle } from 'lucide-react';
import { listarEventos } from '../../api/calendario';
import PageContainer from '../../components/PageContainer';
import { useAuth } from '../../hooks/useAuth';
import { useVistaGuardada } from '../../hooks/useVistaGuardada';
import listado from '../../styles/listado.module.css';
import styles from './Calendario.module.css';

const DIAS_SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const MAX_EN_CELDA = 3;
const formatoMes = new Intl.DateTimeFormat('es-CO', { month: 'long', year: 'numeric' });
const formatoDia = new Intl.DateTimeFormat('es-CO', { weekday: 'long', day: 'numeric', month: 'long' });

const dos = (n) => String(n).padStart(2, '0');
// Fecha local como 'AAAA-MM-DD' (asi llegan las fechas del servidor: dia calendario, sin hora)
const clave = (d) => `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;
const desdeClave = (c) => { const [a, m, d] = c.split('-').map(Number); return new Date(a, m - 1, d); };
const sumarDias = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

// Semanas visibles del mes: de lunes a domingo, completando con dias del mes anterior y el siguiente
function diasDeLaGrilla(mes) {
  const primero = new Date(mes.getFullYear(), mes.getMonth(), 1);
  const inicio = sumarDias(primero, -((primero.getDay() + 6) % 7));
  const ultimo = new Date(mes.getFullYear(), mes.getMonth() + 1, 0);
  const fin = sumarDias(ultimo, 6 - ((ultimo.getDay() + 6) % 7));
  const dias = [];
  for (let d = inicio; d <= fin; d = sumarDias(d, 1)) dias.push(d);
  return dias;
}

// Tono de cada evento: entrega, tarea abierta, vencida o terminada
function tono(e, hoy) {
  if (e.tipo === 'entrega') return e.estado === 'completado' ? 'hecho' : 'entrega';
  if (e.terminada) return 'hecho';
  return e.fecha < hoy ? 'vencida' : 'tarea';
}

const enlace = (e) => (e.tipo === 'entrega' ? `/proyectos/${e.proyecto_id}` : `/proyectos/${e.proyecto_id}/tareas?tarea=${e.id}`);

export default function Calendario() {
  const { tieneSeccion } = useAuth();
  const hoy = clave(new Date());
  const [mes, setMes] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [seleccionado, setSeleccionado] = useState(hoy);
  const puedeVerEquipo = tieneSeccion('tareas');
  const [alcance, setAlcance] = useVistaGuardada('calendario.alcance', ['mias', 'equipo'], 'mias');
  const soloMias = alcance === 'mias' || !puedeVerEquipo;
  const [eventos, setEventos] = useState(null);

  const dias = useMemo(() => diasDeLaGrilla(mes), [mes]);
  const desde = clave(dias[0]);
  const hasta = clave(dias[dias.length - 1]);

  useEffect(() => {
    let cancelado = false;
    setEventos(null);
    listarEventos(desde, hasta, soloMias)
      .then((e) => { if (!cancelado) setEventos(e); })
      .catch(() => {
        if (!cancelado) setEventos([]);
        toast.error('No se pudo cargar el calendario.');
      });
    return () => { cancelado = true; };
  }, [desde, hasta, soloMias]);

  const porDia = useMemo(() => {
    const m = new Map();
    for (const e of eventos || []) {
      if (!m.has(e.fecha)) m.set(e.fecha, []);
      m.get(e.fecha).push(e);
    }
    return m;
  }, [eventos]);

  const irAMes = (paso) => setMes((m) => new Date(m.getFullYear(), m.getMonth() + paso, 1));
  const irAHoy = () => {
    const d = new Date();
    setMes(new Date(d.getFullYear(), d.getMonth(), 1));
    setSeleccionado(hoy);
  };
  const elegirDia = (d) => {
    setSeleccionado(clave(d));
    if (d.getMonth() !== mes.getMonth()) setMes(new Date(d.getFullYear(), d.getMonth(), 1));
  };

  const delDia = porDia.get(seleccionado) || [];
  const delMes = (eventos || []).filter((e) => desdeClave(e.fecha).getMonth() === mes.getMonth());
  const conteo = {
    entregas: delMes.filter((e) => e.tipo === 'entrega').length,
    tareas: delMes.filter((e) => e.tipo === 'tarea' && !e.terminada).length,
    vencidas: delMes.filter((e) => tono(e, hoy) === 'vencida').length,
  };

  return (
    <PageContainer wide>
      <header className={listado.header}>
        <div>
          <h1 className={listado.title}>Calendario</h1>
          <p className={styles.resumen}>
            {eventos === null ? 'Cargando…'
              : `${conteo.tareas} tarea${conteo.tareas === 1 ? '' : 's'} y ${conteo.entregas} entrega${conteo.entregas === 1 ? '' : 's'} este mes`
                + (conteo.vencidas ? ` · ${conteo.vencidas} vencida${conteo.vencidas === 1 ? '' : 's'}` : '')}
          </p>
        </div>
      </header>

      <div className={styles.barra}>
        <div className={styles.navegacion}>
          <button className={styles.icono} onClick={() => irAMes(-1)} aria-label="Mes anterior"><ChevronLeft size={18} /></button>
          <button className={styles.hoy} onClick={irAHoy}>Hoy</button>
          <button className={styles.icono} onClick={() => irAMes(1)} aria-label="Mes siguiente"><ChevronRight size={18} /></button>
          <h2 className={styles.mes}>{formatoMes.format(mes)}</h2>
        </div>
        <div className={styles.leyenda} aria-hidden="true">
          <span className={styles.entrega}>Entrega</span>
          <span className={styles.tarea}>Tarea</span>
          <span className={styles.vencida}>Vencida</span>
        </div>
        {puedeVerEquipo && (
          <div className={listado.vista} role="group" aria-label="Qué tareas mostrar">
            <button type="button" aria-pressed={alcance === 'mias'} onClick={() => setAlcance('mias')}>Mías</button>
            <button type="button" aria-pressed={alcance === 'equipo'} onClick={() => setAlcance('equipo')}>Todo el equipo</button>
          </div>
        )}
      </div>

      <div className={styles.distribucion}>
        <div className={styles.calendario} role="grid" aria-label={formatoMes.format(mes)}>
          {DIAS_SEMANA.map((d) => <div key={d} className={styles.diaSemana} role="columnheader">{d}</div>)}
          {dias.map((d) => {
            const c = clave(d);
            const lista = porDia.get(c) || [];
            const fuera = d.getMonth() !== mes.getMonth();
            return (
              <button
                key={c}
                type="button"
                role="gridcell"
                className={`${styles.dia} ${fuera ? styles.fuera : ''} ${c === hoy ? styles.esHoy : ''} ${c === seleccionado ? styles.elegido : ''}`}
                onClick={() => elegirDia(d)}
                aria-label={`${formatoDia.format(d)}: ${lista.length ? `${lista.length} evento${lista.length === 1 ? '' : 's'}` : 'sin eventos'}`}
                aria-selected={c === seleccionado}
              >
                <span className={styles.numero}>{d.getDate()}</span>
                <span className={styles.eventos}>
                  {lista.slice(0, MAX_EN_CELDA).map((e) => (
                    <span key={`${e.tipo}${e.id}`} className={`${styles.chip} ${styles[tono(e, hoy)]}`} title={`${e.titulo} · ${e.proyecto_nombre}`}>
                      {e.titulo}
                    </span>
                  ))}
                  {lista.length > MAX_EN_CELDA && <span className={styles.mas}>+{lista.length - MAX_EN_CELDA} más</span>}
                </span>
              </button>
            );
          })}
        </div>

        <aside className={styles.agenda} aria-live="polite">
          <h3>{seleccionado === hoy ? 'Hoy' : formatoDia.format(desdeClave(seleccionado))}</h3>
          {delDia.length === 0 ? (
            <p className={styles.agendaVacia}>{eventos === null ? 'Cargando…' : 'No hay tareas ni entregas este día.'}</p>
          ) : (
            <ul>
              {delDia.map((e) => {
                const t = tono(e, hoy);
                const Icono = e.tipo === 'entrega' ? Flag : e.terminada ? CheckCircle2 : Circle;
                return (
                  <li key={`${e.tipo}${e.id}`}>
                    <Link to={enlace(e)} className={`${styles.evento} ${styles[t]}`}>
                      <Icono size={16} />
                      <span className={styles.eventoTexto}>
                        <b>{e.tipo === 'entrega' ? `Entrega: ${e.titulo}` : e.titulo}</b>
                        <small>
                          {e.tipo === 'tarea' ? e.proyecto_nombre : 'Fecha de entrega del proyecto'}
                          {e.tipo === 'tarea' && !soloMias && ` · ${e.asignado_a_mi ? 'Tú' : e.asignado || 'Sin asignar'}`}
                          {t === 'vencida' && ' · Vencida'}
                          {e.prioridad === 'alta' && !e.terminada && ' · Prioridad alta'}
                        </small>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </aside>
      </div>
    </PageContainer>
  );
}
