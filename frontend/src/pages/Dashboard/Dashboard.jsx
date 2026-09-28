import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { FolderOpen, ListChecks, FileText, TriangleAlert, Check } from 'lucide-react';
import { obtenerDashboard } from '../../api/dashboard';
import { listarProyectos } from '../../api/proyectos';
import { listarClientes } from '../../api/clientes';
import { listarTareas, listarColumnas } from '../../api/tareas';
import { listarUsuarios } from '../../api/usuarios';
import { obtenerActividadGlobal } from '../../api/historial';
import PageContainer from '../../components/PageContainer';
import Avatar from '../../components/Avatar';
import {
  diasHasta, fechaRelativa, vencimientoTarea, entregaProyecto, colorAvance, colorCliente, iniciales,
} from '../Proyectos/formato';
import shared from '../../styles/shared.module.css';
import styles from './Dashboard.module.css';

// Si una columna no aparece en /columnas (sin permiso), se usa un color de esta lista
const COLORES_RESPALDO = ['#9096A8', '#E0A030', '#6B8CE8', '#3DBE73', '#B0457A', '#2E8C8C'];
const RADIO_DONA = 80;
const CIRC_DONA = 2 * Math.PI * RADIO_DONA;
const RADIO_ANILLO = 16;
const CIRC_ANILLO = 2 * Math.PI * RADIO_ANILLO;

