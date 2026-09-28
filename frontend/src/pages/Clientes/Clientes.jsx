import { useState, useEffect, useMemo, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  Plus, Pencil, Power, PowerOff, Search, LayoutGrid, List, Mail, Phone, Copy, Calendar, X,
  Building2, UserCheck, FolderOpen, ChartColumn, Sparkles, MessageCircle,
} from 'lucide-react';
import {
  listarClientes,
  crearCliente,
  actualizarCliente,
  toggleActivoCliente,
} from '../../api/clientes';
import { listarProyectos } from '../../api/proyectos';
import { listarTareas } from '../../api/tareas';
import { listarDocumentos } from '../../api/documentos';
import PageContainer from '../../components/PageContainer';
import {
  iniciales, colorCliente, colorAvance, entregaProyecto, diasHasta,
} from '../Proyectos/formato';
import shared from '../../styles/shared.module.css';
import styles from './Clientes.module.css';

const FORM_VACIO = { nombre: '', email: '', telefono: '', empresa: '' };
const PESTANAS = [
  ['todos', 'Todos'],
  ['activo', 'Activos'],
  ['inactivo', 'Inactivos'],
];
const ORDENES = {
  nombre: 'Nombre',
  proyectos: 'Más proyectos',
  entrega: 'Próxima entrega',
  recientes: 'Más recientes',
};
const NOMBRE_ESTADO = { activo: 'Activo', pausado: 'Pausado', completado: 'Completado', cancelado: 'Cancelado' };
const COLOR_ESTADO = {
  activo: 'var(--success)',
  pausado: 'var(--warning)',
  completado: 'var(--info)',
  cancelado: 'var(--text-muted)',
};
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const CLAVE_VISTA = 'clientes.vista';

const leerVista = () => {
  try {
    return localStorage.getItem(CLAVE_VISTA) === 'lista' ? 'lista' : 'tarjetas';
  } catch {
    return 'tarjetas';
  }
};

const clienteDesde = (fechaIso) => {
  if (!fechaIso) return null;
  const fecha = new Date(fechaIso);
  return `${MESES[fecha.getMonth()]} ${fecha.getFullYear()}`;
};

// Enlace de WhatsApp: sin "+" se asume un numero de Colombia (57)
const enlaceWhatsApp = (telefono) => {
  const digitos = (telefono || '').replace(/\D/g, '');
  if (!digitos) return null;
  const completo = telefono.trim().startsWith('+') || digitos.length > 10 ? digitos : `57${digitos}`;
  return `https://wa.me/${completo}`;
};

