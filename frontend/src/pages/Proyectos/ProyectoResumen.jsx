import { useState, useEffect, useMemo } from 'react';
import { useOutletContext, Link } from 'react-router-dom';
import { listarDocumentos } from '../../api/documentos';
import { listarTareas, listarColumnas } from '../../api/tareas';
import { listarUsuarios } from '../../api/usuarios';
import { obtenerHistorial } from '../../api/historial';
import Avatar from '../../components/Avatar';
import IconoArchivo from '../../components/IconoArchivo';
import { MiniBarras, BarrasTerminadas, MapaCalor } from '../Inicio/Graficos';
import { fechaRelativa, diasHasta, fechaCorta, vencimientoTarea, nombreArchivo } from './formato';
import shared from '../../styles/shared.module.css';
import inicio from '../Inicio/Inicio.module.css';
import styles from './ProyectoResumen.module.css';

const DIA_MS = 86400000;
const SEMANAS = 8;
const MAX_PUNTOS = 12;
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const claveDia = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// Las ultimas SEMANAS semanas (de lunes a domingo), la actual al final
function semanasRecientes() {
  const lunes = new Date();
  lunes.setHours(0, 0, 0, 0);
  lunes.setDate(lunes.getDate() - ((lunes.getDay() + 6) % 7));
  return Array.from({ length: SEMANAS }, (_, i) => {
    const desde = new Date(lunes.getTime() - (SEMANAS - 1 - i) * 7 * DIA_MS);
    const etiqueta = `${desde.getDate()} ${MESES[desde.getMonth()]}`;
    return { desde, hasta: new Date(desde.getTime() + 7 * DIA_MS), etiqueta, detalle: i === SEMANAS - 1 ? 'Esta semana' : `Semana del ${etiqueta}` };
  });
}

const contarPorSemana = (semanas, fechas) => {
  const conteo = semanas.map(() => 0);
  fechas.forEach((iso) => {
    if (!iso) return;
    const f = new Date(iso);
    const i = semanas.findIndex((s) => f >= s.desde && f < s.hasta);
    if (i >= 0) conteo[i] += 1;
  });
  return conteo;
};

/** Anillo de avance en el color de acento */
function AnilloAvance({ porcentaje }) {
  const R = 25;
  const C = 2 * Math.PI * R;
  return (
    <svg className={inicio.anillo} width="60" height="60" viewBox="0 0 60 60" aria-hidden="true">
      <circle cx="30" cy="30" r={R} fill="none" stroke="var(--bg-surface-alt)" strokeWidth="7" />
      {porcentaje > 0 && (
        <circle
          cx="30" cy="30" r={R} fill="none" stroke="var(--accent)" strokeWidth="7" strokeLinecap="round"
          strokeDasharray={`${(porcentaje / 100) * C} ${C}`} transform="rotate(-90 30 30)"
        />
      )}
    </svg>
  );
}

/** Tiempo usado (inicio → entrega) contra avance: si el tiempo va delante, el proyecto va atrasado */
function TiempoAvance({ tiempo, avance }) {
  return (
    <div className={styles.tiempoAvance} aria-hidden="true">
      <span><i style={{ width: `${tiempo}%` }} className={styles.barraTiempo} /></span>
      <span><i style={{ width: `${avance}%` }} className={styles.barraAvance} /></span>
    </div>
  );
}

