import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  Plus, Pencil, ListChecks, FileText, Calendar, Search, LayoutGrid, List,
  FolderOpen, CalendarClock, TriangleAlert, ChartColumn, CircleAlert,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import {
  listarProyectos,
  crearProyecto,
  actualizarProyecto,
  eliminarProyecto,
} from '../../api/proyectos';
import { listarClientes } from '../../api/clientes';
import { listarTareas, listarColumnas } from '../../api/tareas';
import { listarDocumentos } from '../../api/documentos';
import { listarUsuarios } from '../../api/usuarios';
import PageContainer from '../../components/PageContainer';
import Avatar from '../../components/Avatar';
import { diasHasta, fechaCorta } from './formato';
import shared from '../../styles/shared.module.css';
import styles from './Proyectos.module.css';

const ESTADOS = ['activo', 'pausado', 'completado', 'cancelado'];
const NOMBRE_ESTADO = { activo: 'Activo', pausado: 'Pausado', completado: 'Completado', cancelado: 'Cancelado' };
const PESTANAS = [
  ['todos', 'Todos'],
  ['activo', 'Activos'],
  ['pausado', 'Pausados'],
  ['completado', 'Completados'],
];
const ORDENES = {
  entrega: 'Entrega más próxima',
  avance: 'Mayor avance',
  actividad: 'Actividad reciente',
  nombre: 'Nombre',
};
// Colores para el circulo del cliente, elegidos por id para que cada cliente conserve el suyo
const COLORES_CLIENTE = ['#6D5BD0', '#2E8C8C', '#C0612E', '#B0457A', '#3D7FC0', '#8C6D2E', '#3A9A5B'];
const CLAVE_VISTA = 'proyectos.vista';

const FORM_VACIO = {
  nombre: '',
  descripcion: '',
  estado: 'activo',
  fecha_vencimiento: '',
  cliente_id: '',
};

