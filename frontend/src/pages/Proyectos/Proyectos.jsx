import { useState, useEffect, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  Plus, Pencil, ListChecks, FileText, Calendar, Search, LayoutGrid, List, CircleAlert, X, Star,
  FolderOpen, CalendarClock, TriangleAlert, ChartColumn,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import {
  listarProyectos,
  crearProyecto,
  actualizarProyecto,
} from '../../api/proyectos';
import { listarClientes } from '../../api/clientes';
import { listarEspacios } from '../../api/espacios';
import { obtenerProyectosFavoritos, obtenerProyectosRecientes, marcarFavorito } from '../../api/favoritos';
import { listarTareas, listarColumnas } from '../../api/tareas';
import { listarDocumentos } from '../../api/documentos';
import { listarUsuarios } from '../../api/usuarios';
import Avatar from '../../components/Avatar';
import {
  diasHasta, iniciales, colorCliente, colorAvance, entregaProyecto, ESTADOS_PROYECTO, NOMBRE_ESTADO,
} from './formato';
import { useVistaGuardada } from '../../hooks/useVistaGuardada';
import shared from '../../styles/shared.module.css';
import listado from '../../styles/listado.module.css';
import styles from './Proyectos.module.css';

// Mis proyectos muestra los que estan en curso; completados y cancelados van a Archivados
const PESTANAS = [
  ['todos', 'Todos'],
  ['activo', 'Activos'],
  ['pausado', 'Pausados'],
];
const archivado = (p) => p.estado === 'completado' || p.estado === 'cancelado';
// Textos de cada coleccion del menu (Recientes, Favoritos, Compartidos, Archivados) cuando no hay proyectos
const VACIO_COLECCION = {
  recientes: ['Aún no has abierto proyectos', 'Cada proyecto que abras aparecerá aquí.'],
  favoritos: ['No tienes proyectos favoritos', 'Marca un proyecto con la estrella para tenerlo a mano.'],
  compartidos: ['Nadie te ha sumado a un proyecto', 'Aparecen aquí los proyectos de otros donde tienes tareas asignadas.'],
  archivados: ['No hay proyectos archivados', 'Los proyectos completados o cancelados aparecerán aquí.'],
};
const ORDENES = {
  entrega: 'Entrega más próxima',
  avance: 'Mayor avance',
  actividad: 'Actividad reciente',
  nombre: 'Nombre',
};
const AGRUPACIONES = {
  ninguno: 'Sin agrupar',
  cliente: 'Cliente',
  area: 'Área',
  estado: 'Estado',
};
const FORM_VACIO = {
  nombre: '',
  descripcion: '',
  estado: 'activo',
  fecha_vencimiento: '',
  cliente_id: '',
  area_id: '',
};

const RADIO_ANILLO = 24;
const CIRC_ANILLO = 2 * Math.PI * RADIO_ANILLO;

/**
 * Pestaña Proyectos de Mis proyectos (que pone el titulo): selector Míos/Todos, resumen
 * (activos, entregas, vencidas, avance), filtros, agrupacion y tarjetas o lista.
 * coleccion: 'recientes' | 'favoritos' | 'compartidos' | 'archivados' para esas paginas del menu.
 */
const Proyectos = ({ coleccion = null }) => {
  const { user, tieneSeccion } = useAuth();
  const [proyectos, setProyectos] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [tareas, setTareas] = useState([]);
  const [documentos, setDocumentos] = useState([]);
  const [columnas, setColumnas] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [areas, setAreas] = useState([]);
  const [favoritos, setFavoritos] = useState(new Set());
  const [recientes, setRecientes] = useState(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [busqueda, setBusqueda] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('todos');
  const [orden, setOrden] = useState('entrega');
  const [vista, cambiarVista] = useVistaGuardada('proyectos.vista', ['tarjetas', 'lista'], 'tarjetas');
  // Míos: soy responsable o tengo tareas asignadas; Todos: los que el rol deja ver
  const [alcance, cambiarAlcance] = useVistaGuardada('proyectos.alcance', ['mios', 'todos'], 'mios');
  const [agrupar, cambiarAgrupar] = useVistaGuardada('proyectos.agrupar', Object.keys(AGRUPACIONES), 'ninguno');

  const [modalAbierto, setModalAbierto] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [form, setForm] = useState(FORM_VACIO);
  const [guardando, setGuardando] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

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
    // Complementos visuales: si fallan, las tarjetas se muestran sin ellos
    const [dataColumnas, dataUsuarios, dataEspacios, dataFavoritos, dataRecientes] = await Promise.allSettled([
      listarColumnas(),
      listarUsuarios(),
      tieneSeccion('archivos') ? listarEspacios() : Promise.resolve({ equipo: [] }),
      obtenerProyectosFavoritos(),
      coleccion === 'recientes' ? obtenerProyectosRecientes() : Promise.resolve([]),
    ]);
    if (dataFavoritos.status === 'fulfilled') setFavoritos(new Set(dataFavoritos.value));
    if (dataRecientes.status === 'fulfilled') setRecientes(new Map(dataRecientes.value.map((r) => [r.proyecto_id, r.visto_at])));
    if (dataColumnas.status === 'fulfilled') setColumnas(dataColumnas.value);
    if (dataUsuarios.status === 'fulfilled') setUsuarios(dataUsuarios.value);
    if (dataEspacios.status === 'fulfilled') setAreas(dataEspacios.value.equipo);
  };

  useEffect(() => {
    cargarDatos();
  }, []);

  // Desde la ficha de un cliente: /proyectos?nuevo=1&cliente=ID abre el formulario con ese cliente
  useEffect(() => {
    if (searchParams.get('nuevo') !== '1') return;
    setEditandoId(null);
    setForm({ ...FORM_VACIO, cliente_id: searchParams.get('cliente') || '' });
    setModalAbierto(true);
    setSearchParams({}, { replace: true });
  }, [searchParams, setSearchParams]);


  // ?area=ID (desde el menu): todos los proyectos de esa area, sin importar Míos/Todos
  const areaId = Number(searchParams.get('area')) || null;
  const areaFiltro = areas.find((a) => a.id === areaId);
  const quitarArea = () => {
    const nuevos = new URLSearchParams(searchParams);
    nuevos.delete('area');
    setSearchParams(nuevos, { replace: true });
  };

  const misProyectos = useMemo(() => {
    const conTareas = new Set(tareas.filter((t) => t.usuario_asignado_id === user?.id).map((t) => t.proyecto_id));
    if (coleccion === 'archivados') return proyectos.filter(archivado);
    if (coleccion === 'favoritos') return proyectos.filter((p) => favoritos.has(p.id));
    if (coleccion === 'recientes') return proyectos.filter((p) => recientes.has(p.id));
    if (coleccion === 'compartidos') return proyectos.filter((p) => p.usuario_id !== user?.id && conTareas.has(p.id));
    const enCurso = proyectos.filter((p) => !archivado(p));
    if (areaId) return enCurso.filter((p) => p.area_id === areaId);
    if (alcance === 'todos' || !user) return enCurso;
    return enCurso.filter((p) => p.usuario_id === user.id || conTareas.has(p.id));
  }, [coleccion, favoritos, recientes, areaId, alcance, proyectos, tareas, user]);

  const alternarFavorito = async (proyecto, e) => {
    e.preventDefault();
    e.stopPropagation();
    const marcar = !favoritos.has(proyecto.id);
    const cambiar = (poner) => setFavoritos((prev) => {
      const nuevo = new Set(prev);
      if (poner) nuevo.add(proyecto.id); else nuevo.delete(proyecto.id);
      return nuevo;
    });
    cambiar(marcar);
    try {
      await marcarFavorito({ proyecto_id: proyecto.id }, marcar);
    } catch {
      cambiar(!marcar);
      toast.error('No se pudo cambiar el favorito.');
    }
  };
  const idsMios = useMemo(() => new Set(misProyectos.map((p) => p.id)), [misProyectos]);

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
      const area = areas.find((a) => a.id === p.area_id);
      mapa.set(p.id, {
        total: tareasP.length,
        hechas,
        vencidas,
        progreso: tareasP.length ? Math.round((hechas / tareasP.length) * 100) : 0,
        documentos: documentos.filter((d) => d.proyecto_id === p.id).length,
        segmentos,
        equipo,
        cliente,
        area,
        entrega: entregaProyecto(p),
      });
    });
    return mapa;
  }, [proyectos, tareas, documentos, columnas, usuarios, clientes, areas]);

  const metricas = useMemo(() => {
    const hoy = new Date();
    const activos = misProyectos.filter((p) => p.estado === 'activo');
    const tareasMias = tareas.filter((t) => idsMios.has(t.proyecto_id));
    const entregasMes = activos.filter((p) => {
      if (!p.fecha_vencimiento) return false;
      const [anio, mes] = p.fecha_vencimiento.slice(0, 7).split('-').map(Number);
      return anio === hoy.getFullYear() && mes === hoy.getMonth() + 1;
    }).length;
    const vencidas = tareasMias.filter(
      (t) => !t.terminada && t.fecha_vencimiento && diasHasta(t.fecha_vencimiento) < 0,
    ).length;
    const avance = tareasMias.length
      ? Math.round((tareasMias.filter((t) => t.terminada).length / tareasMias.length) * 100)
      : 0;
    return { activos: activos.length, entregasMes, vencidas, avance };
  }, [misProyectos, idsMios, tareas]);

  const conteoEstado = (estado) =>
    estado === 'todos' ? misProyectos.length : misProyectos.filter((p) => p.estado === estado).length;

  const visibles = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    const apagado = (p) => (archivado(p) ? 1 : 0);
    const comparar = coleccion === 'recientes'
      ? (a, b) => recientes.get(b.id).localeCompare(recientes.get(a.id))
      : {
      entrega: (a, b) =>
        (a.fecha_vencimiento ? 0 : 1) - (b.fecha_vencimiento ? 0 : 1) ||
        (a.fecha_vencimiento || '').localeCompare(b.fecha_vencimiento || ''),
      avance: (a, b) => info.get(b.id).progreso - info.get(a.id).progreso,
      actividad: (a, b) => (b.updated_at || '').localeCompare(a.updated_at || ''),
      nombre: (a, b) => a.nombre.localeCompare(b.nombre, 'es'),
      }[orden];
    return misProyectos
      .filter((p) => coleccion || filtroEstado === 'todos' || p.estado === filtroEstado)
      .filter((p) => {
        if (!texto) return true;
        const cliente = info.get(p.id)?.cliente?.nombre || '';
        return `${p.nombre} ${cliente}`.toLowerCase().includes(texto);
      })
      // Completados y cancelados siempre al final
      .sort((a, b) => apagado(a) - apagado(b) || comparar(a, b));
  }, [misProyectos, coleccion, recientes, filtroEstado, busqueda, orden, info]);

  // Grupos para «Agrupar por»; sin agrupar es un solo grupo sin titulo
  const grupos = useMemo(() => {
    if (agrupar === 'ninguno') return [{ clave: 'todos', titulo: null, items: visibles }];
    const titulo = (p) => ({
      cliente: () => info.get(p.id)?.cliente?.nombre || 'Sin cliente',
      area: () => info.get(p.id)?.area?.nombre || 'Sin área',
      estado: () => NOMBRE_ESTADO[p.estado] || p.estado,
    }[agrupar]());
    const mapa = new Map();
    visibles.forEach((p) => {
      const t = titulo(p);
      if (!mapa.has(t)) mapa.set(t, []);
      mapa.get(t).push(p);
    });
    const sinGrupo = { cliente: 'Sin cliente', area: 'Sin área' }[agrupar];
    return [...mapa.entries()]
      .sort(([a], [b]) => (a === sinGrupo) - (b === sinGrupo) || (sinGrupo ? a.localeCompare(b, 'es') : 0))
      .map(([t, items]) => ({ clave: t, titulo: t, items }));
  }, [agrupar, visibles, info]);

  const limpiarFiltros = () => {
    setBusqueda('');
    setFiltroEstado('todos');
  };

  const abrirModalCrear = () => {
    setEditandoId(null);
    setForm({ ...FORM_VACIO, area_id: areaFiltro ? areaFiltro.id : '' });
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
      area_id: proyecto.area_id || '',
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
        area_id: form.area_id ? Number(form.area_id) : null,
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
    } catch {
      toast.error('No se pudo guardar el proyecto');
    } finally {
      setGuardando(false);
    }
  };

  const logoCliente = (proyecto, datos, grande = true) => {
    const base = datos.cliente || { id: proyecto.id, nombre: proyecto.nombre };
    const color = colorCliente(base.id);
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
    <span className={`${listado.entrega} ${listado[`entrega_${entrega.tipo}`] || ''}`}>
      <Calendar size={13} />
      {entrega.texto}
    </span>
  );

  const botonFavorito = (proyecto) => {
    const es = favoritos.has(proyecto.id);
    return (
      <button
        type="button"
        className={`${styles.estrella} ${es ? styles.estrellaActiva : ''}`}
        onClick={(e) => alternarFavorito(proyecto, e)}
        aria-pressed={es}
        aria-label={`${es ? 'Quitar de' : 'Agregar a'} favoritos: ${proyecto.nombre}`}
        title={es ? 'Quitar de favoritos' : 'Agregar a favoritos'}
      >
        <Star size={14} fill={es ? 'currentColor' : 'none'} />
      </button>
    );
  };

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

  const apagado = (p) => (p.estado === 'completado' || p.estado === 'cancelado' ? listado.apagado : '');

  return (
    <>
      {!coleccion && (
        <div className={listado.header}>
          {areaId ? (
            <span className={styles.filtroArea}>
              Área: <b>{areaFiltro?.nombre || '…'}</b>
              <button type="button" onClick={quitarArea} aria-label="Quitar filtro de área" title="Quitar filtro"><X size={14} /></button>
            </span>
          ) : (
            <div className={listado.pestanas} role="group" aria-label="Qué proyectos ver">
              <button type="button" aria-pressed={alcance === 'mios'} onClick={() => cambiarAlcance('mios')}>Míos</button>
              <button type="button" aria-pressed={alcance === 'todos'} onClick={() => cambiarAlcance('todos')}>Todos</button>
            </div>
          )}
          <button className={shared.btnPrimary} onClick={abrirModalCrear}>
            <Plus size={16} style={{ marginRight: 6, verticalAlign: -3 }} />
            Nuevo proyecto
          </button>
        </div>
      )}

      {error && <div className={shared.errorBanner}>{error}</div>}

      {loading ? (
        <p className={shared.loadingText}>Cargando...</p>
      ) : coleccion && misProyectos.length === 0 ? (
        <div className={listado.vacio}>
          <b>{VACIO_COLECCION[coleccion][0]}</b>
          {VACIO_COLECCION[coleccion][1]}
        </div>
      ) : areaId && misProyectos.length === 0 ? (
        <div className={listado.vacio}>
          <b>Esta área aún no tiene proyectos</b>
          Crea uno o asigna el área desde «Editar» en un proyecto.
          <button className={shared.btnPrimary} onClick={abrirModalCrear}>
            <Plus size={16} style={{ marginRight: 6, verticalAlign: -3 }} />
            Nuevo proyecto
          </button>
        </div>
      ) : misProyectos.length === 0 && alcance === 'mios' && proyectos.length > 0 ? (
        <div className={listado.vacio}>
          <b>No participas en ningún proyecto</b>
          Aparecen aquí los proyectos que creaste o donde tienes tareas asignadas.
          <button className={shared.btnSecondary} onClick={() => cambiarAlcance('todos')}>Ver todos</button>
        </div>
      ) : proyectos.length === 0 ? (
        <div className={listado.vacio}>
          <b>Aún no hay proyectos</b>
          Crea el primero para empezar a organizar documentos y tareas.
          <button className={shared.btnPrimary} onClick={abrirModalCrear}>
            <Plus size={16} style={{ marginRight: 6, verticalAlign: -3 }} />
            Nuevo proyecto
          </button>
        </div>
      ) : (
        <>
          {!coleccion && (
            <section className={listado.metricas}>
              <div className={listado.metrica}>
                <span className={`${listado.metricaIcono} ${listado.iconoVerde}`}><FolderOpen size={19} /></span>
                <div><b>{metricas.activos}</b><small>Proyectos activos</small></div>
              </div>
              <div className={listado.metrica}>
                <span className={`${listado.metricaIcono} ${listado.iconoAmbar}`}><CalendarClock size={19} /></span>
                <div><b>{metricas.entregasMes}</b><small>Entregas este mes</small></div>
              </div>
              <div className={listado.metrica}>
                <span className={`${listado.metricaIcono} ${styles.iconoRojo}`}><TriangleAlert size={19} /></span>
                <div><b>{metricas.vencidas}</b><small>{metricas.vencidas === 1 ? 'Tarea vencida' : 'Tareas vencidas'}</small></div>
              </div>
              <div className={listado.metrica}>
                <span className={`${listado.metricaIcono} ${listado.iconoAccent}`}><ChartColumn size={19} /></span>
                <div><b>{metricas.avance}%</b><small>Avance general</small></div>
              </div>
            </section>
          )}

          <div className={listado.herramientas}>
            <label className={listado.buscar}>
              <Search size={16} />
              <input
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar proyecto o cliente"
                aria-label="Buscar proyecto o cliente"
              />
            </label>
            {!coleccion && (
              <div className={listado.pestanas} role="group" aria-label="Filtrar por estado">
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
            )}
            <div className={listado.espacio} />
            <select
              className={listado.select}
              value={agrupar}
              onChange={(e) => cambiarAgrupar(e.target.value)}
              aria-label="Agrupar proyectos"
            >
              {Object.entries(AGRUPACIONES).map(([valor, texto]) => (
                <option key={valor} value={valor}>{valor === 'ninguno' ? texto : `Agrupar por ${texto.toLowerCase()}`}</option>
              ))}
            </select>
            {coleccion !== 'recientes' && (
              <select
                className={listado.select}
                value={orden}
                onChange={(e) => setOrden(e.target.value)}
                aria-label="Ordenar proyectos"
              >
                {Object.entries(ORDENES).map(([valor, texto]) => (
                  <option key={valor} value={valor}>{texto}</option>
                ))}
              </select>
            )}
            <div className={listado.vista} role="group" aria-label="Vista">
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
            <div className={listado.vacio}>
              <b>No hay proyectos que coincidan</b>
              Prueba con otro nombre o cambia el filtro de estado.
              <button className={shared.btnSecondary} onClick={limpiarFiltros}>Limpiar filtros</button>
            </div>
          ) : grupos.map((grupo, i) => (
            <section key={grupo.clave} className={styles.grupo}>
              {grupo.titulo && <h2 className={styles.grupoTitulo}>{grupo.titulo} <span>{grupo.items.length}</span></h2>}
              {vista === 'tarjetas' ? (
                <div className={styles.grid}>
                  {grupo.items.map((proyecto) => {
                    const datos = info.get(proyecto.id);
                    return (
                      <article key={proyecto.id} className={`${styles.tarjeta} ${apagado(proyecto)}`}>
                        <Link to={`/proyectos/${proyecto.id}`} className={styles.tarjetaEnlace} aria-label={proyecto.nombre} />
                        <div className={styles.tarjetaCab}>
                          {logoCliente(proyecto, datos)}
                          <div className={styles.tarjetaTitulo}>
                            <b>{proyecto.nombre} {botonFavorito(proyecto)}</b>
                            <small>{[datos.cliente?.nombre || 'Sin cliente', datos.area?.nombre].filter(Boolean).join(' · ')}</small>
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
                          <span className={listado.espacio} />
                          <span className={styles.conteo} title="Tareas"><ListChecks size={14} />{datos.total}</span>
                          <span className={styles.conteo} title="Documentos"><FileText size={14} />{datos.documentos}</span>
                          {pilaEquipo(datos.equipo)}
                        </div>
                      </article>
                    );
                  })}
                  {!coleccion && i === grupos.length - 1 && (
                    <button type="button" className={styles.nueva} onClick={abrirModalCrear}>
                      <span><Plus size={20} /></span>
                      Nuevo proyecto
                    </button>
                  )}
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
                  {grupo.items.map((proyecto) => {
                    const datos = info.get(proyecto.id);
                    return (
                      <div key={proyecto.id} className={`${styles.fila} ${apagado(proyecto)}`}>
                        <Link to={`/proyectos/${proyecto.id}`} className={styles.tarjetaEnlace} aria-label={proyecto.nombre} />
                        <div className={styles.filaNombre}>
                          {logoCliente(proyecto, datos, false)}
                          <div>
                            <b>{proyecto.nombre} {botonFavorito(proyecto)}</b>
                            <small>{[datos.cliente?.nombre || 'Sin cliente', datos.area?.nombre].filter(Boolean).join(' · ')}</small>
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
            </section>
          ))}
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
              {areas.length > 0 && (
                <div className={shared.field}>
                  <label>Área</label>
                  <select
                    value={form.area_id}
                    onChange={(e) => setForm({ ...form, area_id: e.target.value })}
                  >
                    <option value="">Sin área</option>
                    {areas.map((a) => (
                      <option key={a.id} value={a.id}>{a.nombre}</option>
                    ))}
                  </select>
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
