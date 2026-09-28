import { useState, useEffect, useMemo } from 'react';
import { useOutletContext, Link } from 'react-router-dom';
import { ListChecks, FileText, ChartColumn, Activity, Clock, Check } from 'lucide-react';
import { listarDocumentos } from '../../api/documentos';
import { listarTareas, listarColumnas } from '../../api/tareas';
import { listarUsuarios } from '../../api/usuarios';
import { obtenerHistorial } from '../../api/historial';
import Avatar from '../../components/Avatar';
import { fechaRelativa, vencimientoTarea, diasHasta } from './formato';
import shared from '../../styles/shared.module.css';
import styles from './ProyectoResumen.module.css';

const DIA_MS = 86400000;
const SEMANA_MS = 7 * DIA_MS;
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const RADIO = 52;
const CIRCUNFERENCIA = 2 * Math.PI * RADIO;

function textoEntrega(fechaIso) {
  const dias = diasHasta(fechaIso);
  const [, mes, dia] = fechaIso.slice(0, 10).split('-').map(Number);
  const fecha = `${dia} ${MESES[mes - 1]}`;
  if (dias < 0) return { texto: `Vencido hace ${-dias} ${-dias === 1 ? 'día' : 'días'} · ${fecha}`, tipo: 'vencida' };
  if (dias === 0) return { texto: `Entrega hoy · ${fecha}`, tipo: 'hoy' };
  if (dias === 1) return { texto: `Entrega mañana · ${fecha}`, tipo: 'hoy' };
  return { texto: `Entrega en ${dias} días · ${fecha}`, tipo: dias <= 7 ? 'hoy' : 'normal' };
}

// Etiqueta y color del icono de cada documento segun su extension
function tipoDocumento(tipo) {
  const t = (tipo || '').toLowerCase();
  if (t === 'pdf') return { etiqueta: 'PDF', clase: styles.docPdf };
  if (['doc', 'docx', 'txt', 'odt'].includes(t)) return { etiqueta: 'DOC', clase: styles.docWord };
  if (['xls', 'xlsx', 'csv', 'ods'].includes(t)) return { etiqueta: 'XLS', clase: styles.docHoja };
  if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'].includes(t)) return { etiqueta: 'IMG', clase: styles.docImagen };
  return { etiqueta: (t || 'ARCH').slice(0, 4).toUpperCase(), clase: '' };
}