const Clientes = () => {
  const navigate = useNavigate();
  const [clientes, setClientes] = useState([]);
  const [proyectos, setProyectos] = useState([]);
  const [tareas, setTareas] = useState([]);
  const [documentos, setDocumentos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [busqueda, setBusqueda] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('todos');
  const [orden, setOrden] = useState('nombre');
  const [vista, setVista] = useState(leerVista);
  const [fichaId, setFichaId] = useState(null);
  const ultimoFoco = useRef(null);
  const cerrarRef = useRef(null);

  const [modalAbierto, setModalAbierto] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [form, setForm] = useState(FORM_VACIO);
  const [guardando, setGuardando] = useState(false);

  const cargarDatos = async () => {
    setLoading(true);
    try {
      const [dataClientes, dataProyectos] = await Promise.all([
        listarClientes(),
        listarProyectos(),
      ]);
      setClientes(dataClientes);
      setProyectos(dataProyectos);
      setError(null);
    } catch (err) {
      setError('No se pudieron cargar los clientes');
    } finally {
      setLoading(false);
    }
    // Avance y totales: si fallan, las tarjetas se muestran sin ellos
    const [dataTareas, dataDocumentos] = await Promise.allSettled([listarTareas(), listarDocumentos()]);
    if (dataTareas.status === 'fulfilled') setTareas(dataTareas.value);
    if (dataDocumentos.status === 'fulfilled') setDocumentos(dataDocumentos.value);
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

  // Datos calculados por cliente
  const info = useMemo(() => {
    const mapa = new Map();
    clientes.forEach((c) => {
      const proyectosC = proyectos
        .filter((p) => p.cliente_id === c.id)
        .map((p) => {
          const tareasP = tareas.filter((t) => t.proyecto_id === p.id);
          const hechas = tareasP.filter((t) => t.terminada).length;
          return {
            ...p,
            progreso: tareasP.length ? Math.round((hechas / tareasP.length) * 100) : 0,
            abiertas: tareasP.length - hechas,
          };
        })
        // Primero los que siguen en curso
        .sort((a, b) => (a.estado === 'activo' ? 0 : 1) - (b.estado === 'activo' ? 0 : 1));
      // Proxima entrega entre los proyectos que no estan cerrados
      const siguiente = proyectosC
        .filter((p) => p.fecha_vencimiento && (p.estado === 'activo' || p.estado === 'pausado'))
        .sort((a, b) => a.fecha_vencimiento.localeCompare(b.fecha_vencimiento))[0];
      const ids = new Set(proyectosC.map((p) => p.id));
      mapa.set(c.id, {
        proyectos: proyectosC,
        activos: proyectosC.filter((p) => p.estado === 'activo').length,
        abiertas: proyectosC.reduce((n, p) => n + p.abiertas, 0),
        documentos: documentos.filter((d) => ids.has(d.proyecto_id)).length,
        siguiente,
        entrega: siguiente ? entregaProyecto(siguiente) : { texto: 'Sin entregas', tipo: 'sin' },
      });
    });
    return mapa;
  }, [clientes, proyectos, tareas, documentos]);

  const metricas = useMemo(() => {
    const hoy = new Date();
    const activos = clientes.filter((c) => c.activo);
    return {
      activos: activos.length,
      enCurso: activos.filter((c) => info.get(c.id)?.activos > 0).length,
      proyectosActivos: proyectos.filter((p) => p.cliente_id && p.estado === 'activo').length,
      nuevos: clientes.filter((c) => {
        if (!c.created_at) return false;
        const f = new Date(c.created_at);
        return f.getFullYear() === hoy.getFullYear() && f.getMonth() === hoy.getMonth();
      }).length,
    };
  }, [clientes, proyectos, info]);

  const conteoEstado = (estado) => {
    if (estado === 'todos') return clientes.length;
    return clientes.filter((c) => c.activo === (estado === 'activo')).length;
  };

  const visibles = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    const comparar = {
      nombre: (a, b) => a.nombre.localeCompare(b.nombre, 'es'),
      proyectos: (a, b) => info.get(b.id).proyectos.length - info.get(a.id).proyectos.length,
      entrega: (a, b) => {
        const fa = info.get(a.id).siguiente?.fecha_vencimiento;
        const fb = info.get(b.id).siguiente?.fecha_vencimiento;
        return (fa ? 0 : 1) - (fb ? 0 : 1) || (fa || '').localeCompare(fb || '');
      },
      recientes: (a, b) => (b.created_at || '').localeCompare(a.created_at || ''),
    }[orden];
    return clientes
      .filter((c) => filtroEstado === 'todos' || c.activo === (filtroEstado === 'activo'))
      .filter((c) => !texto || `${c.nombre} ${c.empresa || ''} ${c.email || ''}`.toLowerCase().includes(texto))
      // Inactivos siempre al final
      .sort((a, b) => (a.activo ? 0 : 1) - (b.activo ? 0 : 1) || comparar(a, b));
  }, [clientes, filtroEstado, busqueda, orden, info]);

  const limpiarFiltros = () => {
    setBusqueda('');
    setFiltroEstado('todos');
  };

  const abrirFicha = (id) => {
    ultimoFoco.current = document.activeElement;
    setFichaId(id);
  };

  const cerrarFicha = () => {
    setFichaId(null);
    ultimoFoco.current?.focus?.();
  };

  // La ficha se cierra con Escape y bloquea el scroll de la pagina mientras esta abierta
  useEffect(() => {
    if (!fichaId) return undefined;
    cerrarRef.current?.focus();
    const alTeclear = (e) => {
      if (e.key === 'Escape') cerrarFicha();
    };
    document.addEventListener('keydown', alTeclear);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', alTeclear);
      document.body.style.overflow = overflow;
    };
  }, [fichaId]);

  const copiarEmail = async (email) => {
    try {
      await navigator.clipboard.writeText(email);
      toast.success('Email copiado');
    } catch {
      toast.error('No se pudo copiar');
    }
  };

  const abrirModalCrear = () => {
    setEditandoId(null);
    setForm(FORM_VACIO);
    setModalAbierto(true);
  };

  const abrirModalEditar = (cliente) => {
    setEditandoId(cliente.id);
    setForm({
      nombre: cliente.nombre || '',
      email: cliente.email || '',
      telefono: cliente.telefono || '',
      empresa: cliente.empresa || '',
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
      if (editandoId) {
        await actualizarCliente(editandoId, form);
        toast.success('Cliente actualizado');
      } else {
        await crearCliente(form);
        toast.success('Cliente creado');
      }
      cerrarModal();
      cargarDatos();
    } catch (err) {
      toast.error('No se pudo guardar el cliente');
    } finally {
      setGuardando(false);
    }
  };

  const handleToggleActivo = async (cliente) => {
    try {
      await toggleActivoCliente(cliente.id);
      cargarDatos();
      toast.success(cliente.activo ? 'Cliente desactivado' : 'Cliente activado');
    } catch (err) {
      toast.error('No se pudo actualizar el cliente');
    }
  };

  const logo = (cliente, tamano = '') => {
    const color = colorCliente(cliente.id);
    return (
      <span className={`${styles.logo} ${tamano}`} style={{ background: `${color}24`, color }} aria-hidden="true">
        {iniciales(cliente.nombre)}
      </span>
    );
  };

  const chipEstado = (cliente) => (
    <span className={`${styles.estado} ${cliente.activo ? styles.estadoActivo : ''}`}>
      {cliente.activo ? 'Activo' : 'Inactivo'}
    </span>
  );

  const chipEntrega = (entrega) => (
    <span className={`${styles.entrega} ${styles[`entrega_${entrega.tipo}`] || ''}`}>
      <Calendar size={13} />
      {entrega.texto}
    </span>
  );

  const contacto = (cliente) => {
    const whatsapp = enlaceWhatsApp(cliente.telefono);
    return (
      <div className={styles.contacto}>
        {cliente.email ? (
          <a className={styles.contactoBtn} href={`mailto:${cliente.email}`} title={cliente.email}>
            <Mail size={14} />Correo
          </a>
        ) : (
          <span className={`${styles.contactoBtn} ${styles.contactoOff}`} title="Sin email"><Mail size={14} />Correo</span>
        )}
        {cliente.telefono ? (
          <a className={styles.contactoBtn} href={`tel:${cliente.telefono.replace(/\s/g, '')}`} title={cliente.telefono}>
            <Phone size={14} />Llamar
          </a>
        ) : (
          <span className={`${styles.contactoBtn} ${styles.contactoOff}`} title="Sin teléfono"><Phone size={14} />Llamar</span>
        )}
        {whatsapp ? (
          <a
            className={`${styles.contactoBtn} ${styles.whatsapp}`}
            href={whatsapp}
            target="_blank"
            rel="noopener noreferrer"
            title="Abrir WhatsApp"
          >
            <MessageCircle size={14} />WhatsApp
          </a>
        ) : (
          <span className={`${styles.contactoBtn} ${styles.contactoOff}`} title="Sin teléfono"><MessageCircle size={14} />WhatsApp</span>
        )}
        {cliente.email && (
          <button
            type="button"
            className={styles.contactoBtn}
            onClick={() => copiarEmail(cliente.email)}
            title="Copiar email"
            aria-label={`Copiar email de ${cliente.nombre}`}
          >
            <Copy size={14} />
          </button>
        )}
      </div>
    );
  };

  const acciones = (cliente) => (
    <div className={styles.acciones}>
      <button
        type="button"
        className={styles.accion}
        onClick={() => abrirModalEditar(cliente)}
        title="Editar"
        aria-label={`Editar ${cliente.nombre}`}
      >
        <Pencil size={15} />
      </button>
      <button
        type="button"
        className={`${styles.accion} ${cliente.activo ? styles.accionPeligro : ''}`}
        onClick={() => handleToggleActivo(cliente)}
        title={cliente.activo ? 'Desactivar' : 'Activar'}
        aria-label={`${cliente.activo ? 'Desactivar' : 'Activar'} ${cliente.nombre}`}
      >
        {cliente.activo ? <PowerOff size={15} /> : <Power size={15} />}
      </button>
    </div>
  );

  const barraMini = (progreso) => (
    <span className={styles.mini} aria-hidden="true">
      <i style={{ width: `${progreso}%`, background: colorAvance(progreso) }} />
    </span>
  );

  const clienteFicha = clientes.find((c) => c.id === fichaId);
  const datosFicha = clienteFicha ? info.get(clienteFicha.id) : null;

  return (
    <PageContainer wide>
      <div className={styles.header}>
        <h1 className={styles.title}>Clientes</h1>
        <button className={shared.btnPrimary} onClick={abrirModalCrear}>
          <Plus size={16} style={{ marginRight: 6, verticalAlign: -3 }} />
          Nuevo cliente
        </button>
      </div>

      {error && <div className={shared.errorBanner}>{error}</div>}

      {loading ? (
        <p className={shared.loadingText}>Cargando...</p>
      ) : clientes.length === 0 ? (
        <div className={styles.vacio}>
          <b>Aún no hay clientes</b>
          Registra el primero para asociarle proyectos.
          <button className={shared.btnPrimary} onClick={abrirModalCrear}>
            <Plus size={16} style={{ marginRight: 6, verticalAlign: -3 }} />
            Nuevo cliente
          </button>
        </div>
      ) : (
        <>
          <section className={styles.metricas}>
            <div className={styles.metrica}>
              <span className={`${styles.metricaIcono} ${styles.iconoVerde}`}><UserCheck size={19} /></span>
              <div><b>{metricas.activos}</b><small>Clientes activos</small></div>
            </div>
            <div className={styles.metrica}>
              <span className={`${styles.metricaIcono} ${styles.iconoAccent}`}><FolderOpen size={19} /></span>
              <div><b>{metricas.enCurso}</b><small>Con proyectos en curso</small></div>
            </div>
            <div className={styles.metrica}>
              <span className={`${styles.metricaIcono} ${styles.iconoInfo}`}><ChartColumn size={19} /></span>
              <div><b>{metricas.proyectosActivos}</b><small>Proyectos activos</small></div>
            </div>
            <div className={styles.metrica}>
              <span className={`${styles.metricaIcono} ${styles.iconoAmbar}`}><Sparkles size={19} /></span>
              <div><b>{metricas.nuevos}</b><small>Nuevos este mes</small></div>
            </div>
          </section>

          <div className={styles.herramientas}>
            <label className={styles.buscar}>
              <Search size={16} />
              <input
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar nombre, empresa o email"
                aria-label="Buscar cliente"
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
              aria-label="Ordenar clientes"
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
              <b>No hay clientes que coincidan</b>
              Prueba con otro nombre o cambia el filtro.
              <button className={shared.btnSecondary} onClick={limpiarFiltros}>Limpiar filtros</button>
            </div>
          ) : vista === 'tarjetas' ? (
            <div className={styles.grid}>
              {visibles.map((cliente) => {
                const datos = info.get(cliente.id);
                const desde = clienteDesde(cliente.created_at);
                return (
                  <article key={cliente.id} className={`${styles.tarjeta} ${cliente.activo ? '' : styles.apagado}`}>
                    <button
                      type="button"
                      className={styles.abrirFicha}
                      onClick={() => abrirFicha(cliente.id)}
                      aria-label={`Ver ficha de ${cliente.nombre}`}
                    />
                    <div className={styles.tarjetaCab}>
                      {logo(cliente)}
                      <div className={styles.tarjetaTitulo}>
                        <b>{cliente.nombre}</b>
                        <small>{cliente.empresa || 'Sin empresa'}</small>
                      </div>
                      {chipEstado(cliente)}
                    </div>
                    {acciones(cliente)}
                    {contacto(cliente)}

                    <div className={styles.proyectos}>
                      {datos.proyectos.length === 0 ? (
                        <div className={styles.sinProyectos}>Aún no tiene proyectos</div>
                      ) : (
                        datos.proyectos.slice(0, 3).map((p) => (
                          <Link key={p.id} to={`/proyectos/${p.id}`} className={styles.proyecto}>
                            <i className={styles.punto} style={{ background: COLOR_ESTADO[p.estado] }} />
                            <span className={styles.proyectoNombre}>{p.nombre}</span>
                            {barraMini(p.progreso)}
                            <small>{p.progreso}%</small>
                          </Link>
                        ))
                      )}
                      {datos.proyectos.length > 3 && (
                        <button type="button" className={styles.masProyectos} onClick={() => abrirFicha(cliente.id)}>
                          +{datos.proyectos.length - 3} más
                        </button>
                      )}
                    </div>

                    <div className={styles.tarjetaPie}>
                      <span>
                        <b>{datos.proyectos.length}</b> {datos.proyectos.length === 1 ? 'proyecto' : 'proyectos'}
                        {' · '}<b>{datos.activos}</b> {datos.activos === 1 ? 'activo' : 'activos'}
                      </span>
                      {chipEntrega(datos.entrega)}
                      <span className={styles.espacio} />
                      {desde && <span className={styles.desde}>Desde {desde}</span>}
                    </div>
                  </article>
                );
              })}
              <button type="button" className={styles.nueva} onClick={abrirModalCrear}>
                <span><Plus size={20} /></span>
                Nuevo cliente
              </button>
            </div>
          ) : (
            <div className={styles.lista}>
              <div className={styles.listaCab}>
                <span>Cliente</span>
                <span className={styles.colContacto}>Contacto</span>
                <span>Proyectos</span>
                <span>Próxima entrega</span>
                <span className={styles.colEstado}>Estado</span>
                <span />
              </div>
              {visibles.map((cliente) => {
                const datos = info.get(cliente.id);
                return (
                  <div key={cliente.id} className={`${styles.fila} ${cliente.activo ? '' : styles.apagado}`}>
                    <button
                      type="button"
                      className={styles.abrirFicha}
                      onClick={() => abrirFicha(cliente.id)}
                      aria-label={`Ver ficha de ${cliente.nombre}`}
                    />
                    <div className={styles.filaNombre}>
                      {logo(cliente, styles.logoChico)}
                      <div>
                        <b>{cliente.nombre}</b>
                        <small>{cliente.empresa || 'Sin empresa'}</small>
                      </div>
                    </div>
                    <div className={`${styles.filaContacto} ${styles.colContacto}`}>
                      <span>{cliente.email || '—'}</span>
                      <span>{cliente.telefono || '—'}</span>
                    </div>
                    <div className={styles.filaProyectos}>
                      <span className={styles.barritas} aria-hidden="true">
                        {datos.proyectos.length === 0 ? (
                          <i style={{ background: 'var(--bg-surface-alt)' }} />
                        ) : (
                          datos.proyectos.slice(0, 5).map((p) => <i key={p.id} style={{ background: COLOR_ESTADO[p.estado] }} />)
                        )}
                      </span>
                      <small>{datos.proyectos.length} · {datos.activos} {datos.activos === 1 ? 'activo' : 'activos'}</small>
                    </div>
                    <div>{chipEntrega(datos.entrega)}</div>
                    <div className={styles.colEstado}>{chipEstado(cliente)}</div>
                    {acciones(cliente)}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ---------- Ficha lateral ---------- */}
      <div className={`${styles.capa} ${clienteFicha ? styles.capaAbierta : ''}`} aria-hidden={!clienteFicha}>
        <div className={styles.velo} onClick={cerrarFicha} />
        {clienteFicha && datosFicha && (
          <aside className={styles.ficha} role="dialog" aria-modal="true" aria-labelledby="ficha-cliente-nombre">
            <div className={styles.fichaCabeza}>
              <div className={styles.fichaTop}>
                {logo(clienteFicha, styles.logoGrande)}
                <div>
                  <b id="ficha-cliente-nombre">{clienteFicha.nombre}</b>
                  <small>
                    {clienteFicha.empresa || 'Sin empresa'}
                    {clienteDesde(clienteFicha.created_at) && ` · Cliente desde ${clienteDesde(clienteFicha.created_at)}`}
                  </small>
                </div>
                <button ref={cerrarRef} type="button" className={styles.cerrar} onClick={cerrarFicha} aria-label="Cerrar ficha">
                  <X size={16} />
                </button>
              </div>
              {contacto(clienteFicha)}
            </div>

            <div className={styles.fichaCuerpo}>
              <div className={styles.fichaTotales}>
                <div><b>{datosFicha.proyectos.length}</b><small>Proyectos</small></div>
                <div><b>{datosFicha.abiertas}</b><small>Tareas abiertas</small></div>
                <div><b>{datosFicha.documentos}</b><small>Documentos</small></div>
              </div>

              <dl className={styles.fichaDatos}>
                <dt><Mail size={14} />Email</dt><dd>{clienteFicha.email || '—'}</dd>
                <dt><Phone size={14} />Teléfono</dt><dd>{clienteFicha.telefono || '—'}</dd>
                <dt><Building2 size={14} />Empresa</dt><dd>{clienteFicha.empresa || '—'}</dd>
                <dt><Calendar size={14} />Estado</dt><dd>{chipEstado(clienteFicha)}</dd>
              </dl>

              <div>
                <h3 className={styles.fichaSeccion}>Proyectos</h3>
                {datosFicha.proyectos.length === 0 ? (
                  <div className={styles.sinProyectos}>Este cliente aún no tiene proyectos.</div>
                ) : (
                  <div className={styles.fichaProyectos}>
                    {datosFicha.proyectos.map((p) => {
                      const entrega = entregaProyecto(p);
                      return (
                        <Link key={p.id} to={`/proyectos/${p.id}`} className={styles.fichaProyecto}>
                          <div className={styles.fichaProyectoTop}>
                            <i className={styles.punto} style={{ background: COLOR_ESTADO[p.estado] }} />
                            <b>{p.nombre}</b>
                            <span className={styles.estadoProyecto} style={{ color: COLOR_ESTADO[p.estado] }}>
                              {NOMBRE_ESTADO[p.estado] || p.estado}
                            </span>
                          </div>
                          <div className={styles.fichaProyectoAvance}>
                            {barraMini(p.progreso)}
                            <span>{p.progreso}%</span>
                          </div>
                          <div className={styles.fichaProyectoPie}>
                            {chipEntrega(entrega)}
                            {p.abiertas > 0 && (
                              <span className={p.fecha_vencimiento && diasHasta(p.fecha_vencimiento) < 0 ? styles.rojo : ''}>
                                {p.abiertas} {p.abiertas === 1 ? 'tarea abierta' : 'tareas abiertas'}
                              </span>
                            )}
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className={styles.fichaPie}>
              <button
                type="button"
                className={shared.btnPrimary}
                onClick={() => navigate(`/proyectos?nuevo=1&cliente=${clienteFicha.id}`)}
              >
                <Plus size={16} style={{ marginRight: 6, verticalAlign: -3 }} />
                Nuevo proyecto para {clienteFicha.nombre.split(' ')[0]}
              </button>
            </div>
          </aside>
        )}
      </div>

      {modalAbierto && (
        <div className={shared.overlay} onClick={cerrarModal}>
          <div className={shared.modal} onClick={(e) => e.stopPropagation()}>
            <h2 className={shared.modalTitle}>
              {editandoId ? 'Editar cliente' : 'Nuevo cliente'}
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
                <label>Empresa</label>
                <input
                  type="text"
                  value={form.empresa}
                  onChange={(e) => setForm({ ...form, empresa: e.target.value })}
                />
              </div>
              <div className={shared.field}>
                <label>Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
              <div className={shared.field}>
                <label>Telefono</label>
                <input
                  type="text"
                  value={form.telefono}
                  onChange={(e) => setForm({ ...form, telefono: e.target.value })}
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

export default Clientes;
