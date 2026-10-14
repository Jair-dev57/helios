import { useState, useEffect, useMemo, useCallback } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowUpRight, Info, Star, Pencil, Archive, RotateCcw } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { listarProyectos, crearProyecto, actualizarProyecto } from '../../api/proyectos';
import { listarClientes, crearCliente } from '../../api/clientes';
import { listarEspacios, crearEspacio } from '../../api/espacios';
import {
  obtenerProyectosFavoritos, obtenerProyectosRecientes, marcarFavorito, EVENTO_FAVORITOS_PROYECTOS,
} from '../../api/favoritos';
import { listarTareas } from '../../api/tareas';
import { listarDocumentos } from '../../api/documentos';
import { listarUsuarios } from '../../api/usuarios';
import Avatar from '../../components/Avatar';
import Explorador from '../../components/Explorador';
import CrearEnLinea from './CrearEnLinea';
import IconoProyecto from './IconoProyecto';
import LogoCliente from '../Clientes/LogoCliente';
import {
  diasHasta, entregaProyecto, saludProyecto, SALUD, fechaRelativa, fechaCompleta, ESTADOS_PROYECTO, NOMBRE_ESTADO,
} from './formato';
import { useVistaGuardada } from '../../hooks/useVistaGuardada';
import shared from '../../styles/shared.module.css';
import styles from './Proyectos.module.css';

const archivado = (p) => p.estado === 'completado' || p.estado === 'cancelado';
const TITULOS = {
  todos: 'Todos los proyectos',
  recientes: 'Recientes',
  favoritos: 'Favoritos',
  compartidos: 'Compartidos',
  archivados: 'Archivados',
};
const VACIOS = {
  todos: ['Aún no hay proyectos', 'Crea el primero con «Nuevo».'],
  recientes: ['Aún no has abierto proyectos', 'Cada proyecto que abras aparecerá aquí, agrupado por día.'],
  favoritos: ['Sin favoritos', 'Marca un proyecto con la estrella o arrástralo a Favoritos en la barra lateral.'],
  conmigo: ['Nadie te ha sumado a un proyecto', 'Aparecen aquí los proyectos de otros donde tienes tareas asignadas.'],
  pormi: ['No has sumado a nadie a tus proyectos', 'Aparecen aquí tus proyectos donde otras personas tienen tareas.'],
  archivados: ['No hay proyectos archivados', 'Los proyectos completados o cancelados aparecerán aquí.'],
  cliente: ['Este cliente aún no tiene proyectos', 'Crea el primero con «Nuevo».'],
};
const FORM_VACIO = {
  nombre: '',
  descripcion: '',
  estado: 'activo',
  fecha_vencimiento: '',
  cliente_id: '',
  area_id: '',
};
const DIA_MS = 86400000;

// Recientes se agrupa por dia, como en el sistema
function grupoReciente(fechaIso) {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const dias = Math.floor((hoy - new Date(fechaIso).setHours(0, 0, 0, 0)) / DIA_MS);
  if (dias <= 0) return 'Hoy';
  if (dias === 1) return 'Ayer';
  if (dias < 7) return 'Esta semana';
  return 'Antes';
}

const Pila = ({ personas }) => (
  <span className={styles.pila}>
    {personas.slice(0, 3).map((u) => <span key={u.id} title={u.nombre}><Avatar usuario={u} size={20} /></span>)}
    {personas.length > 3 && <span className={styles.pilaMas}>+{personas.length - 3}</span>}
  </span>
);

const Avance = ({ valor, salud }) => (
  <span className={styles.avance}>
    <span className={styles.pista}><span style={{ width: `${valor}%`, background: SALUD[salud].color }} /></span>
    {valor}%
  </span>
);

/**
 * Proyectos como un explorador del sistema. coleccion: 'recientes' | 'favoritos' | 'compartidos' | 'archivados'
 * (los lugares de la barra lateral); sin coleccion, todos los que estan en curso.
 * clienteId: el cliente abierto como una carpeta (Clientes › nombre), con todos sus proyectos.
 */
