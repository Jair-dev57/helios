import { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  ArrowUpRight, Info, Plus, Pencil, Power, PowerOff, Mail, Phone, MessageCircle, Copy,
} from 'lucide-react';
import { listarClientes, crearCliente, actualizarCliente, toggleActivoCliente } from '../../api/clientes';
import { listarProyectos } from '../../api/proyectos';
import { listarTareas } from '../../api/tareas';
import { listarDocumentos } from '../../api/documentos';
import Explorador from '../../components/Explorador';
import IconoProyecto from '../Proyectos/IconoProyecto';
import LogoCliente from './LogoCliente';
import { entregaProyecto, saludProyecto, mesAnio } from '../Proyectos/formato';
import { useVistaGuardada } from '../../hooks/useVistaGuardada';
import shared from '../../styles/shared.module.css';
import styles from './Clientes.module.css';

const FORM_VACIO = { nombre: '', email: '', telefono: '', empresa: '' };
const enCurso = (p) => p.estado === 'activo' || p.estado === 'pausado';
// Enlace de WhatsApp: sin "+" se asume un numero de Colombia (57)
const enlaceWhatsApp = (telefono) => {
  const digitos = (telefono || '').replace(/\D/g, '');
  if (!digitos) return null;
  const completo = telefono.trim().startsWith('+') || digitos.length > 10 ? digitos : `57${digitos}`;
  return `https://wa.me/${completo}`;
};

/**
 * Clientes como un explorador: la lista de clientes; abrir uno muestra sus proyectos como una carpeta
 * (/proyectos/clientes/:id). El panel de informacion es la ficha del cliente.
 */
