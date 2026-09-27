import { useState, useEffect, useCallback, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Paperclip, Search, MoreHorizontal, Check, Plus, ArrowLeft, ArrowRight, Pencil, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  DndContext,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  listarTareas,
  crearTarea,
  actualizarTarea,
  eliminarTarea,
  ordenarTareas,
  listarDocumentosDeTarea,
  agregarDocumentoATarea,
  quitarDocumentoDeTarea,
  listarColumnas,
  crearColumna,
  actualizarColumna,
  ordenarColumnas,
  eliminarColumna,
} from '../../api/tareas';
import { listarUsuarios } from '../../api/usuarios';
import { listarDocumentos } from '../../api/documentos';
import { mensajeError } from '../../api/client';
import { useAuth } from '../../hooks/useAuth';
import Avatar from '../../components/Avatar';
import { vencimientoTarea } from './formato';
import shared from '../../styles/shared.module.css';
import styles from './ProyectoTareas.module.css';

const PRIORIDADES = ['baja', 'media', 'alta'];
const COLORES_COLUMNA = ['#9096A8', '#C08A2E', '#5B6FB0', '#9A4E8F', '#B03030', '#1A7F4B'];
const FILTROS_VACIOS = { texto: '', soloMias: false, personaId: null, prioridad: '' };

// Las columnas se registran en dnd-kit con este prefijo para no chocar con los ids de las tareas
const idColumnaDnd = (id) => `columna-${id}`;
const columnaDesdeDnd = (dndId) =>
  typeof dndId === 'string' && dndId.startsWith('columna-') ? Number(dndId.slice(8)) : null;

function MenuColumna({ columna, columnas, totalTareas, onRenombrar, onCambiar, onMover, onEliminar, onCerrar }) {
  const ref = useRef(null);
  const otras = columnas.filter((c) => c.id !== columna.id);
  const [destino, setDestino] = useState(otras[0]?.id || '');
  const indice = columnas.findIndex((c) => c.id === columna.id);

  useEffect(() => {
    const cerrarFuera = (e) => ref.current && !ref.current.contains(e.target) && onCerrar();
    const cerrarEscape = (e) => e.key === 'Escape' && onCerrar();
    document.addEventListener('mousedown', cerrarFuera);
    document.addEventListener('keydown', cerrarEscape);
    return () => {
      document.removeEventListener('mousedown', cerrarFuera);
      document.removeEventListener('keydown', cerrarEscape);
    };
  }, [onCerrar]);

  return (
    <div ref={ref} className={styles.menu} role="menu">
      <button type="button" className={styles.menuItem} onClick={onRenombrar}>
        <Pencil size={14} /> Renombrar
      </button>

      <span className={styles.menuTitulo}>Color</span>
      <div className={styles.colores}>
        {COLORES_COLUMNA.map((color) => (
          <button
            key={color}
            type="button"
            className={styles.color}
            style={{ background: color }}
            aria-label={`Color ${color}`}
            aria-pressed={columna.color === color}
            onClick={() => onCambiar({ color })}
          />
        ))}
      </div>

      <button
        type="button"
        className={styles.menuItem}
        onClick={() => onCambiar({ es_final: !columna.es_final })}
      >
        <Check size={14} />
        {columna.es_final ? 'Quitar como columna de terminadas' : 'Marcar como columna de terminadas'}
      </button>
      <button type="button" className={styles.menuItem} disabled={indice === 0} onClick={() => onMover(-1)}>
        <ArrowLeft size={14} /> Mover a la izquierda
      </button>
      <button
        type="button"
        className={styles.menuItem}
        disabled={indice === columnas.length - 1}
        onClick={() => onMover(1)}
      >
        <ArrowRight size={14} /> Mover a la derecha
      </button>

      <hr className={styles.menuSeparador} />

      {otras.length === 0 ? (
        <p className={styles.menuAyuda}>El tablero necesita al menos una columna.</p>
      ) : totalTareas > 0 ? (
        <div className={styles.menuEliminar}>
          <span className={styles.menuAyuda}>
            Tiene {totalTareas} {totalTareas === 1 ? 'tarea' : 'tareas'}. Muévelas a:
          </span>
          <select value={destino} onChange={(e) => setDestino(Number(e.target.value))}>
            {otras.map((c) => (
              <option key={c.id} value={c.id}>{c.nombre}</option>
            ))}
          </select>
          <button type="button" className={`${styles.menuItem} ${styles.peligro}`} onClick={() => onEliminar(destino)}>
            <Trash2 size={14} /> Mover y eliminar columna
          </button>
        </div>
      ) : (
        <button type="button" className={`${styles.menuItem} ${styles.peligro}`} onClick={() => onEliminar(null)}>
          <Trash2 size={14} /> Eliminar columna
        </button>
      )}
    </div>
  );
}

