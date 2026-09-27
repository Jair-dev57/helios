import { useState, useEffect, useMemo } from 'react';
import { useOutletContext, Link } from 'react-router-dom';
import { ListChecks, FileText, ChartColumn, Activity, Clock, CircleCheck } from 'lucide-react';
import { listarDocumentos } from '../../api/documentos';
import { listarTareas, listarColumnas } from '../../api/tareas';
import { listarUsuarios } from '../../api/usuarios';
import { obtenerHistorial } from '../../api/historial';
import Avatar from '../../components/Avatar';
import { fechaRelativa, vencimientoTarea } from './formato';
import shared from '../../styles/shared.module.css';
import styles from './ProyectoResumen.module.css';

const DIA_MS = 86400000;
const SEMANA_MS = 7 * DIA_MS;
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const RADIO = 52;
const CIRCUNFERENCIA = 2 * Math.PI * RADIO;

// Dias calendario desde hoy hasta la fecha (negativo si ya paso). Las fechas se guardan a medianoche UTC.
function diasHasta(fechaIso) {
  const [anio, mes, dia] = fechaIso.slice(0, 10).split('-').map(Number);
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  return Math.round((new Date(anio, mes - 1, dia) - hoy) / DIA_MS);
}

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

    // Carga del equipo: tareas abiertas por persona asignada
    const porPersona = new Map();
    abiertas.forEach((t) => {
      const clave = t.usuario_asignado_id ?? 'sin';
      const actual = porPersona.get(clave) || { abiertas: 0, vencidas: 0 };
      actual.abiertas += 1;
      if (t.fecha_vencimiento && diasHasta(t.fecha_vencimiento) < 0) actual.vencidas += 1;
      porPersona.set(clave, actual);
    });
    const equipo = [...porPersona.entries()]
      .map(([id, v]) => ({ id, ...v }))
      .sort((a, b) => (a.id === 'sin') - (b.id === 'sin') || b.abiertas - a.abiertas);

    return {
      abiertas: abiertas.length,
      terminadas,
      progreso: tareas.length ? Math.round((terminadas / tareas.length) * 100) : 0,
      vencidas: atencion.filter((t) => t.dias < 0).length,
      vencenHoy: atencion.filter((t) => t.dias === 0).length,
      atencion,
      semanas,
      docsSemana: documentos.filter((d) => ahora - new Date(d.created_at) < SEMANA_MS).length,
      docsConVersiones: documentos.filter((d) => d.version_actual > 1).length,
      docsRecientes: [...documentos].sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at)).slice(0, 4),
      equipo,
      maxCarga: Math.max(1, ...equipo.map((e) => e.abiertas)),
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
      <div className={styles.rejilla}>
        <div className={styles.columna}>
          <section className={`${styles.card} ${styles.panel}`}>
            <div className={styles.panelCab}>
              <h2>
                Requiere atención
                {datos.atencion.length > 0 && <span className={styles.conteo}>{datos.atencion.length}</span>}
              </h2>
              <Link to="tareas" className={styles.verTodos}>Ver tablero →</Link>
            </div>
            {datos.atencion.length === 0 ? (
              <div className={styles.alDia}>
                <CircleCheck size={20} />
                Todo al día: no hay tareas vencidas ni por vencer.
              </div>
            ) : (
              <div className={styles.atencion}>
                {datos.atencion.slice(0, 5).map((t) => {
                  const columna = columnas.find((c) => c.id === t.columna_id);
                  const venc = vencimientoTarea(t.fecha_vencimiento);
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
                      <span className={`${styles.fecha} ${styles[`fecha_${venc.tipo}`]}`}>{venc.texto}</span>
                      {asignado ? (
                        <Avatar usuario={asignado} size={26} className={styles.atencionAvatar} />
                      ) : (
                        <span className={`${styles.sinAsignar} ${styles.atencionAvatar}`} />
                      )}
                    </Link>
                  );
                })}
              </div>
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
        </div>

        <div className={styles.columna}>
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
              <h2>Equipo</h2>
              <span className={styles.panelNota}>tareas abiertas</span>
            </div>
            {datos.equipo.length === 0 ? (
              <p className={shared.emptyText}>No hay tareas abiertas.</p>
            ) : (
              <div className={styles.equipo}>
                {datos.equipo.map((m) => {
                  const usuario = m.id === 'sin' ? null : usuarioPorId(m.id);
                  const color = m.id === 'sin'
                    ? 'var(--text-muted)'
                    : m.vencidas > 0 ? 'var(--danger)' : 'var(--accent)';
                  return (
                    <div key={m.id} className={styles.miembro}>
                      {usuario ? <Avatar usuario={usuario} size={30} /> : <span className={styles.sinAsignarGrande} />}
                      <div className={styles.miembroInfo}>
                        <b className={usuario ? '' : styles.textoSuave}>{usuario ? usuario.nombre : 'Sin asignar'}</b>
                        <div className={styles.carga}>
                          <i style={{ width: `${(m.abiertas / datos.maxCarga) * 100}%`, background: color }} />
                        </div>
                      </div>
                      <span className={styles.miembroConteo}>
                        {m.abiertas}
                        {m.vencidas > 0 && ` · ${m.vencidas} ${m.vencidas === 1 ? 'vencida' : 'vencidas'}`}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
