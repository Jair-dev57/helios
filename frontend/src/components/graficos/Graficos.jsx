import { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { claveDia } from '../../utils/formato';
import styles from './Graficos.module.css';

const formatoMes = new Intl.DateTimeFormat('es-CO', { month: 'short' });
const formatoDiaLargo = new Intl.DateTimeFormat('es-CO', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
const mesCorto = (d) => formatoMes.format(d).replace('.', '');

// Escala del eje Y en pasos redondos: 4 lineas hasta un maximo multiplo de 4
const maximoEje = (valores) => Math.max(4, Math.ceil(Math.max(0, ...valores) / 4) * 4);

/** Globo que sigue al puntero; onMover(evento, contenido) lo muestra y onSalir lo oculta */
function useGlobo() {
  const [globo, setGlobo] = useState(null);
  const nodo = globo && createPortal(
    <div className={styles.globo} style={{ left: globo.x, top: globo.y }} role="tooltip">{globo.contenido}</div>,
    document.body,
  );
  return {
    nodo,
    onMover: (e, contenido) => setGlobo({ x: e.clientX, y: e.clientY, contenido }),
    onSalir: () => setGlobo(null),
  };
}

/**
 * Ancho real del contenedor: los graficos se dibujan a ese tamaño en pixeles (no se estiran),
 * asi el texto y las formas miden lo mismo en cualquier pantalla.
 */
function useAncho() {
  const ref = useRef(null);
  const [ancho, setAncho] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const medir = () => setAncho(Math.floor(el.clientWidth));
    medir();
    const observador = new ResizeObserver(medir);
    observador.observe(el);
    return () => observador.disconnect();
  }, []);
  return [ref, ancho];
}

function Rejilla({ max, W, m, y }) {
  return [0, 1, 2, 3, 4].map((i) => {
    const v = (max / 4) * i;
    return (
      <g key={i}>
        <line className={styles.rejilla} x1={m.l} x2={W - m.r} y1={y(v)} y2={y(v)} />
        <text className={styles.eje} x={m.l - 6} y={y(v) + 4} textAnchor="end">{v}</text>
      </g>
    );
  });
}

// Etiquetas del eje X: todas si caben, si no una cada tantas terminando en la ultima
const cadaCuanto = (n) => (n > 14 ? 5 : n > 8 ? 3 : 1);

/* ---------- Indicadores ---------- */

// Sin color: verde, ambar o rojo segun el porcentaje
export function Anillo({ porcentaje, color }) {
  const R = 25;
  const C = 2 * Math.PI * R;
  const tono = color ?? (porcentaje === null ? 'var(--border)' : porcentaje >= 75 ? 'var(--success)' : porcentaje >= 60 ? 'var(--warning)' : 'var(--danger)');
  return (
    <svg className={styles.anillo} width="60" height="60" viewBox="0 0 60 60" aria-hidden="true">
      <circle cx="30" cy="30" r={R} fill="none" stroke="var(--bg-surface-alt)" strokeWidth="7" />
      {porcentaje > 0 && (
        <circle
          cx="30" cy="30" r={R} fill="none" stroke={tono} strokeWidth="7" strokeLinecap="round"
          strokeDasharray={`${(porcentaje / 100) * C} ${C}`} transform="rotate(-90 30 30)"
        />
      )}
    </svg>
  );
}

export function MiniBarras({ valores }) {
  const W = 120;
  const H = 40;
  const max = Math.max(1, ...valores);
  const bw = W / Math.max(1, valores.length);
  return (
    <svg className={styles.miniBarras} width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
      {valores.map((v, i) => {
        const h = Math.max(3, (v / max) * (H - 4));
        return (
          <rect
            key={i} x={i * bw + 1} y={H - h} width={Math.max(1, bw - 2)} height={h} rx="2"
            fill="var(--accent)" opacity={i === valores.length - 1 ? 1 : 0.35}
          />
        );
      })}
    </svg>
  );
}

/* ---------- Mapa de proyectos ---------- */

const ESTADOS = {
  ok: { color: 'var(--success)', texto: 'A tiempo' },
  atencion: { color: 'var(--warning)', texto: 'Atención' },
  riesgo: { color: 'var(--danger)', texto: 'En riesgo' },
};
const estadoProyecto = (tiempo, avance) => (tiempo - avance > 15 ? 'riesgo' : tiempo - avance > 5 ? 'atencion' : 'ok');

/**
 * Tiempo usado (inicio → entrega) contra avance (tareas terminadas). La diagonal es el ritmo justo: debajo, atrasado.
 * Cada proyecto deja una estela desde donde estaba al inicio del periodo. puntos: [{ id, nombre, t0, a0, t1, a1 }] en %.
 */