function Columna({
  columna,
  columnas,
  tareas,
  totalTareas,
  usuarioDe,
  renombrando,
  menuAbierto,
  onAbrirMenu,
  onCerrarMenu,
  onEmpezarRenombrar,
  onRenombrar,
  onCambiar,
  onMover,
  onEliminar,
  onClickTarea,
  onAgregar,
}) {
  const { setNodeRef, isOver } = useDroppable({ id: idColumnaDnd(columna.id) });
  const [nombre, setNombre] = useState(columna.nombre);

  useEffect(() => {
    if (renombrando) setNombre(columna.nombre);
  }, [renombrando, columna.nombre]);

  const guardarNombre = () => onRenombrar(nombre.trim());

  return (
    <section className={`${styles.columna} ${isOver ? styles.columnaSobre : ''}`} aria-label={columna.nombre}>
      <div className={styles.columnaHeader}>
        <span className={styles.columnaPunto} style={{ background: columna.color }} />
        {renombrando ? (
          <input
            className={styles.columnaInput}
            value={nombre}
            maxLength={50}
            autoFocus
            onFocus={(e) => e.target.select()}
            onChange={(e) => setNombre(e.target.value)}
            onBlur={guardarNombre}
            onKeyDown={(e) => {
              if (e.key === 'Enter') guardarNombre();
              if (e.key === 'Escape') onRenombrar(null);
            }}
            aria-label="Nombre de la columna"
          />
        ) : (
          <span className={styles.columnaTitulo} onDoubleClick={onEmpezarRenombrar} title="Doble clic para renombrar">
            {columna.nombre}
          </span>
        )}
        {columna.es_final && (
          <span className={styles.columnaFinal} title="Las tareas aquí cuentan como terminadas">
            <Check size={11} strokeWidth={3} />
          </span>
        )}
        <span className={styles.contador}>{tareas.length}</span>
        <button
          type="button"
          className={styles.columnaMenuBtn}
          onClick={menuAbierto ? onCerrarMenu : onAbrirMenu}
          aria-label={`Opciones de ${columna.nombre}`}
          aria-expanded={menuAbierto}
        >
          <MoreHorizontal size={16} />
        </button>
        {menuAbierto && (
          <MenuColumna
            columna={columna}
            columnas={columnas}
            totalTareas={totalTareas}
            onRenombrar={onEmpezarRenombrar}
            onCambiar={onCambiar}
            onMover={onMover}
            onEliminar={onEliminar}
            onCerrar={onCerrarMenu}
          />
        )}
      </div>
      <SortableContext items={tareas.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <div ref={setNodeRef} className={styles.columnaBody}>
          {tareas.map((tarea) => (
            <TarjetaTarea
              key={tarea.id}
              tarea={tarea}
              usuario={usuarioDe(tarea.usuario_asignado_id)}
              onClick={onClickTarea}
            />
          ))}
        </div>
      </SortableContext>
      <button className={styles.btnAgregar} onClick={() => onAgregar(columna.id)}>
        + Agregar tarea
      </button>
    </section>
  );
}

function TarjetaTarea({ tarea, usuario, onClick }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: tarea.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  const vencimiento = vencimientoTarea(tarea.fecha_vencimiento, tarea.terminada);

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`${styles.tarjeta} ${styles[`prioridad_${tarea.prioridad}`] || ''} ${tarea.terminada ? styles.terminada : ''}`}
      onClick={() => onClick(tarea)}
      title={`Prioridad ${tarea.prioridad}`}
    >
      <p className={styles.tarjetaTitulo}>{tarea.titulo}</p>
      <div className={styles.tarjetaMeta}>
        {vencimiento && (
          <span className={`${styles.fecha} ${styles[`fecha_${vencimiento.tipo}`]}`}>{vencimiento.texto}</span>
        )}
        {tarea.documentos_count > 0 && (
          <span className={styles.docsBadge} title="Documentos enlazados">
            <Paperclip size={11} />
            {tarea.documentos_count}
          </span>
        )}
        <span className={styles.asignado} title={usuario ? usuario.nombre : 'Sin asignar'}>
          {usuario ? <Avatar usuario={usuario} size={24} /> : <span className={styles.sinAsignar} />}
        </span>
      </div>
    </div>
  );
}