export default function ProyectoResumen() {
  const { proyecto } = useOutletContext();
  const [documentos, setDocumentos] = useState([]);
  const [tareas, setTareas] = useState([]);
  const [columnas, setColumnas] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [historial, setHistorial] = useState([]);
  const [loading, setLoading] = useState(true);
  const [progresoVisible, setProgresoVisible] = useState(0);

  useEffect(() => {
    Promise.allSettled([
      listarDocumentos(proyecto.id),
      listarTareas(proyecto.id),
      listarColumnas(proyecto.id),
      listarUsuarios(),
      obtenerHistorial(proyecto.id),
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
  const usuarioPorNombre = (nombre) => usuarios.find((u) => u.nombre === nombre) || { nombre };

  const datos = useMemo(() => {
    const ahora = Date.now();
    const abiertas = tareas.filter((t) => !t.terminada);
    const terminadas = tareas.length - abiertas.length;
    const conFecha = abiertas.filter((t) => t.fecha_vencimiento);

    // Tareas vencidas o que vencen en los proximos 3 dias, la mas urgente primero
    const atencion = conFecha
      .map((t) => ({ ...t, dias: diasHasta(t.fecha_vencimiento) }))
      .filter((t) => t.dias <= 3)
      .sort((a, b) => a.dias - b.dias);

    // Terminadas por semana (ultimas 4), aproximado con la fecha de ultima modificacion
    const semanas = [0, 0, 0, 0];
    tareas.forEach((t) => {
      if (!t.terminada || !t.updated_at) return;
      const hace = Math.floor((ahora - new Date(t.updated_at)) / SEMANA_MS);
      if (hace >= 0 && hace < 4) semanas[3 - hace] += 1;
    });

    // Si no hay nada urgente se muestran las siguientes: primero con fecha, luego sin fecha por prioridad
    const PESO_PRIORIDAD = { alta: 0, media: 1, baja: 2 };
    const proximasConFecha = conFecha
      .map((t) => ({ ...t, dias: diasHasta(t.fecha_vencimiento) }))
      .sort((a, b) => a.dias - b.dias)
      .slice(0, 5);
    const proximasSinFecha = abiertas
      .filter((t) => !t.fecha_vencimiento)
      .sort((a, b) => (PESO_PRIORIDAD[a.prioridad] ?? 1) - (PESO_PRIORIDAD[b.prioridad] ?? 1))
      .slice(0, 5 - proximasConFecha.length);

    // Avance por persona: tareas terminadas y abiertas de cada asignado
    const porPersona = new Map();
    tareas.forEach((t) => {
      const clave = t.usuario_asignado_id ?? 'sin';
      const actual = porPersona.get(clave) || { abiertas: 0, terminadas: 0, vencidas: 0 };
      if (t.terminada) {
        actual.terminadas += 1;
      } else {
        actual.abiertas += 1;
        if (t.fecha_vencimiento && diasHasta(t.fecha_vencimiento) < 0) actual.vencidas += 1;
      }
      porPersona.set(clave, actual);
    });
    const equipo = [...porPersona.entries()]
      .map(([id, v]) => ({ id, ...v }))
      // "Sin asignar" solo aparece si tiene tareas abiertas
      .filter((m) => m.id !== 'sin' || m.abiertas > 0)
      .sort((a, b) => (a.id === 'sin') - (b.id === 'sin') || b.abiertas - a.abiertas);

    return {
      abiertas: abiertas.length,
      terminadas,
      progreso: tareas.length ? Math.round((terminadas / tareas.length) * 100) : 0,
      vencidas: atencion.filter((t) => t.dias < 0).length,
      vencenHoy: atencion.filter((t) => t.dias === 0).length,
      atencion,
      proximasConFecha,
      proximasSinFecha,
      semanas,
      docsSemana: documentos.filter((d) => ahora - new Date(d.created_at) < SEMANA_MS).length,
      docsConVersiones: documentos.filter((d) => d.version_actual > 1).length,
      docsRecientes: [...documentos].sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at)).slice(0, 4),
      equipo,
      personas: equipo.filter((m) => m.id !== 'sin').length,
      sinAsignar: abiertas.filter((t) => !t.usuario_asignado_id).length,
    };
  }, [tareas, documentos]);

  // El anillo arranca vacio y se llena al cargar
  useEffect(() => {
    if (loading) return undefined;
    const id = requestAnimationFrame(() => setProgresoVisible(datos.progreso));
    return () => cancelAnimationFrame(id);
  }, [loading, datos.progreso]);

  if (loading) return <p className={shared.loadingText}>Cargando...</p>;

  const responsable = usuarioPorId(proyecto.usuario_id);
  const entrega = proyecto.fecha_vencimiento && proyecto.estado !== 'completado'
    ? textoEntrega(proyecto.fecha_vencimiento)
    : null;
  const ultimo = historial[0];
  const hayUrgentes = datos.atencion.length > 0;

  const filaTarea = (t) => {
    const columna = columnas.find((c) => c.id === t.columna_id);
    const venc = t.fecha_vencimiento ? vencimientoTarea(t.fecha_vencimiento) : null;
    const asignado = usuarioPorId(t.usuario_asignado_id);
    return (
      <Link key={t.id} to="tareas" className={styles.atencionItem}>
        <span className={`${styles.prioridad} ${styles[`prioridad_${t.prioridad}`] || ''}`} />
        <span className={styles.atencionTexto}>
          <b>{t.titulo}</b>
          {columna && (
            <small><i style={{ background: columna.color }} />{columna.nombre}</small>
          )}
        </span>
        {venc ? (
          <span className={`${styles.fecha} ${styles[`fecha_${venc.tipo}`]}`}>{venc.texto}</span>
        ) : (
          <span className={`${styles.fecha} ${styles.fecha_sin}`}>Sin fecha</span>
        )}
        {asignado ? (
          <Avatar usuario={asignado} size={26} className={styles.atencionAvatar} />
        ) : (
          <span className={`${styles.sinAsignar} ${styles.atencionAvatar}`} />
        )}
      </Link>
    );
  };
  const maxSemana = Math.max(1, ...datos.semanas);

  return (
    <div className={styles.resumen}>
      {/* ---------- Progreso ---------- */}
      <section className={`${styles.card} ${styles.hero}`}>
        <div className={styles.anillo} role="img" aria-label={`${datos.progreso}% de tareas terminadas`}>
          <svg viewBox="0 0 120 120">
            <circle className={styles.anilloPista} cx="60" cy="60" r={RADIO} />
            <circle
              className={styles.anilloValor}
              cx="60"
              cy="60"
              r={RADIO}
              strokeDasharray={CIRCUNFERENCIA}
              strokeDashoffset={CIRCUNFERENCIA * (1 - progresoVisible / 100)}
            />
          </svg>
          <div className={styles.anilloTexto}>
            <b>{datos.progreso}%</b>
            <small>
              {tareas.length ? `${datos.terminadas} de ${tareas.length} tareas` : 'Sin tareas'}
            </small>
          </div>
        </div>

        <div className={styles.heroInfo}>
          {proyecto.descripcion && <p className={styles.descripcion}>{proyecto.descripcion}</p>}
          {(responsable || entrega) && (
            <div className={styles.datos}>
              {responsable && (
                <span className={styles.dato}>
                  <Avatar usuario={responsable} size={22} />
                  <span>Responsable <b>{responsable.nombre}</b></span>
                </span>
              )}
              {entrega && (
                <span className={`${styles.entrega} ${styles[`entrega_${entrega.tipo}`]}`}>
                  <Clock size={13} />
                  {entrega.texto}
                </span>
              )}
            </div>
          )}
          {tareas.length > 0 && (
            <>
              <div className={styles.barraSeg} aria-hidden="true">
                {columnas.map((c) => {
                  const n = tareas.filter((t) => t.columna_id === c.id).length;
                  return n ? <i key={c.id} style={{ flexGrow: n, background: c.color }} /> : null;
                })}
              </div>
              <div className={styles.leyenda}>
                {columnas.map((c) => (
                  <span key={c.id}>
                    <i style={{ background: c.color }} />
                    {c.nombre} <b>{tareas.filter((t) => t.columna_id === c.id).length}</b>
                  </span>
                ))}
              </div>
            </>
          )}
        </div>
      </section>

      {/* ---------- Metricas ---------- */}
      <section className={styles.metricas}>
        <div className={`${styles.card} ${styles.metrica}`}>
          <div className={styles.metricaTop}>
            Tareas abiertas
            <span className={`${styles.metricaIcono} ${styles.iconoAccent}`}><ListChecks size={16} /></span>
          </div>
          <div className={styles.metricaValor}>{datos.abiertas}</div>
          <div className={styles.metricaSub}>
            {datos.vencidas === 0 && datos.vencenHoy === 0 ? (
              <span className={styles.verde}>Nada vencido</span>
            ) : (
              <>
                {datos.vencidas > 0 && (
                  <span className={styles.rojo}>{datos.vencidas} {datos.vencidas === 1 ? 'vencida' : 'vencidas'}</span>
                )}
                {datos.vencidas > 0 && datos.vencenHoy > 0 && '·'}
                {datos.vencenHoy > 0 && (
                  <span className={styles.ambar}>{datos.vencenHoy} {datos.vencenHoy === 1 ? 'vence' : 'vencen'} hoy</span>
                )}
              </>
            )}
          </div>
        </div>

        <div className={`${styles.card} ${styles.metrica}`}>
          <div className={styles.metricaTop}>
            Documentos
            <span className={`${styles.metricaIcono} ${styles.iconoInfo}`}><FileText size={16} /></span>
          </div>
          <div className={styles.metricaValor}>{documentos.length}</div>
          <div className={styles.metricaSub}>
            {datos.docsSemana > 0 ? <span className={styles.verde}>+{datos.docsSemana}</span> : '0'} esta semana
            {datos.docsConVersiones > 0 && ` · ${datos.docsConVersiones} con versiones`}
          </div>
        </div>

        <div className={`${styles.card} ${styles.metrica}`}>
          <div className={styles.metricaTop}>
            Terminadas por semana
            <span className={`${styles.metricaIcono} ${styles.iconoVerde}`}><ChartColumn size={16} /></span>
          </div>
          <div
            className={styles.spark}
            role="img"
            aria-label={`Tareas terminadas en las últimas 4 semanas: ${datos.semanas.join(', ')}`}
          >
            {datos.semanas.map((n, i) => (
              <i key={i} style={{ height: `${Math.max(8, (n / maxSemana) * 100)}%` }} title={`${n}`} />
            ))}
          </div>
          <div className={styles.metricaSub}>
            <span className={styles.verde}>{datos.semanas[3]}</span> esta semana
            {datos.semanas[3] > datos.semanas[2] && ' · mejor que la anterior'}
          </div>
        </div>

        <div className={`${styles.card} ${styles.metrica}`}>
          <div className={styles.metricaTop}>
            Última actividad
            <span className={`${styles.metricaIcono} ${styles.iconoAmbar}`}><Activity size={16} /></span>
          </div>
          <div className={`${styles.metricaValor} ${styles.metricaValorTexto}`}>
            {fechaRelativa(ultimo?.created_at || proyecto.updated_at)}
          </div>
          <div className={`${styles.metricaSub} ${styles.recortar}`}>
            {ultimo ? `${ultimo.usuario_nombre || 'Alguien'} · ${ultimo.texto}` : 'Sin actividad registrada'}
          </div>
        </div>
      </section>

      {/* ---------- Rejilla principal ---------- */}
      {/* Filas de dos paneles: los de cada fila quedan con la misma altura */}
      <div className={styles.rejilla}>
        <section className={`${styles.card} ${styles.panel}`}>
          <div className={styles.panelCab}>
            {hayUrgentes ? (
              <h2>
                Requiere atención
                <span className={styles.conteo}>{datos.atencion.length}</span>
              </h2>
            ) : (
              <h2>
                Próximas tareas
                {datos.abiertas > 0 && (
                  <span className={styles.alDiaChip}><Check size={12} strokeWidth={3} />Todo al día</span>
                )}
              </h2>
            )}
            <Link to="tareas" className={styles.verTodos}>Ver tablero →</Link>
          </div>
          {hayUrgentes ? (
            <div className={styles.atencion}>{datos.atencion.slice(0, 5).map(filaTarea)}</div>
          ) : datos.abiertas > 0 ? (
            <div className={styles.atencion}>
              {datos.proximasConFecha.map(filaTarea)}
              {datos.proximasSinFecha.length > 0 && (
                <>
                  {datos.proximasConFecha.length > 0 && <div className={styles.separador}>Sin fecha</div>}
                  {datos.proximasSinFecha.map(filaTarea)}
                </>
              )}
            </div>
          ) : (
            <div className={styles.vacio}>
              <span className={styles.vacioIcono}><Check size={24} strokeWidth={2.5} /></span>
              <b>No hay tareas pendientes</b>
              <p>{tareas.length ? 'Todas las tareas de este proyecto están terminadas.' : 'Este proyecto todavía no tiene tareas.'}</p>
              <Link to="tareas" className={styles.verTodos}>Ir al tablero →</Link>
            </div>
          )}
        </section>
        <section className={`${styles.card} ${styles.panel}`}>
          <div className={styles.panelCab}>
            <h2>Actividad reciente</h2>
          </div>
          {historial.length === 0 ? (
            <p className={shared.emptyText}>Todavía no hay actividad.</p>
          ) : (
            <ul className={styles.linea}>
              {historial.slice(0, 6).map((ev, i) => (
                <li key={`${ev.created_at}-${i}`}>
                  <Avatar usuario={usuarioPorNombre(ev.usuario_nombre)} size={26} className={styles.lineaAvatar} />
                  <div>
                    <p>
                      {ev.usuario_nombre && <b>{ev.usuario_nombre} · </b>}
                      {ev.texto}
                    </p>
                    {ev.detalle && <p className={styles.lineaDetalle}>{ev.detalle}</p>}
                    <small>{fechaRelativa(ev.created_at)}</small>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className={`${styles.card} ${styles.panel}`}>
          <div className={styles.panelCab}>
            <h2>Documentos recientes</h2>
            <Link to="documentos" className={styles.verTodos}>Ver todos →</Link>
          </div>
          {datos.docsRecientes.length === 0 ? (
            <p className={shared.emptyText}>Aún no hay documentos en este proyecto.</p>
          ) : (
            <div className={styles.docs}>
              {datos.docsRecientes.map((doc) => {
                const tipo = tipoDocumento(doc.tipo);
                return (
                  <Link key={doc.id} to="documentos" className={styles.doc}>
                    <span className={`${styles.docIcono} ${tipo.clase}`}>{tipo.etiqueta}</span>
                    <span className={styles.docTexto}>
                      <b>{doc.nombre}</b>
                      <small>
                        {doc.modificado_por ? `${doc.modificado_por} · ` : ''}
                        {fechaRelativa(doc.updated_at)}
                      </small>
                    </span>
                    <span className={`${styles.version} ${doc.version_actual > 1 ? styles.versionNueva : ''}`}>
                      v{doc.version_actual}
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
        <section className={`${styles.card} ${styles.panel}`}>
          <div className={styles.panelCab}>
            <h2>Equipo</h2>
            <span className={styles.panelNota}>avance por persona</span>
          </div>
          {datos.equipo.length === 0 ? (
            <div className={styles.vacio}>
              <b>Sin tareas asignadas</b>
              <p>Asigna tareas en el tablero para ver el avance de cada persona.</p>
            </div>
          ) : (
            <div className={styles.equipo}>
              <div className={styles.equipoLista}>
                {datos.equipo.map((m) => {
                  const usuario = m.id === 'sin' ? null : usuarioPorId(m.id);
                  const total = m.abiertas + m.terminadas;
                  const alDia = m.abiertas - m.vencidas;
                  return (
                    <div key={m.id} className={styles.miembro}>
                      {usuario ? <Avatar usuario={usuario} size={32} /> : <span className={styles.sinAsignarGrande} />}
                      <div className={styles.miembroInfo}>
                        <div className={styles.miembroFila}>
                          <b className={usuario ? '' : styles.textoSuave}>{usuario ? usuario.nombre : 'Sin asignar'}</b>
                          <span className={styles.miembroConteo}>{m.terminadas}/{total}</span>
                        </div>
                        <div className={styles.carga} aria-hidden="true">
                          <i className={styles.cargaHecha} style={{ flexGrow: m.terminadas }} />
                          <i className={styles.cargaVencida} style={{ flexGrow: m.vencidas }} />
                          <i className={styles.cargaAbierta} style={{ flexGrow: alDia }} />
                        </div>
                        <small className={styles.miembroDetalle}>
                          {m.abiertas === 0 ? (
                            <span className={styles.verde}>Todo terminado</span>
                          ) : (
                            <>
                              {m.abiertas} {m.abiertas === 1 ? 'abierta' : 'abiertas'}
                              {m.vencidas > 0 && (
                                <span className={styles.rojo}> · {m.vencidas} {m.vencidas === 1 ? 'vencida' : 'vencidas'}</span>
                              )}
                            </>
                          )}
                        </small>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className={styles.equipoPie}>
                <span><b>{datos.personas}</b> {datos.personas === 1 ? 'persona' : 'personas'}</span>
                <span><b>{datos.abiertas}</b> {datos.abiertas === 1 ? 'abierta' : 'abiertas'}</span>
                <span className={datos.sinAsignar ? styles.ambar : ''}>
                  <b>{datos.sinAsignar}</b> sin asignar
                </span>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