export default function ProyectoResumen() {
  const { proyecto, abrirActividad } = useOutletContext();
  const [documentos, setDocumentos] = useState([]);
  const [tareas, setTareas] = useState([]);
  const [columnas, setColumnas] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [historial, setHistorial] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.allSettled([
      listarDocumentos(proyecto.id),
      listarTareas(proyecto.id),
      listarColumnas(proyecto.id),
      listarUsuarios(),
      obtenerHistorial(proyecto.id, 100),
    ])
      .then(([docs, dataTareas, dataColumnas, dataUsuarios, dataHistorial]) => {
        const valor = (r) => (r.status === 'fulfilled' ? r.value : []);
        setDocumentos(valor(docs));
        setTareas(valor(dataTareas));
        setColumnas(valor(dataColumnas));
        setUsuarios(valor(dataUsuarios));
        setHistorial(valor(dataHistorial));
      })
      .finally(() => setLoading(false));
  }, [proyecto.id]);

  const usuarioPorId = (id) => usuarios.find((u) => u.id === id);

  const datos = useMemo(() => {
    const semanas = semanasRecientes();
    const abiertas = tareas.filter((t) => !t.terminada);
    const terminadas = tareas.length - abiertas.length;
    const vencidas = abiertas.filter((t) => t.fecha_vencimiento && diasHasta(t.fecha_vencimiento) < 0);

    // Siguientes tareas: primero las que tienen fecha (la mas cercana primero), luego sin fecha por prioridad
    const PESO = { alta: 0, media: 1, baja: 2 };
    const proximas = [...abiertas].sort((a, b) => {
      if (a.fecha_vencimiento && b.fecha_vencimiento) return a.fecha_vencimiento.localeCompare(b.fecha_vencimiento);
      if (a.fecha_vencimiento || b.fecha_vencimiento) return a.fecha_vencimiento ? -1 : 1;
      return (PESO[a.prioridad] ?? 1) - (PESO[b.prioridad] ?? 1);
    }).slice(0, 4);

    // Avance de cada persona con tareas asignadas
    const porPersona = new Map();
    tareas.forEach((t) => {
      const clave = t.usuario_asignado_id ?? 'sin';
      const p = porPersona.get(clave) || { abiertas: 0, terminadas: 0, vencidas: 0 };
      if (t.terminada) p.terminadas += 1;
      else {
        p.abiertas += 1;
        if (t.fecha_vencimiento && diasHasta(t.fecha_vencimiento) < 0) p.vencidas += 1;
      }
      porPersona.set(clave, p);
    });
    const equipo = [...porPersona.entries()]
      .map(([id, v]) => ({ id, ...v }))
      .filter((m) => m.id !== 'sin' || m.abiertas > 0)
      .sort((a, b) => (a.id === 'sin') - (b.id === 'sin') || b.abiertas + b.terminadas - (a.abiertas + a.terminadas));

    // Acciones por dia para el mapa de calor
    const porDia = new Map();
    historial.forEach((e) => {
      const k = claveDia(new Date(e.created_at));
      porDia.set(k, (porDia.get(k) || 0) + 1);
    });

    return {
      semanas,
      abiertas: abiertas.length,
      terminadas,
      progreso: tareas.length ? Math.round((terminadas / tareas.length) * 100) : 0,
      vencidas,
      proximas,
      terminadasSemana: contarPorSemana(semanas, tareas.filter((t) => t.terminada).map((t) => t.terminada_at || t.updated_at)),
      docsSemana: contarPorSemana(semanas, documentos.map((d) => d.created_at)),
      docsRecientes: [...documentos].sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at)).slice(0, 4),
      porColumna: columnas.map((c) => ({ ...c, n: tareas.filter((t) => t.columna_id === c.id).length })),
      equipo,
      calor: [...porDia.entries()].map(([dia, acciones]) => ({ dia, acciones })),
    };
  }, [tareas, documentos, columnas, historial]);

  if (loading) return <p className={shared.loadingText}>Cargando...</p>;

  // Entrega: dias que faltan y que parte del tiempo (desde la creacion) ya se uso
  const conEntrega = proyecto.fecha_vencimiento && proyecto.estado !== 'completado';
  const dias = conEntrega ? diasHasta(proyecto.fecha_vencimiento) : null;
  const inicioMs = new Date(proyecto.created_at || Date.now()).getTime();
  const finMs = conEntrega ? new Date(proyecto.fecha_vencimiento).getTime() : 0;
  const tiempo = conEntrega && finMs > inicioMs ? Math.min(100, Math.max(0, Math.round(((Date.now() - inicioMs) / (finMs - inicioMs)) * 100))) : 0;
  const maxColumna = Math.max(1, ...datos.porColumna.map((c) => c.n));
  const totalCalor = datos.calor.reduce((s, d) => s + d.acciones, 0);

  return (
    <div className={styles.resumen}>
      {proyecto.descripcion && <p className={styles.descripcion}>{proyecto.descripcion}</p>}

      {/* ---------- Indicadores: un numero y su grafico ---------- */}
      <section className={styles.indicadores}>
        <div className={`${inicio.tarjeta} ${inicio.indicador}`}>
          <div>
            <div className={inicio.numero}>{datos.progreso}<small>%</small></div>
            <div className={inicio.rotulo}>{tareas.length ? `${datos.terminadas} de ${tareas.length} tareas` : 'sin tareas'}</div>
          </div>
          <AnilloAvance porcentaje={datos.progreso} />
        </div>

        <div className={`${inicio.tarjeta} ${inicio.indicador}`}>
          <div>
            <div className={inicio.numero}>{datos.abiertas}</div>
            <div className={inicio.rotulo}>
              {datos.vencidas.length ? <span className={inicio.baja}>{datos.vencidas.length} vencidas</span> : 'abiertas, nada vencido'}
            </div>
          </div>
          <div className={inicio.puntos} title="Cada punto es una tarea abierta">
            {Array.from({ length: Math.min(datos.abiertas, MAX_PUNTOS) }, (_, i) => (
              <i key={i} style={{ background: i < datos.vencidas.length ? 'var(--danger)' : 'var(--border-strong)' }} />
            ))}
            {datos.abiertas > MAX_PUNTOS && <span>+{datos.abiertas - MAX_PUNTOS}</span>}
          </div>
        </div>

        <div className={`${inicio.tarjeta} ${inicio.indicador}`}>
          <div>
            <div className={`${inicio.numero} ${dias !== null && dias < 0 ? inicio.baja : ''}`}>
              {dias === null ? '–' : Math.abs(dias)}{dias !== null && <small> d</small>}
            </div>
            <div className={inicio.rotulo}>
              {dias === null ? 'sin fecha de entrega' : `${dias < 0 ? 'de retraso' : 'entrega'} ${fechaCorta(proyecto.fecha_vencimiento)}`}
            </div>
          </div>
          {conEntrega && (
            <div title={`Tiempo usado ${tiempo}% · avance ${datos.progreso}%`}>
              <TiempoAvance tiempo={tiempo} avance={datos.progreso} />
            </div>
          )}
        </div>

        <div className={`${inicio.tarjeta} ${inicio.indicador}`}>
          <div>
            <div className={inicio.numero}>{documentos.length}</div>
            <div className={inicio.rotulo}>
              {datos.docsSemana[SEMANAS - 1] > 0 ? <span className={inicio.sube}>+{datos.docsSemana[SEMANAS - 1]} esta semana</span> : 'archivos'}
            </div>
          </div>
          <MiniBarras valores={datos.docsSemana} />
        </div>
      </section>

      {/* ---------- Graficos ---------- */}
      <div className={styles.rejilla}>
        <section className={`${inicio.tarjeta} ${inicio.panel}`}>
          <header className={inicio.panelCabecera}>
            <h2>Terminadas<small>por semana</small></h2>
            <div className={inicio.leyenda}><span><i className={inicio.linea} style={{ background: 'var(--text-muted)' }} />Promedio</span></div>
          </header>
          <BarrasTerminadas cubetas={datos.semanas} valores={datos.terminadasSemana} />
        </section>

        <section className={`${inicio.tarjeta} ${inicio.panel}`}>
          <header className={inicio.panelCabecera}>
            <h2>Tareas por estado</h2>
            <Link to="tareas" className={styles.enlace}>Ver tablero</Link>
          </header>
          {datos.porColumna.length === 0 ? <p className={inicio.vacio}>Sin columnas.</p> : (
            <ul className={styles.estados}>
              {datos.porColumna.map((c, i) => (
                <li key={c.id}>
                  <span className={styles.estadoNombre}>{c.nombre}</span>
                  <span className={styles.pista}>
                    {c.n > 0 && (
                      <i
                        style={{ width: `${(c.n / maxColumna) * 100}%` }}
                        className={i === datos.porColumna.length - 1 ? styles.final : ''}
                      />
                    )}
                  </span>
                  <span className={styles.estadoN}>{c.n}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className={`${inicio.tarjeta} ${inicio.panel} ${styles.ancho}`}>
          <header className={inicio.panelCabecera}>
            <h2>{totalCalor}<small>acciones en el año · toca un día</small></h2>
            <div className={inicio.escala}>
              Menos {[0, 0.3, 0.55, 0.8, 1].map((o) => (
                <i key={o} style={o ? { background: 'var(--accent)', opacity: o } : { background: 'var(--bg-surface-alt)' }} />
              ))} Más
            </div>
          </header>
          <MapaCalor calor={datos.calor} onElegirDia={abrirActividad} />
        </section>

      </div>

      <div className={styles.tres}>
        <section className={`${inicio.tarjeta} ${inicio.panel}`}>
          <header className={inicio.panelCabecera}>
            <h2>Próximas tareas</h2>
            <Link to="tareas" className={styles.enlace}>Ver todas</Link>
          </header>
          {datos.proximas.length === 0 ? (
            <p className={inicio.vacio}>{tareas.length ? 'Todo terminado.' : 'Sin tareas todavía.'}</p>
          ) : (
            <ul className={styles.lista}>
              {datos.proximas.map((t) => {
                const venc = t.fecha_vencimiento ? vencimientoTarea(t.fecha_vencimiento) : null;
                const asignado = usuarioPorId(t.usuario_asignado_id);
                return (
                  <li key={t.id}>
                    <Link to={`tareas?tarea=${t.id}`} className={styles.fila}>
                      <span className={`${styles.prioridad} ${styles[`prioridad_${t.prioridad}`] || ''}`} title={`Prioridad ${t.prioridad}`} />
                      <span className={styles.filaNombre}>{t.titulo}</span>
                      <span className={`${styles.filaDato} ${venc?.tipo === 'vencida' ? styles.vencida : ''}`}>{venc ? venc.texto : 'Sin fecha'}</span>
                      {asignado ? <Avatar usuario={asignado} size={22} /> : <span className={styles.sinAsignar} />}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className={`${inicio.tarjeta} ${inicio.panel}`}>
          <header className={inicio.panelCabecera}>
            <h2>Equipo</h2>
            <div className={inicio.leyenda}>
              <span><i style={{ background: 'var(--accent)' }} />Terminadas</span>
              <span><i style={{ background: 'var(--danger)' }} />Vencidas</span>
              <span><i style={{ background: 'var(--border-strong)' }} />Abiertas</span>
            </div>
          </header>
          {datos.equipo.length === 0 ? <p className={inicio.vacio}>Sin tareas asignadas.</p> : (
            <ul className={styles.equipo}>
              {datos.equipo.map((m) => {
                const usuario = m.id === 'sin' ? null : usuarioPorId(m.id);
                return (
                  <li key={m.id}>
                    {usuario ? <Avatar usuario={usuario} size={24} /> : <span className={styles.sinAsignar} />}
                    <span className={styles.persona}>{usuario ? usuario.nombre : 'Sin asignar'}</span>
                    <span className={styles.carga} title={`${m.terminadas} terminadas · ${m.abiertas} abiertas${m.vencidas ? ` · ${m.vencidas} vencidas` : ''}`}>
                      <i className={styles.cargaHecha} style={{ flexGrow: m.terminadas }} />
                      <i className={styles.cargaVencida} style={{ flexGrow: m.vencidas }} />
                      <i className={styles.cargaAbierta} style={{ flexGrow: m.abiertas - m.vencidas }} />
                    </span>
                    <span className={styles.estadoN}>{m.terminadas}/{m.terminadas + m.abiertas}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className={`${inicio.tarjeta} ${inicio.panel}`}>
          <header className={inicio.panelCabecera}>
            <h2>Archivos recientes</h2>
            <Link to="documentos" className={styles.enlace}>Ver todos</Link>
          </header>
          {datos.docsRecientes.length === 0 ? <p className={inicio.vacio}>Aún no hay archivos.</p> : (
            <ul className={styles.lista}>
              {datos.docsRecientes.map((doc) => (
                <li key={doc.id}>
                  <Link to={`documentos?doc=${doc.id}`} className={styles.fila}>
                    <IconoArchivo tipo={doc.tipo} size={20} />
                    <span className={styles.filaNombre}>{nombreArchivo(doc.nombre, doc.tipo)}</span>
                    <span className={styles.filaDato}>{fechaRelativa(doc.updated_at)}</span>
                    {doc.version_actual > 1 && <span className={styles.version}>v{doc.version_actual}</span>}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