export function MapaProyectos({ puntos, periodo, onAbrir }) {
  const { nodo, onMover, onSalir } = useGlobo();
  const [lienzo, W] = useAncho();
  const H = 320;
  const m = { t: 10, r: 14, b: 30, l: 34 };
  const R = 8;
  const x = (v) => m.l + (Math.min(100, Math.max(0, v)) / 100) * (W - m.l - m.r);
  const y = (v) => H - m.b - (Math.min(100, Math.max(0, v)) / 100) * (H - m.t - m.b);
  // Con muchos proyectos los nombres se cruzan: quedan en el globo
  const conNombre = puntos.length <= 8;
  // Nombres que caerian encima de otro se corren arriba o abajo
  const nombres = new Map();
  const ocupados = [];
  [...puntos].sort((a, b) => a.t1 - b.t1).forEach((p) => {
    const izq = p.t1 > 68;
    const cx = x(p.t1) + (izq ? -R - 7 : R + 7);
    const ancho = p.nombre.length * 6.2;
    const [x0, x1] = izq ? [cx - ancho, cx] : [cx, cx + ancho];
    const base = y(p.a1) + 4;
    const ly = [0, -15, 15, -30, 30, -45, 45].map((d) => base + d)
      .find((v) => v > m.t + 8 && v < H - m.b && !ocupados.some((o) => x0 < o.x1 && x1 > o.x0 && Math.abs(o.y - v) < 14)) ?? base;
    ocupados.push({ x0, x1, y: ly });
    nombres.set(p.id, { x: cx, y: ly, anchor: izq ? 'end' : 'start' });
  });
  return (
    <div ref={lienzo} className={styles.lienzo} style={{ height: H }}>
      {W > 0 && <svg width={W} height={H} className={styles.svg} role="img" aria-label="Mapa de proyectos: avance frente al tiempo usado">
        <polygon points={`${x(15)},${y(0)} ${x(100)},${y(0)} ${x(100)},${y(85)}`} fill="var(--danger-soft)" />
        <polygon points={`${x(0)},${y(0)} ${x(0)},${y(100)} ${x(100)},${y(100)}`} fill="var(--success-soft)" opacity=".6" />
        <line x1={x(0)} y1={y(0)} x2={x(100)} y2={y(100)} stroke="var(--text-muted)" strokeWidth="1.5" strokeDasharray="5 5" />
        <line x1={x(0)} y1={y(0)} x2={x(100)} y2={y(0)} stroke="var(--border)" />
        <line x1={x(0)} y1={y(0)} x2={x(0)} y2={y(100)} stroke="var(--border)" />
        {[0, 50, 100].map((v) => (
          <g key={v}>
            <text className={styles.eje} x={x(v)} y={H - 12} textAnchor="middle">{v}%</text>
            <text className={styles.eje} x={m.l - 8} y={y(v) + 4} textAnchor="end">{v}%</text>
          </g>
        ))}
        <text className={styles.eje} x={x(100)} y={H - 1} textAnchor="end">Tiempo usado →</text>
        <text className={styles.eje} x={x(0) + 6} y={y(100) + 12}>↑ Avance</text>
        {puntos.map((p) => {
          const { color } = ESTADOS[estadoProyecto(p.t1, p.a1)];
          return (
            <g key={`e${p.id}`} opacity=".8">
              <line x1={x(p.t0)} y1={y(p.a0)} x2={x(p.t1)} y2={y(p.a1)} stroke={color} strokeWidth="2" strokeLinecap="round" opacity=".55" />
              <circle cx={x(p.t0)} cy={y(p.a0)} r="3" fill="var(--bg-surface)" stroke={color} strokeWidth="1.5" />
            </g>
          );
        })}
        {puntos.map((p) => {
          const estado = ESTADOS[estadoProyecto(p.t1, p.a1)];
          const nombre = nombres.get(p.id);
          const globo = (
            <>
              <b>{p.nombre}</b> · {estado.texto}<br />
              {Math.round(p.a1)} % hecho · {Math.round(Math.min(p.t1, 100))} % del tiempo{p.t1 > 100 && ' (vencido)'}<br />
              +{Math.round(p.a1 - p.a0)} % en {periodo}
            </>
          );
          return (
            <g
              key={p.id}
              className={styles.burbuja}
              onMouseMove={(e) => onMover(e, globo)}
              onMouseLeave={onSalir}
              onClick={() => onAbrir(p.id)}
              role="link"
              tabIndex={0}
              aria-label={`${p.nombre}: ${estado.texto}`}
              onKeyDown={(e) => { if (e.key === 'Enter') onAbrir(p.id); }}
            >
              <circle cx={x(p.t1)} cy={y(p.a1)} r={R} fill={estado.color} stroke="var(--bg-surface)" strokeWidth="2" />
              {conNombre && (
                <text className={styles.etiqueta} x={nombre.x} y={nombre.y} textAnchor={nombre.anchor}>
                  {p.nombre}
                </text>
              )}
            </g>
          );
        })}
      </svg>}
      {nodo}
    </div>
  );
}