const iniciales = (texto) =>
  (texto || '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('');

const leerVista = () => {
  try {
    return localStorage.getItem(CLAVE_VISTA) === 'lista' ? 'lista' : 'tarjetas';
  } catch {
    return 'tarjetas';
  }
};

// Texto y tono de la entrega del proyecto
function entregaProyecto(proyecto) {
  if (proyecto.estado === 'completado') return { texto: 'Completado', tipo: '' };
  if (!proyecto.fecha_vencimiento) return { texto: 'Sin fecha', tipo: 'sin' };
  const dias = diasHasta(proyecto.fecha_vencimiento);
  const fecha = fechaCorta(proyecto.fecha_vencimiento);
  if (dias < 0) return { texto: `Vencido hace ${-dias} ${-dias === 1 ? 'día' : 'días'}`, tipo: 'vencida' };
  if (dias === 0) return { texto: 'Entrega hoy', tipo: 'pronto' };
  if (dias === 1) return { texto: 'Entrega mañana', tipo: 'pronto' };
  if (dias <= 7) return { texto: `Vence en ${dias} días`, tipo: 'pronto' };
  return { texto: `${fecha} · en ${dias} días`, tipo: '' };
}

const colorAvance = (v) =>
  v >= 100 ? 'var(--info)' : v >= 60 ? 'var(--success)' : v >= 25 ? 'var(--accent)' : 'var(--warning)';

const RADIO_ANILLO = 24;
const CIRC_ANILLO = 2 * Math.PI * RADIO_ANILLO;

const Proyectos = () => {
  const { user } = useAuth();
  const [proyectos, setProyectos] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [tareas, setTareas] = useState([]);
  const [documentos, setDocumentos] = useState([]);
  const [columnas, setColumnas] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [busqueda, setBusqueda] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('todos');
  const [orden, setOrden] = useState('entrega');
  const [vista, setVista] = useState(leerVista);

  const [modalAbierto, setModalAbierto] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [form, setForm] = useState(FORM_VACIO);
  const [guardando, setGuardando] = useState(false);

  const cargarDatos = async () => {
    setLoading(true);
    try {
      const [dataProyectos, dataClientes, dataTareas, dataDocumentos] = await Promise.all([
        listarProyectos(),
        listarClientes(),
        listarTareas(),
        listarDocumentos(),
      ]);
      setProyectos(dataProyectos);
      setClientes(dataClientes);
      setTareas(dataTareas);
      setDocumentos(dataDocumentos);
      setError(null);
    } catch (err) {
      setError('No se pudieron cargar los proyectos');
    } finally {
      setLoading(false);
    }
    // Complementos visuales: si fallan, las tarjetas se muestran sin ellos
    const [dataColumnas, dataUsuarios] = await Promise.allSettled([listarColumnas(), listarUsuarios()]);
    if (dataColumnas.status === 'fulfilled') setColumnas(dataColumnas.value);
    if (dataUsuarios.status === 'fulfilled') setUsuarios(dataUsuarios.value);
  };

  useEffect(() => {
    cargarDatos();
  }, []);

  const cambiarVista = (nueva) => {
    setVista(nueva);
    try {
      localStorage.setItem(CLAVE_VISTA, nueva);
    } catch {
      // Sin almacenamiento la vista simplemente no se recuerda
    }
  };

  // Datos calculados por proyecto
  const info = useMemo(() => {
    const mapa = new Map();
    proyectos.forEach((p) => {
      const tareasP = tareas.filter((t) => t.proyecto_id === p.id);
      const hechas = tareasP.filter((t) => t.terminada).length;
      const vencidas = tareasP.filter(
        (t) => !t.terminada && t.fecha_vencimiento && diasHasta(t.fecha_vencimiento) < 0,
      ).length;
      const segmentos = columnas
        .filter((c) => c.proyecto_id === p.id)
        .map((c) => ({ id: c.id, color: c.color, n: tareasP.filter((t) => t.columna_id === c.id).length }))
        .filter((s) => s.n > 0);
      // Equipo: responsable y personas con tareas asignadas
      const ids = [p.usuario_id, ...tareasP.map((t) => t.usuario_asignado_id)].filter(Boolean);
      const equipo = [...new Set(ids)].map((id) => usuarios.find((u) => u.id === id)).filter(Boolean);
      const cliente = clientes.find((c) => c.id === p.cliente_id);
      mapa.set(p.id, {
        total: tareasP.length,
        hechas,
        vencidas,
        progreso: tareasP.length ? Math.round((hechas / tareasP.length) * 100) : 0,
        documentos: documentos.filter((d) => d.proyecto_id === p.id).length,
        segmentos,
        equipo,
        cliente,
        entrega: entregaProyecto(p),
      });
    });
    return mapa;
  }, [proyectos, tareas, documentos, columnas, usuarios, clientes]);

  const metricas = useMemo(() => {
    const hoy = new Date();
    const activos = proyectos.filter((p) => p.estado === 'activo');
    const entregasMes = activos.filter((p) => {
      if (!p.fecha_vencimiento) return false;
      const [anio, mes] = p.fecha_vencimiento.slice(0, 7).split('-').map(Number);
      return anio === hoy.getFullYear() && mes === hoy.getMonth() + 1;
    }).length;
    const vencidas = tareas.filter(
      (t) => !t.terminada && t.fecha_vencimiento && diasHasta(t.fecha_vencimiento) < 0,
    ).length;
    const avance = tareas.length
      ? Math.round((tareas.filter((t) => t.terminada).length / tareas.length) * 100)
      : 0;
    return { activos: activos.length, entregasMes, vencidas, avance };
  }, [proyectos, tareas]);

  const conteoEstado = (estado) =>
    estado === 'todos' ? proyectos.length : proyectos.filter((p) => p.estado === estado).length;

  const visibles = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    const apagado = (p) => (p.estado === 'completado' || p.estado === 'cancelado' ? 1 : 0);
    const comparar = {
      entrega: (a, b) =>
        (a.fecha_vencimiento ? 0 : 1) - (b.fecha_vencimiento ? 0 : 1) ||
        (a.fecha_vencimiento || '').localeCompare(b.fecha_vencimiento || ''),
      avance: (a, b) => info.get(b.id).progreso - info.get(a.id).progreso,
      actividad: (a, b) => (b.updated_at || '').localeCompare(a.updated_at || ''),
      nombre: (a, b) => a.nombre.localeCompare(b.nombre, 'es'),
    }[orden];
    return proyectos
      .filter((p) => filtroEstado === 'todos' || p.estado === filtroEstado)
      .filter((p) => {
        if (!texto) return true;
        const cliente = info.get(p.id)?.cliente?.nombre || '';
        return `${p.nombre} ${cliente}`.toLowerCase().includes(texto);
      })
      // Completados y cancelados siempre al final
      .sort((a, b) => apagado(a) - apagado(b) || comparar(a, b));
  }, [proyectos, filtroEstado, busqueda, orden, info]);

  const limpiarFiltros = () => {
    setBusqueda('');
    setFiltroEstado('todos');
  };

  const abrirModalCrear = () => {
    setEditandoId(null);
    setForm(FORM_VACIO);
    setModalAbierto(true);
  };

  const abrirModalEditar = (proyecto, e) => {
    e.preventDefault();
    e.stopPropagation();
    setEditandoId(proyecto.id);
    setForm({
      nombre: proyecto.nombre || '',
      descripcion: proyecto.descripcion || '',
      estado: proyecto.estado || 'activo',
      fecha_vencimiento: proyecto.fecha_vencimiento
        ? proyecto.fecha_vencimiento.slice(0, 10)
        : '',
      cliente_id: proyecto.cliente_id || '',
    });
    setModalAbierto(true);
  };

  const cerrarModal = () => {
    setModalAbierto(false);
    setEditandoId(null);
    setForm(FORM_VACIO);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setGuardando(true);
    try {
      const payload = {
        ...form,
        cliente_id: form.cliente_id ? Number(form.cliente_id) : null,
        fecha_vencimiento: form.fecha_vencimiento
          ? `${form.fecha_vencimiento}T00:00:00Z`
          : null,
        usuario_id: user?.id || null,
      };
      if (editandoId) {
        await actualizarProyecto(editandoId, payload);
        toast.success('Proyecto actualizado');
      } else {
        await crearProyecto(payload);
        toast.success('Proyecto creado');
      }
      cerrarModal();
      cargarDatos();
    } catch (err) {
      toast.error('No se pudo guardar el proyecto');
    } finally {
      setGuardando(false);
    }
  };

  const logoCliente = (proyecto, datos, grande = true) => {
    const base = datos.cliente || { id: proyecto.id, nombre: proyecto.nombre };
    const color = COLORES_CLIENTE[base.id % COLORES_CLIENTE.length];
    return (
      <span
        className={`${styles.logo} ${grande ? '' : styles.logoChico}`}
        style={{ background: `${color}24`, color }}
        aria-hidden="true"
      >
        {iniciales(base.nombre)}
      </span>
    );
  };

  const barraSegmentos = (datos) => (
    <div className={styles.barra} aria-hidden="true">
      {datos.segmentos.length > 0
        ? datos.segmentos.map((s) => <i key={s.id} style={{ flexGrow: s.n, background: s.color }} />)
        : datos.total > 0 && (
          <>
            <i style={{ flexGrow: datos.hechas, background: 'var(--success)' }} />
            <i style={{ flexGrow: datos.total - datos.hechas, background: 'var(--border-strong)' }} />
          </>
        )}
    </div>
  );

  const pilaEquipo = (equipo) => (
    <span className={styles.pila}>
      {equipo.slice(0, 3).map((u) => (
        <span key={u.id} title={u.nombre} className={styles.pilaItem}>
          <Avatar usuario={u} size={26} />
        </span>
      ))}
      {equipo.length > 3 && <span className={`${styles.pilaItem} ${styles.pilaMas}`}>+{equipo.length - 3}</span>}
    </span>
  );

  const entregaChip = (entrega) => (
    <span className={`${styles.entrega} ${styles[`entrega_${entrega.tipo}`] || ''}`}>
      <Calendar size={13} />
      {entrega.texto}
    </span>
  );

  const botonEditar = (proyecto) => (
    <button
      type="button"
      className={styles.editar}
      onClick={(e) => abrirModalEditar(proyecto, e)}
      title="Editar"
      aria-label={`Editar ${proyecto.nombre}`}
    >
      <Pencil size={15} />
    </button>
  );

  const apagado = (p) => (p.estado === 'completado' || p.estado === 'cancelado' ? styles.apagado : '');

  return (
    <PageContainer wide>
      <div className={styles.header}>
        <h1 className={styles.title}>Proyectos</h1>
        <button className={shared.btnPrimary} onClick={abrirModalCrear}>
          <Plus size={16} style={{ marginRight: 6, verticalAlign: -3 }} />
          Nuevo proyecto
        </button>
      </div>

      {error && <div className={shared.errorBanner}>{error}</div>}

      {loading ? (
        <p className={shared.loadingText}>Cargando...</p>
      ) : proyectos.length === 0 ? (
        <div className={styles.vacio}>
          <b>Aún no hay proyectos</b>
          Crea el primero para empezar a organizar documentos y tareas.
          <button className={shared.btnPrimary} onClick={abrirModalCrear}>
            <Plus size={16} style={{ marginRight: 6, verticalAlign: -3 }} />
            Nuevo proyecto
          </button>
        </div>
      ) : (
        <>
          <section className={styles.metricas}>
            <div className={styles.metrica}>
              <span className={`${styles.metricaIcono} ${styles.iconoVerde}`}><FolderOpen size={19} /></span>
              <div><b>{metricas.activos}</b><small>Proyectos activos</small></div>
            </div>
            <div className={styles.metrica}>
              <span className={`${styles.metricaIcono} ${styles.iconoAmbar}`}><CalendarClock size={19} /></span>
              <div><b>{metricas.entregasMes}</b><small>Entregas este mes</small></div>
            </div>
            <div className={styles.metrica}>
              <span className={`${styles.metricaIcono} ${styles.iconoRojo}`}><TriangleAlert size={19} /></span>
              <div><b>{metricas.vencidas}</b><small>{metricas.vencidas === 1 ? 'Tarea vencida' : 'Tareas vencidas'}</small></div>
            </div>
            <div className={styles.metrica}>
              <span className={`${styles.metricaIcono} ${styles.iconoAccent}`}><ChartColumn size={19} /></span>
              <div><b>{metricas.avance}%</b><small>Avance general</small></div>
            </div>
          </section>

          <div className={styles.herramientas}>
            <label className={styles.buscar}>
              <Search size={16} />
              <input
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar proyecto o cliente"
                aria-label="Buscar proyecto o cliente"
              />
            </label>
            <div className={styles.pestanas} role="group" aria-label="Filtrar por estado">
              {PESTANAS.map(([valor, texto]) => (
                <button
                  key={valor}
                  type="button"
                  aria-pressed={filtroEstado === valor}
                  onClick={() => setFiltroEstado(valor)}
                >
                  {texto} <span>{conteoEstado(valor)}</span>
                </button>
              ))}
            </div>
            <div className={styles.espacio} />
            <select
              className={styles.select}
              value={orden}
              onChange={(e) => setOrden(e.target.value)}
              aria-label="Ordenar proyectos"
            >
              {Object.entries(ORDENES).map(([valor, texto]) => (
                <option key={valor} value={valor}>{texto}</option>
              ))}
            </select>
            <div className={styles.vista} role="group" aria-label="Vista">
              <button
                type="button"
                aria-pressed={vista === 'tarjetas'}
                onClick={() => cambiarVista('tarjetas')}
                title="Tarjetas"
                aria-label="Vista de tarjetas"
              >
                <LayoutGrid size={16} />
              </button>
              <button
                type="button"
                aria-pressed={vista === 'lista'}
                onClick={() => cambiarVista('lista')}
                title="Lista"
                aria-label="Vista de lista"
              >
                <List size={16} />
              </button>
            </div>
          </div>

          {visibles.length === 0 ? (
            <div className={styles.vacio}>
              <b>No hay proyectos que coincidan</b>
              Prueba con otro nombre o cambia el filtro de estado.
              <button className={shared.btnSecondary} onClick={limpiarFiltros}>Limpiar filtros</button>
            </div>
          ) : vista === 'tarjetas' ? (
            <div className={styles.grid}>
              {visibles.map((proyecto) => {
                const datos = info.get(proyecto.id);
                return (
                  <article key={proyecto.id} className={`${styles.tarjeta} ${apagado(proyecto)}`}>
                    <Link to={`/proyectos/${proyecto.id}`} className={styles.tarjetaEnlace} aria-label={proyecto.nombre} />
                    <div className={styles.tarjetaCab}>
                      {logoCliente(proyecto, datos)}
                      <div className={styles.tarjetaTitulo}>
                        <b>{proyecto.nombre}</b>
                        <small>{datos.cliente?.nombre || 'Sin cliente'}</small>
                      </div>
                      <span className={`${styles.estado} ${styles[`estado_${proyecto.estado}`] || ''}`}>
                        {NOMBRE_ESTADO[proyecto.estado] || proyecto.estado}
                      </span>
                    </div>
                    {botonEditar(proyecto)}

                    <div className={styles.tarjetaCuerpo}>
                      <p className={`${styles.descripcion} ${proyecto.descripcion ? '' : styles.descripcionVacia}`}>
                        {proyecto.descripcion || 'Sin descripción'}
                      </p>
                      <div className={styles.anillo} role="img" aria-label={`${datos.progreso}% de avance`}>
                        <svg viewBox="0 0 60 60">
                          <circle className={styles.anilloPista} cx="30" cy="30" r={RADIO_ANILLO} />
                          <circle
                            className={styles.anilloValor}
                            cx="30"
                            cy="30"
                            r={RADIO_ANILLO}
                            stroke={colorAvance(datos.progreso)}
                            strokeDasharray={CIRC_ANILLO}
                            strokeDashoffset={CIRC_ANILLO * (1 - datos.progreso / 100)}
                          />
                        </svg>
                        <b>{datos.progreso}%</b>
                      </div>
                    </div>

                    {barraSegmentos(datos)}

                    <div className={styles.tarjetaPie}>
                      {entregaChip(datos.entrega)}
                      {datos.vencidas > 0 && (
                        <span className={styles.alerta}>
                          <CircleAlert size={12} />
                          {datos.vencidas} {datos.vencidas === 1 ? 'vencida' : 'vencidas'}
                        </span>
                      )}
                      <span className={styles.espacio} />
                      <span className={styles.conteo} title="Tareas"><ListChecks size={14} />{datos.total}</span>
                      <span className={styles.conteo} title="Documentos"><FileText size={14} />{datos.documentos}</span>
                      {pilaEquipo(datos.equipo)}
                    </div>
                  </article>
                );
              })}
              <button type="button" className={styles.nueva} onClick={abrirModalCrear}>
                <span><Plus size={20} /></span>
                Nuevo proyecto
              </button>
            </div>
          ) : (
            <div className={styles.lista}>
              <div className={styles.listaCab}>
                <span>Proyecto</span>
                <span>Avance</span>
                <span>Entrega</span>
                <span className={styles.colEquipo}>Equipo</span>
                <span className={styles.colConteos}>Tareas · Docs</span>
                <span className={styles.colEstado}>Estado</span>
                <span />
              </div>
              {visibles.map((proyecto) => {
                const datos = info.get(proyecto.id);
                return (
                  <div key={proyecto.id} className={`${styles.fila} ${apagado(proyecto)}`}>
                    <Link to={`/proyectos/${proyecto.id}`} className={styles.tarjetaEnlace} aria-label={proyecto.nombre} />
                    <div className={styles.filaNombre}>
                      {logoCliente(proyecto, datos, false)}
                      <div>
                        <b>{proyecto.nombre}</b>
                        <small>{datos.cliente?.nombre || 'Sin cliente'}</small>
                      </div>
                    </div>
                    <div className={styles.filaAvance}>
                      {barraSegmentos(datos)}
                      <span>{datos.progreso}%</span>
                    </div>
                    <div>{entregaChip(datos.entrega)}</div>
                    <div className={styles.colEquipo}>{pilaEquipo(datos.equipo)}</div>
                    <div className={`${styles.colConteos} ${styles.filaConteos}`}>
                      <span className={styles.conteo}><ListChecks size={14} />{datos.total}</span>
                      <span className={styles.conteo}><FileText size={14} />{datos.documentos}</span>
                    </div>
                    <div className={styles.colEstado}>
                      <span className={`${styles.estado} ${styles[`estado_${proyecto.estado}`] || ''}`}>
                        {NOMBRE_ESTADO[proyecto.estado] || proyecto.estado}
                      </span>
                    </div>
                    {botonEditar(proyecto)}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {modalAbierto && (
        <div className={shared.overlay} onClick={cerrarModal}>
          <div className={shared.modal} onClick={(e) => e.stopPropagation()}>
            <h2 className={shared.modalTitle}>
              {editandoId ? 'Editar proyecto' : 'Nuevo proyecto'}
            </h2>
            <form onSubmit={handleSubmit} className={shared.form}>
              <div className={shared.field}>
                <label>Nombre</label>
                <input
                  type="text"
                  value={form.nombre}
                  onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                  required
                  autoFocus
                />
              </div>
              <div className={shared.field}>
                <label>Descripcion</label>
                <textarea
                  value={form.descripcion}
                  onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
                  rows={3}
                />
              </div>
              <div className={shared.field}>
                <label>Cliente</label>
                <select
                  value={form.cliente_id}
                  onChange={(e) => setForm({ ...form, cliente_id: e.target.value })}
                >
                  <option value="">Sin cliente</option>
                  {clientes.map((cliente) => (
                    <option key={cliente.id} value={cliente.id}>
                      {cliente.nombre}
                    </option>
                  ))}
                </select>
              </div>
              <div className={shared.field}>
                <label>Estado</label>
                <select
                  value={form.estado}
                  onChange={(e) => setForm({ ...form, estado: e.target.value })}
                >
                  {ESTADOS.map((estado) => (
                    <option key={estado} value={estado}>
                      {estado}
                    </option>
                  ))}
                </select>
              </div>
              <div className={shared.field}>
                <label>Fecha de vencimiento</label>
                <input
                  type="date"
                  value={form.fecha_vencimiento}
                  onChange={(e) => setForm({ ...form, fecha_vencimiento: e.target.value })}
                />
              </div>
              <div className={shared.modalActions}>
                <button type="button" className={shared.btnSecondary} onClick={cerrarModal}>
                  Cancelar
                </button>
                <button type="submit" className={shared.btnPrimary} disabled={guardando}>
                  {guardando ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </PageContainer>
  );
};

export default Proyectos;