const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [proyectos, setProyectos] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [tareas, setTareas] = useState([]);
  const [columnas, setColumnas] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [actividad, setActividad] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const valor = (r) => (r.status === 'fulfilled' ? r.value : []);
    Promise.allSettled([
      obtenerDashboard(),
      listarProyectos(),
      listarClientes(),
      listarTareas(),
      listarColumnas(),
      listarUsuarios(),
      obtenerActividadGlobal(6),
    ])
      .then(([dash, dataProyectos, dataClientes, dataTareas, dataColumnas, dataUsuarios, dataActividad]) => {
        // El resumen es obligatorio; lo demas enriquece los paneles si el rol tiene acceso
        if (dash.status === 'fulfilled') setData(dash.value);
        setProyectos(valor(dataProyectos));
        setClientes(valor(dataClientes));
        setTareas(valor(dataTareas));
        setColumnas(valor(dataColumnas));
        setUsuarios(valor(dataUsuarios));
        setActividad(valor(dataActividad));
      })
      .finally(() => setLoading(false));
  }, []);

  const usuarioPorId = (id) => usuarios.find((u) => u.id === id);

  // Cliente de cada proyecto, para el circulo de color
  const marcaProyecto = (proyectoId, nombreProyecto) => {
    const proyecto = proyectos.find((p) => p.id === proyectoId);
    const cliente = proyecto && clientes.find((c) => c.id === proyecto.cliente_id);
    const base = cliente || { id: proyectoId, nombre: nombreProyecto };
    const color = colorCliente(base.id);
    return (
      <span className={styles.miniLogo} style={{ background: `${color}24`, color }} aria-hidden="true">
        {iniciales(base.nombre)}
      </span>
    );
  };

  const calculos = useMemo(() => {
    const hoy = new Date();
    const activos = proyectos.filter((p) => p.estado === 'activo');
    const entregasSemana = activos.filter((p) => {
      if (!p.fecha_vencimiento) return false;
      const dias = diasHasta(p.fecha_vencimiento);
      return dias >= 0 && dias <= 7;
    }).length;
    const entregasMes = activos.filter((p) => {
      if (!p.fecha_vencimiento) return false;
      const [anio, mes] = p.fecha_vencimiento.slice(0, 7).split('-').map(Number);
      return anio === hoy.getFullYear() && mes === hoy.getMonth() + 1;
    }).length;

    // Salud: avance y vencidas de cada proyecto activo, los que estan en riesgo primero
    const salud = activos
      .map((p) => {
        const tareasP = tareas.filter((t) => t.proyecto_id === p.id);
        const hechas = tareasP.filter((t) => t.terminada).length;
        const vencidas = tareasP.filter(
          (t) => !t.terminada && t.fecha_vencimiento && diasHasta(t.fecha_vencimiento) < 0,
        ).length;
        return {
          ...p,
          progreso: tareasP.length ? Math.round((hechas / tareasP.length) * 100) : 0,
          vencidas,
          entrega: entregaProyecto(p),
        };
      })
      .sort(
        (a, b) =>
          b.vencidas - a.vencidas ||
          (a.entrega.tipo === 'vencida' ? 0 : 1) - (b.entrega.tipo === 'vencida' ? 0 : 1) ||
          (a.fecha_vencimiento ? 0 : 1) - (b.fecha_vencimiento ? 0 : 1) ||
          (a.fecha_vencimiento || '').localeCompare(b.fecha_vencimiento || ''),
      );

    return { entregasSemana, entregasMes, salud };
  }, [proyectos, tareas]);

  // Dona: cada columna con el color que tiene en los tableros
  const estados = useMemo(() => {
    if (!data) return [];
    return Object.entries(data.distribucion_estados).map(([nombre, cantidad], i) => ({
      nombre,
      cantidad,
      color: columnas.find((c) => c.nombre === nombre)?.color || COLORES_RESPALDO[i % COLORES_RESPALDO.length],
    }));
  }, [data, columnas]);

  if (loading) return <p className={shared.loadingText} style={{ padding: '2rem' }}>Cargando dashboard...</p>;
  if (!data) return <p className={shared.emptyText} style={{ padding: '2rem' }}>No se pudo cargar el dashboard.</p>;

  const vencidas = data.tareas_vencidas.length;
  const porVencer = data.tareas_por_vencer.length;
  const totalEstados = estados.reduce((n, e) => n + e.cantidad, 0);
  const maxCarga = Math.max(1, ...data.carga_por_usuario.map((u) => u.total_tareas));

  let acumulado = 0;
  const segmentosDona = estados
    .filter((e) => e.cantidad > 0)
    .map((e) => {
      const largo = (e.cantidad / totalEstados) * CIRC_DONA;
      // Un pequeno hueco separa los segmentos cuando hay mas de uno
      const hueco = estados.filter((x) => x.cantidad > 0).length > 1 ? 3 : 0;
      const segmento = { ...e, largo: Math.max(0, largo - hueco), desde: acumulado };
      acumulado += largo;
      return segmento;
    });

  const filaTarea = (t, prefijo) => {
    const venc = vencimientoTarea(t.fecha_vencimiento);
    const asignado = usuarioPorId(t.usuario_asignado_id);
    return (
      <Link key={`${prefijo}-${t.id}`} to={`/proyectos/${t.proyecto_id}/tareas`} className={styles.tarea}>
        <span className={`${styles.prioridad} ${styles[`prioridad_${t.prioridad}`] || ''}`} />
        <span className={styles.tareaTexto}>
          <b>{t.titulo}</b>
          <small>{marcaProyecto(t.proyecto_id, t.proyecto_nombre)}{t.proyecto_nombre}</small>
        </span>
        {venc && <span className={`${styles.fecha} ${styles[`fecha_${venc.tipo}`]}`}>{venc.texto}</span>}
        {asignado ? (
          <Avatar usuario={asignado} size={26} className={styles.tareaAvatar} />
        ) : (
          <span className={`${styles.sinAsignar} ${styles.tareaAvatar}`} title="Sin asignar" />
        )}
      </Link>
    );
  };

  return (
    <PageContainer wide>
      <div className={styles.saludo}>
        <h1>Dashboard</h1>
        <p>
          {vencidas === 0 && calculos.entregasSemana === 0 ? (
            <span className={styles.verde}>Todo al día: no hay tareas vencidas ni entregas esta semana.</span>
          ) : (
            <>
              Tienes{' '}
              {vencidas > 0 && <b className={styles.rojo}>{plural(vencidas, 'tarea vencida', 'tareas vencidas')}</b>}
              {vencidas > 0 && calculos.entregasSemana > 0 && ' y '}
              {calculos.entregasSemana > 0 && (
                <b className={styles.ambar}>{plural(calculos.entregasSemana, 'entrega', 'entregas')}</b>
              )}
              {calculos.entregasSemana > 0 ? ' esta semana.' : '.'}
            </>
          )}
        </p>
      </div>

      <section className={styles.metricas}>
        <div className={styles.metrica}>
          <span className={`${styles.metricaIcono} ${styles.iconoVerde}`}><FolderOpen size={20} /></span>
          <div>
            <b>{data.proyectos_activos}</b>
            <small>Proyectos activos</small>
            <em>
              {calculos.entregasMes > 0
                ? `${plural(calculos.entregasMes, 'entrega', 'entregas')} este mes`
                : 'Sin entregas este mes'}
            </em>
          </div>
        </div>
        <div className={styles.metrica}>
          <span className={`${styles.metricaIcono} ${styles.iconoAccent}`}><ListChecks size={20} /></span>
          <div>
            <b>{data.tareas_abiertas}</b>
            <small>Tareas abiertas</small>
            <em className={porVencer > 0 ? styles.ambar : ''}>
              {porVencer > 0 ? `${porVencer} ${porVencer === 1 ? 'vence' : 'vencen'} esta semana` : 'Nada por vencer esta semana'}
            </em>
          </div>
        </div>
        <div className={styles.metrica}>
          <span className={`${styles.metricaIcono} ${styles.iconoInfo}`}><FileText size={20} /></span>
          <div>
            <b>{data.total_documentos}</b>
            <small>Documentos</small>
            <em>en todos los proyectos</em>
          </div>
        </div>
        <div className={`${styles.metrica} ${vencidas > 0 ? styles.metricaAlerta : ''}`}>
          <span className={`${styles.metricaIcono} ${styles.iconoRojo}`}><TriangleAlert size={20} /></span>
          <div>
            <b>{vencidas}</b>
            <small>{vencidas === 1 ? 'Tarea vencida' : 'Tareas vencidas'}</small>
            <em className={vencidas > 0 ? styles.rojo : styles.verde}>
              {vencidas > 0
                ? `en ${plural(data.proyectos_en_riesgo.length, 'proyecto', 'proyectos')}`
                : 'Todo al día'}
            </em>
          </div>
        </div>
      </section>

      <div className={styles.rejilla}>
        {/* ---------- Vencimientos ---------- */}
        <section className={styles.panel}>
          <div className={styles.panelCab}>
            <h2>
              Vencimientos
              {vencidas > 0 && <span className={styles.conteo}>{vencidas}</span>}
            </h2>
            <span className={styles.nota}>vencidas y próximos 7 días</span>
          </div>
          {vencidas === 0 && porVencer === 0 ? (
            <div className={styles.vacio}>
              <span className={styles.vacioIcono}><Check size={22} strokeWidth={2.5} /></span>
              <b>Todo al día</b>
              <p>No hay tareas vencidas ni por vencer en los próximos 7 días.</p>
            </div>
          ) : (
            <div className={styles.scroll}>
              {vencidas > 0 && (
                <>
                  <div className={`${styles.grupo} ${styles.rojo}`}>Vencidas</div>
                  {data.tareas_vencidas.map((t) => filaTarea(t, 'v'))}
                </>
              )}
              {porVencer > 0 && (
                <>
                  <div className={styles.grupo}>Próximos 7 días</div>
                  {data.tareas_por_vencer.map((t) => filaTarea(t, 'p'))}
                </>
              )}
            </div>
          )}
        </section>

        {/* ---------- Salud de proyectos ---------- */}
        <section className={styles.panel}>
          <div className={styles.panelCab}>
            <h2>Salud de proyectos</h2>
            <Link to="/proyectos" className={styles.verTodos}>Ver todos →</Link>
          </div>
          {calculos.salud.length === 0 ? (
            <div className={styles.vacio}>
              <b>Sin proyectos activos</b>
              <p>Cuando haya proyectos en curso verás aquí su avance y sus entregas.</p>
            </div>
          ) : (
            <div className={styles.scroll}>
              {calculos.salud.map((p) => (
                <Link key={p.id} to={`/proyectos/${p.id}`} className={styles.proyecto}>
                  <span className={styles.anillo} role="img" aria-label={`${p.progreso}% de avance`}>
                    <svg viewBox="0 0 40 40">
                      <circle className={styles.anilloPista} cx="20" cy="20" r={RADIO_ANILLO} />
                      <circle
                        className={styles.anilloValor}
                        cx="20"
                        cy="20"
                        r={RADIO_ANILLO}
                        stroke={colorAvance(p.progreso)}
                        strokeDasharray={CIRC_ANILLO}
                        strokeDashoffset={CIRC_ANILLO * (1 - p.progreso / 100)}
                      />
                    </svg>
                    <b>{p.progreso}%</b>
                  </span>
                  <span className={styles.tareaTexto}>
                    <b>{p.nombre}</b>
                    <small>
                      {marcaProyecto(p.id, p.nombre)}
                      <span className={styles[`entrega_${p.entrega.tipo}`] || ''}>{p.entrega.texto}</span>
                    </small>
                  </span>
                  {p.vencidas > 0 ? (
                    <span className={styles.chipRojo}>{plural(p.vencidas, 'vencida', 'vencidas')}</span>
                  ) : (
                    <span className={styles.chipVerde}>Al día</span>
                  )}
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* ---------- Tareas por estado ---------- */}
        <section className={styles.panel}>
          <div className={styles.panelCab}>
            <h2>Tareas por estado</h2>
            <span className={styles.nota}>todos los proyectos</span>
          </div>
          {totalEstados === 0 ? (
            <div className={styles.vacio}>
              <b>Aún no hay tareas</b>
              <p>Crea tareas en el tablero de un proyecto para ver aquí su distribución.</p>
            </div>
          ) : (
            <div className={styles.donaCaja}>
              <div className={styles.dona} role="img" aria-label={`${totalEstados} tareas por estado`}>
                <svg viewBox="0 0 200 200">
                  <circle className={styles.donaPista} cx="100" cy="100" r={RADIO_DONA} />
                  {segmentosDona.map((s) => (
                    <circle
                      key={s.nombre}
                      className={styles.donaSegmento}
                      cx="100"
                      cy="100"
                      r={RADIO_DONA}
                      stroke={s.color}
                      strokeDasharray={`${s.largo} ${CIRC_DONA}`}
                      strokeDashoffset={-s.desde}
                    />
                  ))}
                </svg>
                <div className={styles.donaCentro}>
                  <b>{totalEstados}</b>
                  <small>{totalEstados === 1 ? 'tarea' : 'tareas'}</small>
                </div>
              </div>
              <div className={styles.leyenda}>
                {estados.map((e) => (
                  <div key={e.nombre} className={styles.leyendaFila}>
                    <i style={{ background: e.color }} />
                    <span>{e.nombre}</span>
                    <b>{e.cantidad}</b>
                    <small>{Math.round((e.cantidad / totalEstados) * 100)}%</small>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* ---------- Carga por usuario ---------- */}
        <section className={styles.panel}>
          <div className={styles.panelCab}>
            <h2>Carga por usuario</h2>
            <span className={styles.nota}>tareas abiertas</span>
          </div>
          {data.carga_por_usuario.length === 0 ? (
            <div className={styles.vacio}>
              <b>Nadie tiene tareas asignadas</b>
              <p>Asigna tareas en los tableros para repartir el trabajo.</p>
            </div>
          ) : (
            <div className={`${styles.scroll} ${styles.carga}`}>
              {data.carga_por_usuario.map((u) => {
                const usuario = usuarioPorId(u.usuario_id) || { nombre: u.nombre };
                const alDia = u.total_tareas - u.tareas_vencidas;
                return (
                  <div key={u.usuario_id} className={styles.persona}>
                    <Avatar usuario={usuario} size={32} />
                    <div className={styles.personaInfo}>
                      <div className={styles.personaFila}>
                        <b>{u.nombre}</b>
                        <span>
                          {plural(u.total_tareas, 'abierta', 'abiertas')}
                          {u.tareas_vencidas > 0 && (
                            <span className={styles.rojo}> · {plural(u.tareas_vencidas, 'vencida', 'vencidas')}</span>
                          )}
                        </span>
                      </div>
                      <div className={styles.barra} style={{ width: `${(u.total_tareas / maxCarga) * 100}%` }}>
                        {u.tareas_vencidas > 0 && <i style={{ flexGrow: u.tareas_vencidas, background: 'var(--danger)' }} />}
                        {alDia > 0 && <i style={{ flexGrow: alDia, background: 'var(--accent)' }} />}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <div className={styles.pie}>
            <span><b>{data.carga_por_usuario.length}</b> {data.carga_por_usuario.length === 1 ? 'persona' : 'personas'}</span>
            <span><b>{data.tareas_abiertas}</b> {data.tareas_abiertas === 1 ? 'abierta' : 'abiertas'}</span>
            <span className={data.tareas_sin_asignar > 0 ? styles.ambar : ''}>
              <b>{data.tareas_sin_asignar}</b> sin asignar
            </span>
          </div>
        </section>
      </div>

      {/* ---------- Actividad global ---------- */}
      {actividad.length > 0 && (
        <section className={`${styles.panel} ${styles.panelActividad}`}>
          <div className={styles.panelCab}>
            <h2>Actividad reciente</h2>
            <span className={styles.nota}>todos los proyectos</span>
          </div>
          <div className={styles.actividad}>
            {actividad.map((ev, i) => {
              const contenido = (
                <>
                  <Avatar usuario={usuarioPorId(ev.usuario_id) || { nombre: ev.usuario_nombre }} size={30} />
                  <div>
                    <p>
                      {ev.usuario_nombre && <b>{ev.usuario_nombre} · </b>}
                      {ev.texto}
                    </p>
                    <small>
                      {ev.proyecto_nombre && `${ev.proyecto_nombre} · `}
                      {fechaRelativa(ev.created_at)}
                    </small>
                  </div>
                </>
              );
              // Si el proyecto ya no existe (sin nombre) el evento no lleva enlace
              return ev.proyecto_id && ev.proyecto_nombre ? (
                <Link key={`${ev.created_at}-${i}`} to={`/proyectos/${ev.proyecto_id}`} className={styles.evento}>
                  {contenido}
                </Link>
              ) : (
                <div key={`${ev.created_at}-${i}`} className={styles.evento}>{contenido}</div>
              );
            })}
          </div>
        </section>
      )}
    </PageContainer>
  );
}