/* ---------- Barras: terminadas por hora o por dia ---------- */

export function BarrasTerminadas({ cubetas, valores }) {
  const { nodo, onMover, onSalir } = useGlobo();
  const [lienzo, W] = useAncho();
  const H = 130;
  const m = { t: 14, r: 6, b: 22, l: 26 };
  const n = valores.length;
  const max = maximoEje(valores);
  const bw = (W - m.l - m.r) / n;
  const y = (v) => H - m.b - (v / max) * (H - m.t - m.b);
  const promedio = valores.reduce((a, b) => a + b, 0) / n;
  // En pantallas angostas se salta etiquetas para que no se monten
  const cada = Math.max(cadaCuanto(n), Math.ceil(48 / Math.max(1, bw)));
  return (
    <div ref={lienzo} className={styles.lienzo} style={{ height: H }}>
      {W > 0 && <svg width={W} height={H} className={styles.svg} role="img" aria-label="Tareas terminadas">
        <Rejilla max={max} W={W} m={m} y={y} />
        {valores.map((v, i) => {
          const cx = m.l + i * bw + bw / 2;
          const w = Math.max(3, Math.min(28, bw * 0.6));
          return (
            <g key={i} className={styles.columna} onMouseMove={(e) => onMover(e, <>{cubetas[i].detalle}<br /><b>{v}</b> terminadas</>)} onMouseLeave={onSalir}>
              <rect x={cx - bw / 2} y={m.t} width={bw} height={H - m.t - m.b} fill="transparent" />
              {v > 0 && (
                <rect
                  x={cx - w / 2} y={y(v)} width={w} height={y(0) - y(v)} rx={Math.min(4, w / 2)}
                  fill="var(--accent)" fillOpacity={i === n - 1 ? 1 : 0.5}
                />
              )}
              {(n - 1 - i) % cada === 0 && <text className={styles.eje} x={cx} y={H - 6} textAnchor="middle">{cubetas[i].etiqueta}</text>}
            </g>
          );
        })}
        <line x1={m.l} x2={W - m.r} y1={y(promedio)} y2={y(promedio)} stroke="var(--text-muted)" strokeWidth="1.5" strokeDasharray="4 4" />
      </svg>}
      {nodo}
    </div>
  );
}

/* ---------- Lineas: creadas y terminadas, acumuladas en el periodo ---------- */

export function LineasFlujo({ cubetas, creadas, terminadas }) {
  const { nodo, onMover, onSalir } = useGlobo();
  const [marcado, setMarcado] = useState(null);
  const [lienzo, W] = useAncho();
  const H = 130;
  const m = { t: 14, r: 10, b: 22, l: 26 };
  const n = cubetas.length;
  const max = maximoEje([...creadas, ...terminadas]);
  const paso = (W - m.l - m.r) / Math.max(1, n - 1);
  const x = (i) => m.l + i * paso;
  const y = (v) => H - m.b - (v / max) * (H - m.t - m.b);
  const trazo = (serie) => serie.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('');
  const cada = Math.max(cadaCuanto(n), Math.ceil(48 / Math.max(1, paso)));

  const mover = (e) => {
    const px = e.clientX - e.currentTarget.ownerSVGElement.getBoundingClientRect().left;
    const i = Math.max(0, Math.min(n - 1, Math.round((px - m.l) / paso)));
    setMarcado(i);
    onMover(e, <>Hasta {cubetas[i].detalle}<br />Terminadas <b>{terminadas[i]}</b> · Creadas <b>{creadas[i]}</b></>);
  };

  return (
    <div ref={lienzo} className={styles.lienzo} style={{ height: H }}>
      {W > 0 && <svg width={W} height={H} className={styles.svg} role="img" aria-label="Tareas creadas y terminadas, acumuladas">
        <Rejilla max={max} W={W} m={m} y={y} />
        {cubetas.map((c, i) => (n - 1 - i) % cada === 0 && (
          <text key={i} className={styles.eje} x={x(i)} y={H - 6} textAnchor="middle">{c.etiqueta}</text>
        ))}
        <path d={`${trazo(terminadas)}L${x(n - 1)},${y(0)}L${x(0)},${y(0)}Z`} fill="var(--accent)" opacity=".1" />
        <path d={trazo(creadas)} fill="none" stroke="var(--text-muted)" strokeWidth="1.5" strokeDasharray="5 4" />
        <path d={trazo(terminadas)} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round" />
        <circle cx={x(n - 1)} cy={y(terminadas[n - 1])} r="3.5" fill="var(--accent)" stroke="var(--bg-surface)" strokeWidth="1.5" />
        {marcado !== null && <line x1={x(marcado)} x2={x(marcado)} y1={m.t} y2={H - m.b} stroke="var(--text-muted)" />}
        <rect
          x={m.l} y="0" width={W - m.l - m.r} height={H} fill="transparent"
          onMouseMove={mover} onMouseLeave={() => { setMarcado(null); onSalir(); }}
        />
      </svg>}
      {nodo}
    </div>
  );
}