const Proyectos = ({ coleccion = null, clienteId = null }) => {
  const lugar = clienteId ? 'cliente' : coleccion || 'todos';
  const { user, tieneSeccion, esAdministrador } = useAuth();
  const navigate = useNavigate();
  const [proyectos, setProyectos] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [tareas, setTareas] = useState([]);
  const [documentos, setDocumentos] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [areas, setAreas] = useState([]);
  const [favoritos, setFavoritos] = useState([]);
  const [recientes, setRecientes] = useState(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [busqueda, setBusqueda] = useState('');
  const [soloSalud, setSoloSalud] = useState(null);
  const [modoCompartidos, setModoCompartidos] = useState('conmigo');
  const [orden, setOrden] = useState({ col: 'nombre', dir: 1 });
  const [seleccion, setSeleccion] = useState(null);
  const [vista, cambiarVista] = useVistaGuardada('proyectos.vista', ['iconos', 'lista'], 'lista');
  const [panel, cambiarPanel] = useVistaGuardada('proyectos.info', ['si', 'no'], 'si');

  const [modalAbierto, setModalAbierto] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [form, setForm] = useState(FORM_VACIO);
  const [guardando, setGuardando] = useState(false);
  // Crear cliente o equipo desde el formulario del proyecto: 'cliente' | 'equipo' | null
  const [creandoEn, setCreandoEn] = useState(null);
  const [searchParams, setSearchParams] = useSearchParams();

  const cargarFavoritos = useCallback(() => {
    obtenerProyectosFavoritos().then(setFavoritos).catch(() => {});
  }, []);

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
    } catch {
      setError('No se pudieron cargar los proyectos');
    } finally {
      setLoading(false);
    }
    // Complementos: si fallan, el explorador se muestra sin ellos
    const [dataUsuarios, dataEspacios, dataRecientes] = await Promise.allSettled([
      listarUsuarios(),
      tieneSeccion('archivos') ? listarEspacios() : Promise.resolve({ equipo: [] }),
      obtenerProyectosRecientes(),
    ]);
    if (dataUsuarios.status === 'fulfilled') setUsuarios(dataUsuarios.value);
    if (dataEspacios.status === 'fulfilled') setAreas(dataEspacios.value.equipo);
    if (dataRecientes.status === 'fulfilled') setRecientes(new Map(dataRecientes.value.map((r) => [r.proyecto_id, r.visto_at])));
  };

  useEffect(() => {
    cargarDatos();
    cargarFavoritos();
    // La barra lateral tambien marca, quita y ordena favoritos
    window.addEventListener(EVENTO_FAVORITOS_PROYECTOS, cargarFavoritos);
    return () => window.removeEventListener(EVENTO_FAVORITOS_PROYECTOS, cargarFavoritos);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Desde la ficha de un cliente: /proyectos?nuevo=1&cliente=ID abre el formulario con ese cliente
  useEffect(() => {
    if (searchParams.get('nuevo') !== '1') return;
    setEditandoId(null);
    setForm({ ...FORM_VACIO, cliente_id: searchParams.get('cliente') || '' });
    setModalAbierto(true);
    setSearchParams({}, { replace: true });
  }, [searchParams, setSearchParams]);

  // Al cambiar de lugar no queda nada seleccionado ni filtrado
  useEffect(() => { setSeleccion(null); setSoloSalud(null); }, [lugar, modoCompartidos]);

  // Datos calculados por proyecto
  const info = useMemo(() => {
    const mapa = new Map();
    proyectos.forEach((p) => {
      const tareasP = tareas.filter((t) => t.proyecto_id === p.id);
      const hechas = tareasP.filter((t) => t.terminada).length;
      const progreso = tareasP.length ? Math.round((hechas / tareasP.length) * 100) : 0;
      const ids = [p.usuario_id, ...tareasP.map((t) => t.usuario_asignado_id)].filter(Boolean);
      const equipo = [...new Set(ids)].map((id) => usuarios.find((u) => u.id === id)).filter(Boolean);
      mapa.set(p.id, {
        total: tareasP.length,
        hechas,
        progreso,
        documentos: documentos.filter((d) => d.proyecto_id === p.id).length,
        equipo,
        responsable: usuarios.find((u) => u.id === p.usuario_id),
        cliente: clientes.find((c) => c.id === p.cliente_id),
        area: areas.find((a) => a.id === p.area_id),
        entrega: entregaProyecto(p),
        salud: saludProyecto(p, progreso),
        // Compartidos: tus tareas abiertas en proyectos de otros, y quienes tienen tareas en los tuyos
        misTareas: tareasP.filter((t) => t.usuario_asignado_id === user?.id && !t.terminada).length,
        tengoTareas: tareasP.some((t) => t.usuario_asignado_id === user?.id),
        otros: [...new Set(tareasP.map((t) => t.usuario_asignado_id).filter((id) => id && id !== user?.id))]
          .map((id) => usuarios.find((u) => u.id === id)).filter(Boolean),
      });
    });
    return mapa;
  }, [proyectos, tareas, documentos, usuarios, clientes, areas, user]);

  // Lo que se ve en cada lugar, antes de buscar y ordenar
  const delLugar = useMemo(() => {
    const vivos = proyectos.filter((p) => !archivado(p));
    if (lugar === 'recientes') return vivos.filter((p) => recientes.has(p.id));
    if (lugar === 'favoritos') return favoritos.map((id) => proyectos.find((p) => p.id === id)).filter(Boolean);
    if (lugar === 'archivados') return proyectos.filter(archivado);
    if (lugar === 'cliente') return proyectos.filter((p) => p.cliente_id === clienteId);
    if (lugar === 'compartidos') {
      return modoCompartidos === 'conmigo'
        ? vivos.filter((p) => p.usuario_id !== user?.id && info.get(p.id)?.tengoTareas)
        : vivos.filter((p) => p.usuario_id === user?.id && info.get(p.id)?.otros.length);
    }
    return vivos;
  }, [lugar, proyectos, recientes, favoritos, modoCompartidos, info, user, clienteId]);

  // Columnas de la lista segun el lugar (como el explorador cambia columnas en Recientes o Compartidos)
  const columnas = useMemo(() => {
    const d = (e) => info.get(e.id);
    const nombre = { clave: 'nombre', titulo: 'Nombre', ordenable: true, valor: (e) => e.nombre.toLowerCase() };
    const cliente = { clave: 'cliente', titulo: 'Cliente', ordenable: true, valor: (e) => d(e).cliente?.nombre || '', celda: (e) => d(e).cliente?.nombre || '—' };
    const avance = { clave: 'avance', titulo: 'Avance', ordenable: true, valor: (e) => d(e).progreso, celda: (e) => <Avance valor={d(e).progreso} salud={d(e).salud} /> };
    const entrega = {
      clave: 'entrega',
      titulo: 'Entrega',
      ordenable: true,
      valor: (e) => (e.fecha_vencimiento ? diasHasta(e.fecha_vencimiento) : Infinity),
      celda: (e) => <span className={styles[`entrega_${d(e).entrega.tipo}`]}>{d(e).entrega.texto}</span>,
    };
    const tareasCol = { clave: 'tareas', titulo: 'Tareas', ordenable: true, valor: (e) => d(e).total - d(e).hechas, celda: (e) => `${d(e).hechas}/${d(e).total}` };
    const equipo = { clave: 'equipo', titulo: 'Equipo', celda: (e) => <Pila personas={d(e).equipo} /> };
    const modificado = { clave: 'modificado', titulo: 'Modificado', ordenable: true, valor: (e) => e.updated_at || '', celda: (e) => <span title={fechaCompleta(e.updated_at)}>{fechaRelativa(e.updated_at)}</span> };
    const abierto = { clave: 'abierto', titulo: 'Abierto', celda: (e) => <span title={fechaCompleta(recientes.get(e.id))}>{fechaRelativa(recientes.get(e.id))}</span> };

    if (lugar === 'recientes') return [nombre, abierto, cliente, avance, entrega];
    if (lugar === 'compartidos' && modoCompartidos === 'conmigo') {
      return [
        nombre,
        { clave: 'responsable', titulo: 'De', ordenable: true, valor: (e) => d(e).responsable?.nombre || '', celda: (e) => d(e).responsable?.nombre || '—' },
        { clave: 'mias', titulo: 'Tus tareas', ordenable: true, valor: (e) => d(e).misTareas, celda: (e) => (d(e).misTareas ? `${d(e).misTareas} abiertas` : 'Al día') },
        entrega,
        avance,
      ];
    }
    if (lugar === 'compartidos') {
      return [nombre, { clave: 'con', titulo: 'Con', celda: (e) => <Pila personas={d(e).otros} /> }, entrega, avance];
    }
    if (lugar === 'archivados') {
      return [
        nombre,
        cliente,
        { clave: 'estado', titulo: 'Estado', ordenable: true, valor: (e) => e.estado, celda: (e) => NOMBRE_ESTADO[e.estado] },
        { ...modificado, titulo: 'Archivado' },
        { clave: 'restaurar', titulo: '', celda: (e) => <button type="button" className={styles.accion} onClick={(ev) => { ev.stopPropagation(); restaurar(e); }}>Restaurar</button> },
      ];
    }
    if (lugar === 'cliente') return [nombre, avance, entrega, tareasCol, equipo, modificado];
    return [nombre, cliente, avance, entrega, tareasCol, equipo, modificado];
  }, [lugar, modoCompartidos, info, recientes]); // eslint-disable-line react-hooks/exhaustive-deps

  // Buscar, filtrar por salud y ordenar (Recientes por fecha y Favoritos en su orden, como la barra lateral)
  const elementos = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    let lista = delLugar
      .filter((p) => !soloSalud || info.get(p.id)?.salud === soloSalud)
      .filter((p) => !texto || `${p.nombre} ${info.get(p.id)?.cliente?.nombre || ''}`.toLowerCase().includes(texto));
    if (lugar === 'recientes') return [...lista].sort((a, b) => recientes.get(b.id).localeCompare(recientes.get(a.id)));
    if (lugar === 'favoritos') return lista;
    const col = columnas.find((c) => c.clave === orden.col && c.ordenable) || columnas[0];
    lista = [...lista].sort((a, b) => {
      const x = col.valor(a);
      const y = col.valor(b);
      return (x > y ? 1 : x < y ? -1 : 0) * orden.dir;
    });
    return lista;
  }, [delLugar, soloSalud, busqueda, info, lugar, recientes, columnas, orden]);

  /* ---------- Acciones ---------- */
  const abrir = (p) => navigate(`/proyectos/${p.id}`);

  const alternarFavorito = async (p) => {
    const marcar = !favoritos.includes(p.id);
    setFavoritos((prev) => (marcar ? [...prev, p.id] : prev.filter((id) => id !== p.id)));
    try {
      await marcarFavorito({ proyecto_id: p.id }, marcar);
      toast.success(marcar ? 'Añadido a Favoritos' : 'Quitado de Favoritos');
    } catch {
      cargarFavoritos();
      toast.error('No se pudo cambiar el favorito.');
    }
  };

  const cambiarEstado = async (p, estado, mensaje) => {
    try {
      const actualizado = await actualizarProyecto(p.id, { estado });
      setProyectos((prev) => prev.map((x) => (x.id === p.id ? { ...x, ...actualizado } : x)));
      setSeleccion(null);
      toast.success(mensaje);
    } catch {
      toast.error('No se pudo cambiar el proyecto.');
    }
  };
  const archivar = (p) => cambiarEstado(p, 'completado', `«${p.nombre}» archivado como completado`);
  const restaurar = (p) => cambiarEstado(p, 'activo', `«${p.nombre}» restaurado`);

  const abrirModalCrear = () => {
    setEditandoId(null);
    setForm({ ...FORM_VACIO, cliente_id: clienteId || '' });
    setModalAbierto(true);
  };

  const abrirModalEditar = (proyecto) => {
    setEditandoId(proyecto.id);
    setForm({
      nombre: proyecto.nombre || '',
      descripcion: proyecto.descripcion || '',
      estado: proyecto.estado || 'activo',
      fecha_vencimiento: proyecto.fecha_vencimiento ? proyecto.fecha_vencimiento.slice(0, 10) : '',
      cliente_id: proyecto.cliente_id || '',
      area_id: proyecto.area_id || '',
    });
    setModalAbierto(true);
  };

  const cerrarModal = () => {
    setModalAbierto(false);
    setEditandoId(null);
    setForm(FORM_VACIO);
    setCreandoEn(null);
  };

  const crearClienteNuevo = async (nombre) => {
    try {
      const cliente = await crearCliente({ nombre });
      setClientes((prev) => [...prev, cliente]);
      setForm((prev) => ({ ...prev, cliente_id: cliente.id }));
      setCreandoEn(null);
      toast.success('Cliente creado');
    } catch (err) {
      toast.error('No se pudo crear el cliente');
      throw err;
    }
  };

  // Solo administradores; quien lo crea queda como miembro y lo completa luego en Archivos
  const crearEquipoNuevo = async (nombre) => {
    try {
      const equipo = await crearEspacio({ nombre, miembro_ids: user?.id ? [user.id] : [] });
      setAreas((prev) => [...prev, equipo]);
      setForm((prev) => ({ ...prev, area_id: equipo.id }));
      setCreandoEn(null);
      toast.success('Equipo creado');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'No se pudo crear el equipo');
      throw err;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setGuardando(true);
    try {
      const payload = {
        ...form,
        cliente_id: form.cliente_id ? Number(form.cliente_id) : null,
        area_id: form.area_id ? Number(form.area_id) : null,
        fecha_vencimiento: form.fecha_vencimiento ? `${form.fecha_vencimiento}T00:00:00Z` : null,
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
    } catch {
      toast.error('No se pudo guardar el proyecto');
    } finally {
      setGuardando(false);
    }
  };

  /* ---------- Piezas del explorador ---------- */
  const icono = (p, size) => (
    <IconoProyecto salud={info.get(p.id)?.salud} favorito={size > 30 && favoritos.includes(p.id)} apagado={archivado(p)} size={size} />
  );

  const marcas = (p) => (
    <>
      {favoritos.includes(p.id) && <Star size={11} className={styles.estrella} fill="currentColor" aria-label="Favorito" />}
      {p.estado === 'pausado' && <small className={styles.pausado}>Pausado</small>}
    </>
  );

  const detalle = (p) => {
    if (lugar === 'recientes') return fechaRelativa(recientes.get(p.id));
    const { entrega } = info.get(p.id);
    return <span className={styles[`entrega_${entrega.tipo}`]}>{entrega.texto}</span>;
  };

  const menu = (p) => {
    const fav = favoritos.includes(p.id);
    return [
      { texto: 'Abrir', Icono: ArrowUpRight, accion: () => abrir(p), atajo: 'Enter' },
      { texto: 'Obtener información', Icono: Info, accion: () => { setSeleccion(p.id); cambiarPanel('si'); }, atajo: 'Ctrl+I' },
      null,
      { texto: fav ? 'Quitar de Favoritos' : 'Añadir a Favoritos', Icono: Star, accion: () => alternarFavorito(p), atajo: 'Ctrl+D' },
      { texto: 'Editar…', Icono: Pencil, accion: () => abrirModalEditar(p) },
      null,
      archivado(p)
        ? { texto: 'Restaurar', Icono: RotateCcw, accion: () => restaurar(p) }
        : { texto: 'Archivar (completado)', Icono: Archive, accion: () => archivar(p) },
    ];
  };

  const panelInfo = (p) => {
    const d = info.get(p.id);
    const fav = favoritos.includes(p.id);
    return (
      <>
        <div className={styles.infoCabecera}>
          <IconoProyecto salud={d.salud} apagado={archivado(p)} size={72} />
          <h2>{p.nombre}</h2>
          <span className={styles.subtitulo}>{[d.cliente?.nombre || 'Sin cliente', d.area?.nombre].filter(Boolean).join(' · ')}</span>
          <b className={styles.salud} style={{ color: SALUD[d.salud].color }}>
            <i style={{ background: SALUD[d.salud].color }} />
            {archivado(p) ? NOMBRE_ESTADO[p.estado] : p.estado === 'pausado' ? 'Pausado' : SALUD[d.salud].texto}
          </b>
        </div>
        <dl className={styles.datos}>
          <dt>Avance</dt><dd><Avance valor={d.progreso} salud={d.salud} /></dd>
          <dt>Entrega</dt><dd className={styles[`entrega_${d.entrega.tipo}`]}>{d.entrega.texto}</dd>
          <dt>Tareas</dt><dd>{d.hechas} de {d.total} hechas</dd>
          <dt>Archivos</dt><dd>{d.documentos}</dd>
          <dt>Equipo</dt><dd><Pila personas={d.equipo} /></dd>
          {d.responsable && <><dt>Responsable</dt><dd>{d.responsable.nombre}</dd></>}
          <dt>Modificado</dt><dd title={fechaCompleta(p.updated_at)}>{fechaRelativa(p.updated_at)}</dd>
          {recientes.has(p.id) && <><dt>Abierto</dt><dd>{fechaRelativa(recientes.get(p.id))}</dd></>}
        </dl>
        {p.descripcion && <p className={styles.descripcion}>{p.descripcion}</p>}
        <div className={styles.botones}>
          <button type="button" className={styles.primario} onClick={() => abrir(p)}><ArrowUpRight size={14} /> Abrir</button>
          <button type="button" onClick={() => alternarFavorito(p)}>
            <Star size={14} fill={fav ? 'currentColor' : 'none'} /> {fav ? 'Quitar' : 'Favorito'}
          </button>
          <button type="button" onClick={() => abrirModalEditar(p)}><Pencil size={14} /> Editar</button>
        </div>
      </>
    );
  };

  const clienteAbierto = clientes.find((c) => c.id === clienteId);

  // Modos de Compartidos, datos del cliente abierto y filtros de salud (se prenden y se apagan)
  const subbarra = (
    <>
      {clienteAbierto && (
        <span className={styles.clienteAbierto}>
          <LogoCliente cliente={clienteAbierto} size={22} />
          <span>
            <b>{clienteAbierto.empresa || clienteAbierto.nombre}</b>
            {[clienteAbierto.email, clienteAbierto.telefono].filter(Boolean).map((x) => ` · ${x}`)}
          </span>
        </span>
      )}
      {lugar === 'compartidos' && (
        <div className={styles.segmento} role="group" aria-label="Compartidos">
          <button type="button" aria-pressed={modoCompartidos === 'conmigo'} onClick={() => setModoCompartidos('conmigo')}>Conmigo</button>
          <button type="button" aria-pressed={modoCompartidos === 'pormi'} onClick={() => setModoCompartidos('pormi')}>Por mí</button>
        </div>
      )}
      {lugar === 'recientes' && <span>Los que abriste hace poco, el último primero.</span>}
      {lugar === 'favoritos' && <span>Arrástralos en la barra lateral para ordenarlos.</span>}
      {lugar === 'archivados' && <span>Completados o cancelados. «Restaurar» los vuelve a poner en curso.</span>}
      <span className={styles.espacio} />
      {lugar !== 'archivados' && ['vencido', 'pronto'].map((s) => (
        <button
          key={s}
          type="button"
          className={styles.chip}
          aria-pressed={soloSalud === s}
          onClick={() => setSoloSalud((x) => (x === s ? null : s))}
        >
          <i style={{ background: SALUD[s].color }} />
          {SALUD[s].texto}
          <b>{delLugar.filter((p) => info.get(p.id)?.salud === s).length}</b>
        </button>
      ))}
    </>
  );

  const claveVacio = lugar === 'compartidos' ? modoCompartidos : lugar;
  const [vacioTitulo, vacioTexto] = busqueda || soloSalud
    ? ['Sin resultados', 'Nada coincide con la búsqueda o el filtro.']
    : VACIOS[claveVacio];

  return (
    <>
      {error && <div className={shared.errorBanner}>{error}</div>}

      <Explorador
        titulo={lugar === 'cliente'
          ? <><Link to="/proyectos/clientes">Clientes</Link><span>›</span>{clienteAbierto?.nombre || '…'}</>
          : TITULOS[lugar]}
        elementos={elementos}
        columnas={columnas}
        grupo={lugar === 'recientes' ? (p) => grupoReciente(recientes.get(p.id)) : undefined}
        icono={icono}
        detalle={detalle}
        marcas={marcas}
        orden={lugar === 'recientes' || lugar === 'favoritos' ? null : orden}
        onOrdenar={(col) => setOrden((o) => ({ col, dir: o.col === col ? -o.dir : 1 }))}
        vista={vista}
        onVista={cambiarVista}
        conInfo={panel === 'si'}
        onInfo={(v) => cambiarPanel(v ? 'si' : 'no')}
        seleccion={seleccion}
        onSeleccion={setSeleccion}
        onAbrir={abrir}
        onFavorito={alternarFavorito}
        menu={menu}
        panel={panelInfo}
        subbarra={subbarra}
        vacio={<><b>{vacioTitulo}</b>{vacioTexto}</>}
        busqueda={busqueda}
        onBusqueda={setBusqueda}
        onNuevo={lugar === 'archivados' ? undefined : abrirModalCrear}
        estado={`${elementos.length} ${elementos.length === 1 ? 'proyecto' : 'proyectos'}`}
        cargando={loading}
      />

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
                {creandoEn === 'cliente' ? (
                  <CrearEnLinea
                    placeholder="Nombre del cliente"
                    onCrear={crearClienteNuevo}
                    onCancelar={() => setCreandoEn(null)}
                  />
                ) : (
                  <select
                    value={form.cliente_id}
                    onChange={(e) => {
                      if (e.target.value === 'nuevo') setCreandoEn('cliente');
                      else setForm({ ...form, cliente_id: e.target.value });
                    }}
                  >
                    <option value="">Sin cliente</option>
                    {clientes.map((cliente) => (
                      <option key={cliente.id} value={cliente.id}>
                        {cliente.nombre}
                      </option>
                    ))}
                    {tieneSeccion('clientes') && <option value="nuevo">+ Nuevo cliente…</option>}
                  </select>
                )}
              </div>
              {(areas.length > 0 || esAdministrador) && (
                <div className={shared.field}>
                  <label>Equipo</label>
                  {creandoEn === 'equipo' ? (
                    <CrearEnLinea
                      placeholder="Nombre del equipo"
                      onCrear={crearEquipoNuevo}
                      onCancelar={() => setCreandoEn(null)}
                    />
                  ) : (
                    <select
                      value={form.area_id}
                      onChange={(e) => {
                        if (e.target.value === 'nuevo') setCreandoEn('equipo');
                        else setForm({ ...form, area_id: e.target.value });
                      }}
                    >
                      <option value="">Sin equipo</option>
                      {areas.map((a) => (
                        <option key={a.id} value={a.id}>{a.nombre}</option>
                      ))}
                      {esAdministrador && <option value="nuevo">+ Nuevo equipo…</option>}
                    </select>
                  )}
                </div>
              )}
              <div className={shared.field}>
                <label>Estado</label>
                <select
                  value={form.estado}
                  onChange={(e) => setForm({ ...form, estado: e.target.value })}
                >
                  {ESTADOS_PROYECTO.map((estado) => (
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
    </>
  );
};

export default Proyectos;