const Clientes = () => {
  const navigate = useNavigate();
  const [clientes, setClientes] = useState([]);
  const [proyectos, setProyectos] = useState([]);
  const [tareas, setTareas] = useState([]);
  const [documentos, setDocumentos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [busqueda, setBusqueda] = useState('');
  const [filtro, setFiltro] = useState('activos');
  const [orden, setOrden] = useState({ col: 'nombre', dir: 1 });
  const [seleccion, setSeleccion] = useState(null);
  const [vista, cambiarVista] = useVistaGuardada('clientes.vista', ['iconos', 'lista'], 'lista');
  const [panel, cambiarPanel] = useVistaGuardada('clientes.info', ['si', 'no'], 'si');

  const [modalAbierto, setModalAbierto] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [form, setForm] = useState(FORM_VACIO);
  const [guardando, setGuardando] = useState(false);

  const cargarDatos = async () => {
    setLoading(true);
    try {
      const [dataClientes, dataProyectos] = await Promise.all([listarClientes(), listarProyectos()]);
      setClientes(dataClientes);
      setProyectos(dataProyectos);
      setError(null);
    } catch {
      setError('No se pudieron cargar los clientes');
    } finally {
      setLoading(false);
    }
    // Avance y totales: si fallan, la ficha se muestra sin ellos
    const [dataTareas, dataDocumentos] = await Promise.allSettled([listarTareas(), listarDocumentos()]);
    if (dataTareas.status === 'fulfilled') setTareas(dataTareas.value);
    if (dataDocumentos.status === 'fulfilled') setDocumentos(dataDocumentos.value);
  };

  useEffect(() => {
    cargarDatos();
  }, []);

  useEffect(() => { setSeleccion(null); }, [filtro]);

  // Datos calculados por cliente
  const info = useMemo(() => {
    const mapa = new Map();
    clientes.forEach((c) => {
      const proyectosC = proyectos
        .filter((p) => p.cliente_id === c.id)
        .map((p) => {
          const tareasP = tareas.filter((t) => t.proyecto_id === p.id);
          const hechas = tareasP.filter((t) => t.terminada).length;
          const progreso = tareasP.length ? Math.round((hechas / tareasP.length) * 100) : 0;
          return { ...p, progreso, abiertas: tareasP.length - hechas, salud: saludProyecto(p, progreso) };
        })
        // Primero los que siguen en curso
        .sort((a, b) => (enCurso(a) ? 0 : 1) - (enCurso(b) ? 0 : 1));
      const siguiente = proyectosC
        .filter((p) => p.fecha_vencimiento && enCurso(p))
        .sort((a, b) => a.fecha_vencimiento.localeCompare(b.fecha_vencimiento))[0];
      const ids = new Set(proyectosC.map((p) => p.id));
      mapa.set(c.id, {
        proyectos: proyectosC,
        enCurso: proyectosC.filter(enCurso).length,
        abiertas: proyectosC.reduce((n, p) => n + p.abiertas, 0),
        documentos: documentos.filter((d) => ids.has(d.proyecto_id)).length,
        siguiente,
        entrega: siguiente ? entregaProyecto(siguiente) : null,
      });
    });
    return mapa;
  }, [clientes, proyectos, tareas, documentos]);

  const columnas = useMemo(() => {
    const d = (c) => info.get(c.id);
    return [
      { clave: 'nombre', titulo: 'Nombre', ordenable: true, valor: (c) => c.nombre.toLowerCase() },
      {
        clave: 'contacto',
        titulo: 'Contacto',
        ordenable: true,
        valor: (c) => c.email || '',
        celda: (c) => <>{c.email || '—'}{c.telefono && <small>{c.telefono}</small>}</>,
      },
      {
        clave: 'proyectos',
        titulo: 'Proyectos',
        ordenable: true,
        valor: (c) => d(c).enCurso,
        celda: (c) => <>{d(c).enCurso} en curso<small>{d(c).proyectos.length} en total</small></>,
      },
      {
        clave: 'entrega',
        titulo: 'Próxima entrega',
        ordenable: true,
        valor: (c) => d(c).siguiente?.fecha_vencimiento || '9999',
        celda: (c) => (d(c).siguiente
          ? <><span className={styles[`entrega_${d(c).entrega.tipo}`]}>{d(c).entrega.texto}</span><small>{d(c).siguiente.nombre}</small></>
          : '—'),
      },
      { clave: 'desde', titulo: 'Cliente desde', ordenable: true, valor: (c) => c.created_at || '', celda: (c) => mesAnio(c.created_at) || '—' },
    ];
  }, [info]);

  const elementos = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    const col = columnas.find((c) => c.clave === orden.col) || columnas[0];
    return clientes
      .filter((c) => c.activo === (filtro === 'activos'))
      .filter((c) => !texto || `${c.nombre} ${c.empresa || ''} ${c.email || ''}`.toLowerCase().includes(texto))
      .sort((a, b) => {
        const x = col.valor(a);
        const y = col.valor(b);
        return (x > y ? 1 : x < y ? -1 : 0) * orden.dir;
      });
  }, [clientes, filtro, busqueda, columnas, orden]);

  /* ---------- Acciones ---------- */
  const abrir = (c) => navigate(`/proyectos/clientes/${c.id}`);
  const nuevoProyecto = (c) => navigate(`/proyectos?nuevo=1&cliente=${c.id}`);

  const copiar = async (texto) => {
    try {
      await navigator.clipboard.writeText(texto);
      toast.success('Copiado');
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
    } catch {
      toast.error('No se pudo guardar el cliente');
    } finally {
      setGuardando(false);
    }
  };

  const alternarActivo = async (cliente) => {
    try {
      await toggleActivoCliente(cliente.id);
      setSeleccion(null);
      cargarDatos();
      toast.success(cliente.activo ? 'Cliente desactivado' : 'Cliente activado');
    } catch {
      toast.error('No se pudo actualizar el cliente');
    }
  };

  /* ---------- Piezas del explorador ---------- */
  const menu = (c) => [
    { texto: 'Abrir', Icono: ArrowUpRight, accion: () => abrir(c), atajo: 'Enter' },
    { texto: 'Obtener información', Icono: Info, accion: () => { setSeleccion(c.id); cambiarPanel('si'); }, atajo: 'Ctrl+I' },
    null,
    { texto: 'Nuevo proyecto para este cliente', Icono: Plus, accion: () => nuevoProyecto(c) },
    { texto: 'Editar…', Icono: Pencil, accion: () => abrirModalEditar(c) },
    null,
    c.activo
      ? { texto: 'Desactivar', Icono: PowerOff, accion: () => alternarActivo(c) }
      : { texto: 'Activar', Icono: Power, accion: () => alternarActivo(c) },
  ];

  const panelInfo = (c) => {
    const d = info.get(c.id);
    const whatsapp = enlaceWhatsApp(c.telefono);
    return (
      <>
        <div className={styles.cabecera}>
          <LogoCliente cliente={c} size={72} />
          <h2>{c.nombre}</h2>
          <span className={styles.subtitulo}>{c.empresa || 'Sin empresa'}</span>
          <b className={c.activo ? styles.activo : styles.inactivo}><i />{c.activo ? 'Activo' : 'Inactivo'}</b>
        </div>

        <section className={styles.seccion}>
          <h3>Contacto</h3>
          <dl className={styles.datos}>
            <dt>Correo</dt>
            <dd>{c.email ? <button type="button" className={styles.copiable} onClick={() => copiar(c.email)} title="Copiar">{c.email}<Copy size={11} /></button> : '—'}</dd>
            <dt>Teléfono</dt>
            <dd>{c.telefono ? <button type="button" className={styles.copiable} onClick={() => copiar(c.telefono)} title="Copiar">{c.telefono}<Copy size={11} /></button> : '—'}</dd>
            <dt>Cliente desde</dt><dd>{mesAnio(c.created_at) || '—'}</dd>
          </dl>
          {(c.email || c.telefono) && (
            <div className={styles.contactar}>
              {c.email && <a href={`mailto:${c.email}`}><Mail size={13} />Correo</a>}
              {c.telefono && <a href={`tel:${c.telefono.replace(/\s/g, '')}`}><Phone size={13} />Llamar</a>}
              {whatsapp && <a href={whatsapp} target="_blank" rel="noopener noreferrer"><MessageCircle size={13} />WhatsApp</a>}
            </div>
          )}
        </section>

        <section className={styles.seccion}>
          <h3>Proyectos ({d.proyectos.length}) · {d.abiertas} {d.abiertas === 1 ? 'tarea abierta' : 'tareas abiertas'} · {d.documentos} archivos</h3>
          {d.proyectos.length === 0 ? <p className={styles.nada}>Aún no tiene proyectos.</p> : (
            <ul className={styles.proyectos}>
              {d.proyectos.slice(0, 6).map((p) => {
                const entrega = entregaProyecto(p);
                return (
                  <li key={p.id}>
                    <Link to={`/proyectos/${p.id}`}>
                      <IconoProyecto proyecto={p} salud={p.salud} apagado={!enCurso(p)} size={18} />
                      <span className={styles.nombreProyecto}>{p.nombre}</span>
                      <small className={styles[`entrega_${entrega.tipo}`]}>{entrega.texto}</small>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
          {d.proyectos.length > 6 && <button type="button" className={styles.verTodos} onClick={() => abrir(c)}>Ver los {d.proyectos.length}</button>}
        </section>

        <div className={styles.botones}>
          <button type="button" className={styles.primario} onClick={() => abrir(c)}><ArrowUpRight size={14} /> Abrir</button>
          <button type="button" onClick={() => nuevoProyecto(c)}><Plus size={14} /> Proyecto</button>
          <button type="button" onClick={() => abrirModalEditar(c)}><Pencil size={14} /> Editar</button>
        </div>
      </>
    );
  };

  const subbarra = (
    <div className={styles.segmento} role="group" aria-label="Clientes">
      {[['activos', 'Activos', true], ['inactivos', 'Inactivos', false]].map(([valor, texto, activo]) => (
        <button key={valor} type="button" aria-pressed={filtro === valor} onClick={() => setFiltro(valor)}>
          {texto} <b>{clientes.filter((c) => c.activo === activo).length}</b>
        </button>
      ))}
    </div>
  );

  const [vacioTitulo, vacioTexto] = busqueda
    ? ['Sin resultados', `Nada coincide con «${busqueda}».`]
    : filtro === 'activos'
      ? ['Aún no hay clientes', 'Crea el primero con «Nuevo».']
      : ['No hay clientes inactivos', ''];

  return (
    <>
      {error && <div className={shared.errorBanner}>{error}</div>}

      <Explorador
        titulo="Clientes"
        elementos={elementos}
        columnas={columnas}
        icono={(c, size) => <LogoCliente cliente={c} size={size} />}
        subtitulo={(c) => c.empresa || 'Sin empresa'}
        detalle={(c) => `${info.get(c.id).enCurso} en curso`}
        orden={orden}
        onOrdenar={(col) => setOrden((o) => ({ col, dir: o.col === col ? -o.dir : 1 }))}
        vista={vista}
        onVista={cambiarVista}
        conInfo={panel === 'si'}
        onInfo={(v) => cambiarPanel(v ? 'si' : 'no')}
        seleccion={seleccion}
        onSeleccion={setSeleccion}
        onAbrir={abrir}
        menu={menu}
        panel={panelInfo}
        subbarra={subbarra}
        vacio={<><b>{vacioTitulo}</b>{vacioTexto}</>}
        busqueda={busqueda}
        onBusqueda={setBusqueda}
        onNuevo={abrirModalCrear}
        estado={`${elementos.length} ${elementos.length === 1 ? 'cliente' : 'clientes'}`}
        cargando={loading}
      />

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
    </>
  );
};

export default Clientes;