/* ---------- Mapa de calor del ultimo año (como GitHub) ---------- */

/**
 * Un cuadro por dia, mas oscuro con mas acciones. Los dias del periodo van marcados; tocar uno lo elige.
 * calor: [{ dia: 'YYYY-MM-DD', acciones }]; semanas: cuantas columnas (53 = un año); sin desde no se marca ningun dia.
 */
export function MapaCalor({ calor, desde = null, hasta = null, onElegirDia, semanas = 53 }) {
  const { nodo, onMover, onSalir } = useGlobo();
  const [lienzo, ancho] = useAncho();
  const porDia = new Map(calor.map((c) => [c.dia, c.acciones]));
  const max = Math.max(1, ...calor.map((c) => c.acciones));
  const nivel = (n) => (n === 0 ? 0 : Math.min(4, Math.ceil((n / max) * 4)));
  const OPACIDAD = [1, 0.3, 0.55, 0.8, 1];

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  // Columnas (semanas de lunes a domingo) que terminan en la semana de hoy
  const lunes = new Date(hoy);
  lunes.setDate(hoy.getDate() - ((hoy.getDay() + 6) % 7) - (semanas - 1) * 7);
  const g = 3;
  const izq = 22;
  const top = 16;
  // Cuadros que llenan el ancho de la columna, entre 8 y 16 px
  const c = Math.max(8, Math.min(16, Math.floor((ancho - izq) / semanas) - g));
  const W = izq + semanas * (c + g);
  const H = top + 7 * (c + g);

  const cuadros = [];
  const meses = [];
  for (let col = 0; col < semanas; col++) {
    for (let fila = 0; fila < 7; fila++) {
      const f = new Date(lunes);
      f.setDate(lunes.getDate() + col * 7 + fila);
      if (f > hoy) continue;
      if (fila === 0 && f.getDate() <= 7) meses.push({ col, texto: mesCorto(f) });
      const n = porDia.get(claveDia(f)) || 0;
      cuadros.push({ f, n, col, fila, dentro: !!desde && f >= desde && f < hasta });
    }
  }

  return (
    <div ref={lienzo} className={styles.calor}>
      {ancho > 0 && <svg className={styles.svgCalor} width={W} height={H} role="img" aria-label="Actividad por día">
        {['L', 'M', 'V'].map((l, i) => (
          <text key={l} className={styles.eje} x="0" y={top + i * 2 * (c + g) + 9}>{l}</text>
        ))}
        {meses.map((mes) => <text key={mes.col} className={styles.eje} x={izq + mes.col * (c + g)} y="10">{mes.texto}</text>)}
        {cuadros.map(({ f, n, col, fila, dentro }) => {
          const nv = nivel(n);
          return (
            <rect
              key={f.getTime()}
              className={`${styles.dia} ${dentro ? styles.diaElegido : ''}`}
              x={izq + col * (c + g)} y={top + fila * (c + g)} width={c} height={c} rx="2"
              fill={nv ? 'var(--accent)' : 'var(--bg-surface-alt)'} fillOpacity={OPACIDAD[nv]}
              onMouseMove={(e) => onMover(e, <><b>{n} {n === 1 ? 'acción' : 'acciones'}</b> · {formatoDiaLargo.format(f)}</>)}
              onMouseLeave={onSalir}
              onClick={() => onElegirDia?.(f)}
            />
          );
        })}
      </svg>}
      {nodo}
    </div>
  );
}
