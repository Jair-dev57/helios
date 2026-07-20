import { useState, useEffect, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Paperclip } from 'lucide-react';
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
  listarDocumentosDeTarea,
  agregarDocumentoATarea,
  quitarDocumentoDeTarea,
} from '../../api/tareas';
import { listarUsuarios } from '../../api/usuarios';
import { listarDocumentos } from '../../api/documentos';
import shared from '../../styles/shared.module.css';
import styles from './ProyectoTareas.module.css';

const COLUMNAS = [
  { id: 'por_hacer', label: 'Por hacer' },
  { id: 'en_progreso', label: 'En progreso' },
  { id: 'en_revision', label: 'En revisión' },
  { id: 'hecho', label: 'Hecho' },
];

const PRIORIDADES = ['baja', 'media', 'alta'];

function Columna({ col, tareas, nombreUsuario, onClickTarea, onAgregar }) {
  const { setNodeRef } = useDroppable({ id: col.id });

  return (
    <div className={styles.columna}>
      <div className={styles.columnaHeader}>
        <span className={styles.columnaTitulo}>{col.label}</span>
        <span className={styles.contador}>{tareas.length}</span>
      </div>
      <SortableContext items={tareas.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <div ref={setNodeRef} className={styles.columnaBody}>
          {tareas.map((tarea) => (
            <TarjetaTarea
              key={tarea.id}
              tarea={tarea}
              nombreUsuario={nombreUsuario(tarea.usuario_asignado_id)}
              onClick={onClickTarea}
            />
          ))}
        </div>
      </SortableContext>
      <button className={styles.btnAgregar} onClick={() => onAgregar(col.id)}>
        + Agregar tarea
      </button>
    </div>
  );
}

function TarjetaTarea({ tarea, nombreUsuario, onClick }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: tarea.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={styles.tarjeta}
      onClick={() => onClick(tarea)}
    >
      <p className={styles.tarjetaTitulo}>{tarea.titulo}</p>
      <div className={styles.tarjetaMeta}>
        <span className={`${styles.prioridad} ${styles[`prioridad_${tarea.prioridad}`]}`}>
          {tarea.prioridad}
        </span>
        {tarea.fecha_vencimiento && (
          <span className={styles.fecha}>{tarea.fecha_vencimiento.slice(0, 10)}</span>
        )}
        {tarea.documentos_count > 0 && (
          <span className={styles.docsBadge}>
            <Paperclip size={11} />
            {tarea.documentos_count}
          </span>
        )}
      </div>
      {nombreUsuario && <span className={styles.asignado}>{nombreUsuario}</span>}
    </div>
  );
}

export default function ProyectoTareas() {
  const { proyecto } = useOutletContext();
  const [tareas, setTareas] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [documentosProyecto, setDocumentosProyecto] = useState([]);
  const [loading, setLoading] = useState(true);

  const [modalAbierto, setModalAbierto] = useState(false);
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState({
    titulo: '',
    descripcion: '',
    prioridad: 'media',
    fecha_vencimiento: '',
    usuario_asignado_id: '',
    estado: 'por_hacer',
  });
  const [guardando, setGuardando] = useState(false);

  const [documentosTarea, setDocumentosTarea] = useState([]);
  const [documentoSeleccionado, setDocumentoSeleccionado] = useState('');
  const [cargandoDocs, setCargandoDocs] = useState(false);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const cargar = useCallback(async () => {
    try {
      setLoading(true);
      const [dataTareas, dataUsuarios, dataDocs] = await Promise.all([
        listarTareas(proyecto.id),
        listarUsuarios(),
        listarDocumentos(proyecto.id),
      ]);
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

  const nombreUsuario = (id) => usuarios.find((u) => u.id === id)?.nombre;

  const tareasPorColumna = (estado) =>
    tareas.filter((t) => t.estado === estado).sort((a, b) => a.orden - b.orden);

  const cargarDocumentosDeTarea = async (tareaId) => {
    setCargandoDocs(true);
    try {
      const data = await listarDocumentosDeTarea(tareaId);
      setDocumentosTarea(data);
    } finally {
      setCargandoDocs(false);
    }
  };

  const abrirModalCrear = (estado) => {
    setEditando(null);
    setForm({
      titulo: '',
      descripcion: '',
      prioridad: 'media',
      fecha_vencimiento: '',
      usuario_asignado_id: '',
      estado,
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
      estado: tarea.estado,
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
        usuario_asignado_id: form.usuario_asignado_id ? Number(form.usuario_asignado_id) : null,
        fecha_vencimiento: form.fecha_vencimiento ? `${form.fecha_vencimiento}T00:00:00Z` : null,
      };
      if (editando) {
        await actualizarTarea(editando.id, payload);
      } else {
        const maxOrden = Math.max(0, ...tareasPorColumna(form.estado).map((t) => t.orden));
        await crearTarea({ ...payload, orden: maxOrden + 1 });
      }
      cerrarModal();
      cargar();
    } catch (err) {
      alert('No se pudo guardar la tarea.');
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
    } catch (err) {
      alert('No se pudo eliminar.');
    }
  };

  const handleAgregarDocumento = async () => {
    if (!documentoSeleccionado || !editando) return;
    try {
      await agregarDocumentoATarea(editando.id, Number(documentoSeleccionado));
      setDocumentoSeleccionado('');
      cargarDocumentosDeTarea(editando.id);
      cargar();
    } catch (err) {
      alert('No se pudo enlazar el documento.');
    }
  };

  const handleQuitarDocumento = async (documentoId) => {
    if (!editando) return;
    try {
      await quitarDocumentoDeTarea(editando.id, documentoId);
      cargarDocumentosDeTarea(editando.id);
      cargar();
    } catch (err) {
      alert('No se pudo quitar el documento.');
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

    let nuevoEstado = tareaActiva.estado;
    let tareaSobre = tareas.find((t) => t.id === over.id);

    if (COLUMNAS.some((c) => c.id === over.id)) {
      nuevoEstado = over.id;
    } else if (tareaSobre) {
      nuevoEstado = tareaSobre.estado;
    }

    if (active.id === over.id && !tareaSobre) return;

    const columnaDestino = tareasPorColumna(nuevoEstado).filter((t) => t.id !== active.id);
    const indiceDestino = tareaSobre
      ? columnaDestino.findIndex((t) => t.id === over.id)
      : columnaDestino.length;

    const reordenada = [...columnaDestino];
    reordenada.splice(indiceDestino === -1 ? reordenada.length : indiceDestino, 0, {
      ...tareaActiva,
      estado: nuevoEstado,
    });

    setTareas((prev) => {
      const otras = prev.filter((t) => !reordenada.some((r) => r.id === t.id));
      const actualizadas = reordenada.map((t, i) => ({ ...t, orden: i }));
      return [...otras, ...actualizadas];
    });

    try {
      await actualizarTarea(tareaActiva.id, {
        estado: nuevoEstado,
        orden: indiceDestino === -1 ? reordenada.length - 1 : indiceDestino,
      });
    } catch (err) {
      cargar();
    }
  };

  if (loading) return <p className={shared.loadingText}>Cargando tareas...</p>;

  return (
    <div>
      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
        <div className={styles.tablero}>
          {COLUMNAS.map((col) => (
            <Columna
              key={col.id}
              col={col}
              tareas={tareasPorColumna(col.id)}
              nombreUsuario={nombreUsuario}
              onClickTarea={abrirModalEditar}
              onAgregar={abrirModalCrear}
            />
          ))}
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