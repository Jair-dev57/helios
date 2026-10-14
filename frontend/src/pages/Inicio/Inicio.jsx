import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { X } from 'lucide-react';
import { obtenerDashboard } from '../../api/dashboard';
import PageContainer from '../../components/PageContainer';
import { useAuth } from '../../hooks/useAuth';
import { useVistaGuardada } from '../../hooks/useVistaGuardada';
import { Anillo, MiniBarras, MapaProyectos, BarrasTerminadas, LineasFlujo, MapaCalor } from './Graficos';
import ActividadInicio from './ActividadInicio';
import styles from './Inicio.module.css';

const DIA_MS = 86400000;
const PERIODOS = { dia: ['Día', 1], semana: ['Semana', 7], mes: ['Mes', 30] };
// Puntos de vencidas antes de resumir en «+N»
const MAX_PUNTOS = 24;

const formatoDiaSemana = new Intl.DateTimeFormat('es-CO', { weekday: 'short' });
const formatoDiaMes = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short' });
const formatoDiaLargo = new Intl.DateTimeFormat('es-CO', { weekday: 'long', day: 'numeric', month: 'short' });
// «14 de oct.» → «14 oct»
const sinPunto = (texto) => texto.replace(/\./g, '').replace(' de ', ' ');

function saludo() {
  const h = new Date().getHours();
  if (h < 12) return 'Buenos días';
  if (h < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

const inicioDelDia = (fecha) => { const d = new Date(fecha); d.setHours(0, 0, 0, 0); return d; };
const esHoy = (fecha) => inicioDelDia(fecha).getTime() === inicioDelDia(new Date()).getTime();

// [desde, hasta): el dia elegido en el mapa de calor, o los ultimos 1, 7 o 30 dias hasta hoy
function calcularRango(periodo, dia) {
  const dias = dia ? 1 : PERIODOS[periodo][1];
  const hasta = inicioDelDia(dia || new Date());
  hasta.setDate(hasta.getDate() + 1);
  const desde = new Date(hasta);
  desde.setDate(hasta.getDate() - dias);
  return { desde, hasta, dias };
}

// Un dia se ve por horas; una semana o un mes, por dias
function calcularCubetas({ desde, dias }) {
  if (dias === 1) {
    return Array.from({ length: 24 }, (_, h) => {
      const a = new Date(desde);
      a.setHours(h);
      const b = new Date(desde);
      b.setHours(h + 1);
      return { desde: a, hasta: b, etiqueta: `${h}h`, detalle: `${h}:00 – ${h + 1}:00` };
    });
  }
  return Array.from({ length: dias }, (_, i) => {
    const a = new Date(desde);
    a.setDate(desde.getDate() + i);
    const b = new Date(a);
    b.setDate(a.getDate() + 1);
    const etiqueta = sinPunto(dias === 7 ? formatoDiaSemana.format(a) : formatoDiaMes.format(a));
    return { desde: a, hasta: b, etiqueta, detalle: sinPunto(formatoDiaLargo.format(a)) };
  });
}

const contarPorCubeta = (cubetas, fechas) => {
  const conteo = cubetas.map(() => 0);
  fechas.forEach((iso) => {
    const f = new Date(iso);
    const i = cubetas.findIndex((c) => f >= c.desde && f < c.hasta);
    if (i >= 0) conteo[i] += 1;
  });
  return conteo;
};
const acumular = (valores) => { let suma = 0; return valores.map((v) => (suma += v)); };

const colorAtraso = (dias) => (dias <= 3 ? 'var(--warning)' : dias <= 7 ? 'color-mix(in srgb, var(--warning), var(--danger))' : 'var(--danger)');

/**
 * Inicio: tablero con un solo filtro para todo. Equipo / Yo elige de quien es lo que se ve (Equipo pide la
 * seccion «actividad»); Dia / Semana / Mes, o un dia tocado en el mapa de calor, el periodo.
 */
export default function Inicio() {
  const { user, tieneSeccion } = useAuth();
  const navigate = useNavigate();
  const conEquipo = tieneSeccion('actividad');
  const [alcanceGuardado, setAlcance] = useVistaGuardada('inicio.alcance', ['equipo', 'yo'], 'equipo');
  const [periodo, setPeriodo] = useVistaGuardada('inicio.periodo', Object.keys(PERIODOS), 'semana');
  const [dia, setDia] = useState(null);
  const [datos, setDatos] = useState(null);

  const alcance = conEquipo ? alcanceGuardado : 'yo';
  const soloMias = alcance === 'yo';
  const rango = useMemo(() => calcularRango(periodo, dia), [periodo, dia]);
  const cubetas = useMemo(() => calcularCubetas(rango), [rango]);

  useEffect(() => {
    let cancelado = false;
    setDatos(null);
    obtenerDashboard({ desde: rango.desde, hasta: rango.hasta, soloMias })
      .then((d) => { if (!cancelado) setDatos(d); })
      .catch(() => { if (!cancelado) toast.error('No se pudieron cargar las métricas.'); });
    return () => { cancelado = true; };
  }, [rango, soloMias]);

  const nombrePeriodo = dia
    ? (esHoy(dia) ? 'hoy' : sinPunto(formatoDiaLargo.format(dia)))
    : { dia: 'hoy', semana: 'últimos 7 días', mes: 'últimos 30 días' }[periodo];
  const periodoAnterior = rango.dias === 1 ? (dia && !esHoy(dia) ? 'el día anterior' : 'ayer') : `los ${rango.dias} días anteriores`;

  const series = useMemo(() => {
    if (!datos) return null;
    const terminadas = contarPorCubeta(cubetas, datos.terminadas);
    const creadas = contarPorCubeta(cubetas, datos.creadas);
    // Posicion de cada proyecto al inicio y al final del periodo (el final, como mucho, ahora)
    const fin = Math.min(rango.hasta.getTime(), Date.now());
    const proyectos = datos.proyectos.map((p) => {
      const inicio = new Date(p.inicio).getTime();
      // La entrega es un dia: el plazo vence al terminar ese dia
      const duracion = Math.max(DIA_MS, new Date(p.entrega).getTime() + DIA_MS - inicio);
      const avance = (hechas) => (p.tareas ? (hechas / p.tareas) * 100 : 0);
      return {
        id: p.id,
        nombre: p.nombre,
        t0: Math.max(0, ((rango.desde.getTime() - inicio) / duracion) * 100),
        t1: ((fin - inicio) / duracion) * 100,
        a0: avance(p.hechas_al_inicio),
        a1: avance(p.hechas_al_final),
      };
    });
    return { terminadas, creadas, proyectos };
  }, [datos, cubetas, rango]);

  const elegirDia = (f) => setDia((actual) => (actual && actual.getTime() === f.getTime() ? null : f));

  const totalTerminadas = datos?.terminadas.length ?? 0;
  const diferencia = datos ? totalTerminadas - datos.terminadas_periodo_anterior : 0;
  const aTiempo = datos?.con_fecha ? Math.round((datos.a_tiempo / datos.con_fecha) * 100) : null;
  const vencidas = datos?.vencidas ?? [];

  return (
    <PageContainer wide>
      <header className={styles.cabecera}>
        <h1>{saludo()}, {user?.nombre?.split(' ')[0] || 'bienvenido'}</h1>
        <div className={styles.filtros}>
          {conEquipo && (
            <div className={styles.segmento} role="group" aria-label="De quién">
              {[['equipo', 'Equipo'], ['yo', 'Yo']].map(([valor, texto]) => (
                <button key={valor} type="button" aria-pressed={alcance === valor} onClick={() => setAlcance(valor)}>{texto}</button>
              ))}
            </div>
          )}
          {dia && (
            <button type="button" className={styles.chipDia} onClick={() => setDia(null)} aria-label="Quitar el día elegido">
              {sinPunto(formatoDiaMes.format(dia))} <X size={14} />
            </button>
          )}
          <div className={styles.segmento} role="group" aria-label="Periodo">
            {Object.entries(PERIODOS).map(([valor, [texto]]) => (
              <button
                key={valor}
                type="button"
                aria-pressed={!dia && periodo === valor}
                onClick={() => { setDia(null); setPeriodo(valor); }}
              >
                {texto}
              </button>
            ))}
          </div>
        </div>
      </header>

      <section className={styles.indicadores} aria-label="Indicadores">
        <div className={`${styles.tarjeta} ${styles.indicador}`}>
          <div>
            <div className={styles.numero}>{datos ? totalTerminadas : '–'}</div>
            <div className={styles.rotulo}>
              terminadas{datos && (
                <> · <b className={diferencia >= 0 ? styles.sube : styles.baja}>{diferencia >= 0 ? '▲' : '▼'} {Math.abs(diferencia)}</b> vs. {periodoAnterior}</>
              )}
            </div>
          </div>
          {series && <MiniBarras valores={series.terminadas} />}
        </div>
        <div className={`${styles.tarjeta} ${styles.indicador}`}>
          <div>
            <div className={styles.numero}>{aTiempo ?? '–'}{aTiempo !== null && <small>%</small>}</div>
            <div className={styles.rotulo}>{aTiempo === null && datos ? 'sin entregas con fecha' : 'entregadas a tiempo'}</div>
          </div>
          <Anillo porcentaje={aTiempo} />
        </div>
        <div className={`${styles.tarjeta} ${styles.indicador}`}>
          <div>
            <div className={`${styles.numero} ${vencidas.length ? styles.baja : styles.sube}`}>{datos ? vencidas.length : '–'}</div>
            <div className={styles.rotulo}>vencidas hoy</div>
          </div>
          <div className={styles.puntos}>
            {vencidas.slice(0, MAX_PUNTOS).map((d, i) => (
              <i key={i} style={{ background: colorAtraso(d) }} title={`Vencida hace ${d} ${d === 1 ? 'día' : 'días'}`} />
            ))}
            {vencidas.length > MAX_PUNTOS && <span>+{vencidas.length - MAX_PUNTOS}</span>}
          </div>
        </div>
      </section>

      {/* Dos columnas alineadas: Proyectos y el mapa de calor | Terminadas, Creadas y la actividad */}
      <div className={styles.tablero}>
        <section className={`${styles.tarjeta} ${styles.panel} ${styles.areaProyectos}`}>
          <header className={styles.panelCabecera}>
            <h2>Proyectos</h2>
            <div className={styles.leyenda}>
              <span><i style={{ background: 'var(--success)' }} />A tiempo</span>
              <span><i style={{ background: 'var(--warning)' }} />Atención</span>
              <span><i style={{ background: 'var(--danger)' }} />En riesgo</span>
              <span><i className={styles.hueco} />Inicio del periodo</span>
            </div>
          </header>
          {!series ? <p className={styles.vacio}>Cargando…</p>
            : series.proyectos.length === 0 ? <p className={styles.vacio}>No hay proyectos activos con fecha de entrega.</p>
              : <MapaProyectos puntos={series.proyectos} periodo={nombrePeriodo} onAbrir={(id) => navigate(`/proyectos/${id}`)} />}
        </section>

        <section className={`${styles.tarjeta} ${styles.panel} ${styles.areaTerminadas}`}>
          <header className={styles.panelCabecera}>
            <h2>Terminadas<small>{nombrePeriodo}</small></h2>
            <div className={styles.leyenda}><span><i className={styles.linea} style={{ background: 'var(--text-muted)' }} />Promedio</span></div>
          </header>
          {series ? <BarrasTerminadas cubetas={cubetas} valores={series.terminadas} /> : <p className={styles.vacio}>Cargando…</p>}
        </section>

        <section className={`${styles.tarjeta} ${styles.panel} ${styles.areaFlujo}`}>
          <header className={styles.panelCabecera}>
            <h2>Creadas y terminadas</h2>
            <div className={styles.leyenda}>
              <span><i className={styles.linea} style={{ background: 'var(--accent)' }} />Terminadas</span>
              <span><i className={styles.linea} style={{ background: 'var(--text-muted)' }} />Creadas</span>
            </div>
          </header>
          {series
            ? <LineasFlujo cubetas={cubetas} creadas={acumular(series.creadas)} terminadas={acumular(series.terminadas)} />
            : <p className={styles.vacio}>Cargando…</p>}
        </section>

        <section className={`${styles.tarjeta} ${styles.panel} ${styles.areaCalor}`}>
          <header className={styles.panelCabecera}>
            <h2>
              {datos ? datos.calor.reduce((s, d) => s + d.acciones, 0).toLocaleString('es-CO') : '–'}
              <small>acciones en el año · toca un día</small>
            </h2>
            <div className={styles.escala}>
              Menos {[0, 0.3, 0.55, 0.8, 1].map((o) => (
                <i key={o} style={o ? { background: 'var(--accent)', opacity: o } : { background: 'var(--bg-surface-alt)' }} />
              ))} Más
            </div>
          </header>
          {datos && <MapaCalor calor={datos.calor} desde={rango.desde} hasta={rango.hasta} onElegirDia={elegirDia} />}
        </section>

        <ActividadInicio
          className={styles.areaActividad}
          desde={rango.desde}
          hasta={rango.hasta}
          soloMias={soloMias}
          usuarioId={user?.id}
          periodo={nombrePeriodo}
        />
      </div>
    </PageContainer>
  );
}