export default function ProyectoTareas() {
  const { proyecto } = useOutletContext();
  const { user } = useAuth();
  const [columnas, setColumnas] = useState([]);
  const [tareas, setTareas] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [documentosProyecto, setDocumentosProyecto] = useState([]);
  const [loading, setLoading] = useState(true);

  const [filtros, setFiltros] = useState(FILTROS_VACIOS);
  const [menuColumna, setMenuColumna] = useState(null);
  const [renombrando, setRenombrando] = useState(null);

  const [modalAbierto, setModalAbierto] = useState(false);
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState({
    titulo: '',
    descripcion: '',
    prioridad: 'media',
    fecha_vencimiento: '',
    usuario_asignado_id: '',
    columna_id: '',
  });
  const [guardando, setGuardando] = useState(false);

  const [documentosTarea, setDocumentosTarea] = useState([]);
  const [documentoSeleccionado, setDocumentoSeleccionado] = useState('');
  const [cargandoDocs, setCargandoDocs] = useState(false);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const cargar = useCallback(async () => {
    try {
      const [dataColumnas, dataTareas, dataUsuarios, dataDocs] = await Promise.all([
        listarColumnas(proyecto.id),
        listarTareas(proyecto.id),
        listarUsuarios(),
        listarDocumentos(proyecto.id),
      ]);
      setColumnas(dataColumnas);
      setTareas(dataTareas);
      setUsuarios(dataUsuarios);
      setDocumentosProyecto(dataDocs);
    } finally {
      setLoading(false);
    }
  }, [proyecto.id]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const usuarioDe = (id) => usuarios.find((u) => u.id === id);

  // Personas con tareas en este proyecto, para el filtro rapido
  const personasConTareas = usuarios.filter((u) => tareas.some((t) => t.usuario_asignado_id === u.id));

  const pasaFiltros = (t) => {
    if (filtros.texto && !t.titulo.toLowerCase().includes(filtros.texto.toLowerCase())) return false;
    if (filtros.soloMias && t.usuario_asignado_id !== user?.id) return false;
    if (filtros.personaId && t.usuario_asignado_id !== filtros.personaId) return false;
    if (filtros.prioridad && t.prioridad !== filtros.prioridad) return false;
    return true;
  };
  const hayFiltros = JSON.stringify(filtros) !== JSON.stringify(FILTROS_VACIOS);

  const tareasDeColumna = (columnaId) =>
    tareas.filter((t) => t.columna_id === columnaId).sort((a, b) => a.orden - b.orden);

  // ---------- Columnas ----------

  const cambiarColumna = async (columna, cambios) => {
    try {
      await actualizarColumna(columna.id, cambios);
      // Marcar una columna como final desmarca las demas: se recargan columnas y tareas
      if ('es_final' in cambios) {
        setMenuColumna(null);
        await cargar();
      } else {
        setColumnas((prev) => prev.map((c) => (c.id === columna.id ? { ...c, ...cambios } : c)));
      }
    } catch (err) {
      toast.error(mensajeError(err, 'No se pudo actualizar la columna'));
    }
  };

  const renombrarColumna = async (columna, nombre) => {
    setRenombrando(null);
    if (!nombre || nombre === columna.nombre) return;
    await cambiarColumna(columna, { nombre });
  };

  const moverColumna = async (columna, direccion) => {
    const ids = columnas.map((c) => c.id);
    const i = ids.indexOf(columna.id);
    const j = i + direccion;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    setColumnas(ids.map((id) => columnas.find((c) => c.id === id)));
    try {
      setColumnas(await ordenarColumnas(proyecto.id, ids));
    } catch (err) {
      cargar();
      toast.error(mensajeError(err, 'No se pudo mover la columna'));
    }
  };

  const borrarColumna = async (columna, moverA) => {
    try {
      await eliminarColumna(columna.id, moverA);
      setMenuColumna(null);
      await cargar();
      toast.success('Columna eliminada');
    } catch (err) {
      toast.error(mensajeError(err, 'No se pudo eliminar la columna'));
    }
  };

  const agregarColumna = async () => {
    try {
      const nueva = await crearColumna({ proyecto_id: proyecto.id, nombre: 'Nueva columna' });
      setColumnas((prev) => [...prev, nueva]);
      setRenombrando(nueva.id);
    } catch (err) {
      toast.error(mensajeError(err, 'No se pudo crear la columna'));
    }
  };

  // ---------- Tareas ----------

  const cargarDocumentosDeTarea = async (tareaId) => {
    setCargandoDocs(true);
    try {
      const data = await listarDocumentosDeTarea(tareaId);
      setDocumentosTarea(data);
    } finally {
      setCargandoDocs(false);
    }
  };

  const abrirModalCrear = (columnaId) => {
    setEditando(null);
    setForm({
      titulo: '',
      descripcion: '',
      prioridad: 'media',
      fecha_vencimiento: '',
      usuario_asignado_id: '',
      columna_id: columnaId ?? columnas[0]?.id ?? '',
    });
    setDocumentosTarea([]);
    setDocumentoSeleccionado('');
    setModalAbierto(true);
  };

  const abrirModalEditar = (tarea) => {
    setEditando(tarea);
    setForm({
      titulo: tarea.titulo || '',
      descripcion: tarea.descripcion || '',
      prioridad: tarea.prioridad || 'media',
      fecha_vencimiento: tarea.fecha_vencimiento ? tarea.fecha_vencimiento.slice(0, 10) : '',
      usuario_asignado_id: tarea.usuario_asignado_id || '',
      columna_id: tarea.columna_id,
    });
    setDocumentoSeleccionado('');
    setModalAbierto(true);
    cargarDocumentosDeTarea(tarea.id);
  };

  const cerrarModal = () => {
    setModalAbierto(false);
    setEditando(null);
    setDocumentosTarea([]);
  };

  const handleGuardar = async (e) => {
    e.preventDefault();
    if (!form.titulo.trim()) return;
    setGuardando(true);
    try {
      const payload = {
        ...form,
        proyecto_id: proyecto.id,
        columna_id: Number(form.columna_id),
        usuario_asignado_id: form.usuario_asignado_id ? Number(form.usuario_asignado_id) : null,
        fecha_vencimiento: form.fecha_vencimiento ? `${form.fecha_vencimiento}T00:00:00Z` : null,
      };
      if (editando) {
        await actualizarTarea(editando.id, payload);
        toast.success('Tarea actualizada');
      } else {
        await crearTarea(payload);
        toast.success('Tarea creada');
      }
      cerrarModal();
      cargar();
    } catch (err) {
      toast.error(mensajeError(err, 'No se pudo guardar la tarea.'));
    } finally {
      setGuardando(false);
    }
  };

  const handleEliminar = async () => {
    if (!editando) return;
    if (!confirm('¿Eliminar esta tarea?')) return;
    try {
      await eliminarTarea(editando.id);
      cerrarModal();
      cargar();
      toast.success('Tarea eliminada');
    } catch (err) {
      toast.error('No se pudo eliminar.');
    }
  };

  const handleAgregarDocumento = async () => {
    if (!documentoSeleccionado || !editando) return;
    try {
      await agregarDocumentoATarea(editando.id, Number(documentoSeleccionado));
      setDocumentoSeleccionado('');
      cargarDocumentosDeTarea(editando.id);
      cargar();
      toast.success('Documento enlazado');
    } catch (err) {
      toast.error('No se pudo enlazar el documento.');
    }
  };

  const handleQuitarDocumento = async (documentoId) => {
    if (!editando) return;
    try {
      await quitarDocumentoDeTarea(editando.id, documentoId);
      cargarDocumentosDeTarea(editando.id);
      cargar();
      toast.success('Documento desenlazado');
    } catch (err) {
      toast.error('No se pudo quitar el documento.');
    }
  };

  const documentosDisponibles = documentosProyecto.filter(
    (d) => !documentosTarea.some((dt) => dt.documento_id === d.id)
  );

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    if (!over) return;

    const tareaActiva = tareas.find((t) => t.id === active.id);
    if (!tareaActiva) return;

    const tareaSobre = tareas.find((t) => t.id === over.id);
    const columnaId = columnaDesdeDnd(over.id) ?? tareaSobre?.columna_id;
    if (!columnaId || (active.id === over.id && !columnaDesdeDnd(over.id))) return;

    // Se reordena la columna completa (no solo lo visible con filtros) para no perder posiciones
    const destino = tareasDeColumna(columnaId).filter((t) => t.id !== active.id);
    const indice = tareaSobre ? destino.findIndex((t) => t.id === over.id) : destino.length;
    destino.splice(indice === -1 ? destino.length : indice, 0, tareaActiva);
    const ids = destino.map((t) => t.id);

    const finales = new Set(columnas.filter((c) => c.es_final).map((c) => c.id));
    setTareas((prev) =>
      prev.map((t) =>
        ids.includes(t.id)
          ? { ...t, columna_id: columnaId, orden: ids.indexOf(t.id), terminada: finales.has(columnaId) }
          : t
      )
    );

    try {
      await ordenarTareas(columnaId, ids);
    } catch (err) {
      cargar();
      toast.error('No se pudo mover la tarea.');
    }
  };

  if (loading) return <p className={shared.loadingText}>Cargando tareas...</p>;

  return (
    <div className={styles.contenedor}>
      <div className={styles.barra}>
        <label className={styles.buscar}>
          <Search size={15} />
          <input
            type="search"
            placeholder="Buscar tareas..."
            value={filtros.texto}
            onChange={(e) => setFiltros({ ...filtros, texto: e.target.value })}
            aria-label="Buscar tareas"
          />
        </label>
        <button
          type="button"
          className={styles.chip}
          aria-pressed={filtros.soloMias}
          onClick={() => setFiltros({ ...filtros, soloMias: !filtros.soloMias })}
        >
          Solo mis tareas
        </button>
        {personasConTareas.length > 0 && (
          <div className={styles.personas} aria-label="Filtrar por responsable">
            {personasConTareas.map((u) => (
              <button
                key={u.id}
                type="button"
                className={styles.persona}
                aria-pressed={filtros.personaId === u.id}
                title={u.nombre}
                aria-label={`Ver tareas de ${u.nombre}`}
                onClick={() => setFiltros({ ...filtros, personaId: filtros.personaId === u.id ? null : u.id })}
              >
                <Avatar usuario={u} size={28} />
              </button>
            ))}
          </div>
        )}
        <select
          className={styles.selectFiltro}
          value={filtros.prioridad}
          onChange={(e) => setFiltros({ ...filtros, prioridad: e.target.value })}
          aria-label="Filtrar por prioridad"
        >
          <option value="">Toda prioridad</option>
          {PRIORIDADES.map((p) => (
            <option key={p} value={p}>Prioridad {p}</option>
          ))}
        </select>
        {hayFiltros && (
          <button type="button" className={shared.linkBtn} onClick={() => setFiltros(FILTROS_VACIOS)}>
            Limpiar filtros
          </button>
        )}
        <span className={styles.espacio} />
        <button type="button" className={shared.btnPrimary} onClick={() => abrirModalCrear()}>
          <Plus size={16} className={styles.iconoBoton} />
          Nueva tarea
        </button>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
        <div className={styles.tablero}>
          {columnas.map((columna) => {
            const todas = tareasDeColumna(columna.id);
            return (
              <Columna
                key={columna.id}
                columna={columna}
                columnas={columnas}
                tareas={todas.filter(pasaFiltros)}
                totalTareas={todas.length}
                usuarioDe={usuarioDe}
                renombrando={renombrando === columna.id}
                menuAbierto={menuColumna === columna.id}
                onAbrirMenu={() => setMenuColumna(columna.id)}
                onCerrarMenu={() => setMenuColumna(null)}
                onEmpezarRenombrar={() => {
                  setMenuColumna(null);
                  setRenombrando(columna.id);
                }}
                onRenombrar={(nombre) => renombrarColumna(columna, nombre)}
                onCambiar={(cambios) => cambiarColumna(columna, cambios)}
                onMover={(direccion) => moverColumna(columna, direccion)}
                onEliminar={(moverA) => borrarColumna(columna, moverA)}
                onClickTarea={abrirModalEditar}
                onAgregar={abrirModalCrear}
              />
            );
          })}
          <button type="button" className={styles.columnaNueva} onClick={agregarColumna}>
            + Agregar columna
          </button>
        </div>
      </DndContext>

      {modalAbierto && (
        <div className={shared.overlay} onClick={cerrarModal}>
          <div className={shared.modal} onClick={(e) => e.stopPropagation()}>
            <h3 className={shared.modalTitle}>{editando ? 'Editar tarea' : 'Nueva tarea'}</h3>
            <form onSubmit={handleGuardar} className={shared.form}>
              <div className={shared.field}>
                <label>Título</label>
                <input
                  value={form.titulo}
                  onChange={(e) => setForm({ ...form, titulo: e.target.value })}
                  required
                  autoFocus
                />
              </div>

              <div className={shared.field}>
                <label>Descripción</label>
                <textarea
                  rows={3}
                  value={form.descripcion}
                  onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
                />
              </div>

              <div className={styles.camposFila}>
                <div className={shared.field}>
                  <label>Columna</label>
                  <select
                    value={form.columna_id}
                    onChange={(e) => setForm({ ...form, columna_id: e.target.value })}
                  >
                    {columnas.map((c) => (
                      <option key={c.id} value={c.id}>{c.nombre}</option>
                    ))}
                  </select>
                </div>

                <div className={shared.field}>
                  <label>Prioridad</label>
                  <select
                    value={form.prioridad}
                    onChange={(e) => setForm({ ...form, prioridad: e.target.value })}
                  >
                    {PRIORIDADES.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className={shared.field}>
                <label>Asignado a</label>
                <select
                  value={form.usuario_asignado_id}
                  onChange={(e) => setForm({ ...form, usuario_asignado_id: e.target.value })}
                >
                  <option value="">Sin asignar</option>
                  {usuarios.map((u) => (
                    <option key={u.id} value={u.id}>{u.nombre}</option>
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

              {editando && (
                <div className={shared.field}>
                  <label>Documentos relacionados</label>
                  {cargandoDocs ? (
                    <p className={shared.loadingText}>Cargando...</p>
                  ) : (
                    <>
                      {documentosTarea.length > 0 && (
                        <div className={styles.docsLista}>
                          {documentosTarea.map((d) => (
                            <div key={d.documento_id} className={styles.docItem}>
                              <span>
                                <Paperclip size={13} /> {d.nombre} <span className={styles.docVersion}>v{d.version_actual}</span>
                              </span>
                              <button
                                type="button"
                                className={styles.docQuitar}
                                onClick={() => handleQuitarDocumento(d.documento_id)}
                              >
                                Quitar
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                      {documentosDisponibles.length > 0 && (
                        <div className={styles.docsAgregar}>
                          <select
                            value={documentoSeleccionado}
                            onChange={(e) => setDocumentoSeleccionado(e.target.value)}
                          >
                            <option value="">Selecciona un documento...</option>
                            {documentosDisponibles.map((d) => (
                              <option key={d.id} value={d.id}>{d.nombre}</option>
                            ))}
                          </select>
                          <button
                            type="button"
                            className={shared.btnSecondary}
                            onClick={handleAgregarDocumento}
                            disabled={!documentoSeleccionado}
                          >
                            Enlazar
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              <div className={shared.modalActions}>
                {editando && (
                  <button type="button" className={shared.btnDanger} onClick={handleEliminar}>
                    Eliminar
                  </button>
                )}
                <div style={{ flex: 1 }} />
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
    </div>
  );
}
