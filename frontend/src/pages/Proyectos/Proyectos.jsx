import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Plus, Pencil, ListTodo, FileText, Calendar } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import {
  listarProyectos,
  crearProyecto,
  actualizarProyecto,
  eliminarProyecto,
} from '../../api/proyectos';
import { listarClientes } from '../../api/clientes';
import { listarTareas } from '../../api/tareas';
import { listarDocumentos } from '../../api/documentos';
import PageContainer from '../../components/PageContainer';
import shared from '../../styles/shared.module.css';
import styles from './Proyectos.module.css';

const ESTADOS = ['activo', 'pausado', 'completado', 'cancelado'];

const FORM_VACIO = {
  nombre: '',
  descripcion: '',
  estado: 'activo',
  fecha_vencimiento: '',
  cliente_id: '',
};

const COLOR_ESTADO = {
  activo: styles.borderActivo,
  pausado: styles.borderPausado,
  completado: styles.borderCompletado,
  cancelado: styles.borderCancelado,
};

const BADGE_ESTADO = {
  activo: 'badge-success',
  pausado: 'badge-warning',
  completado: 'badge-neutral',
  cancelado: 'badge-danger',
};

const Proyectos = () => {
  const { user } = useAuth();
  const [proyectos, setProyectos] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [tareas, setTareas] = useState([]);
  const [documentos, setDocumentos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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
  };

  useEffect(() => {
    cargarDatos();
  }, []);

  const nombreCliente = (clienteId) => {
    const cliente = clientes.find((c) => c.id === clienteId);
    return cliente ? cliente.nombre : null;
  };

  const estadisticasProyecto = (proyectoId) => {
    const tareasDelProyecto = tareas.filter((t) => t.proyecto_id === proyectoId);
    const hechas = tareasDelProyecto.filter((t) => t.terminada).length;
    const totalTareas = tareasDelProyecto.length;
    const progreso = totalTareas > 0 ? Math.round((hechas / totalTareas) * 100) : 0;
    const totalDocumentos = documentos.filter((d) => d.proyecto_id === proyectoId).length;
    return { totalTareas, progreso, totalDocumentos };
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
        <p className={shared.emptyText}>No hay proyectos registrados todavia.</p>
      ) : (
        <div className={styles.lista}>
          {proyectos.map((proyecto) => {
            const { totalTareas, progreso, totalDocumentos } = estadisticasProyecto(proyecto.id);
            const cliente = nombreCliente(proyecto.cliente_id);
            return (
              <Link
                key={proyecto.id}
                to={`/proyectos/${proyecto.id}`}
                className={`${styles.fila} ${COLOR_ESTADO[proyecto.estado] || ''}`}
              >
                <div className={styles.filaInfo}>
                  <p className={styles.filaNombre}>{proyecto.nombre}</p>
                  <p className={styles.filaMeta}>
                    {cliente && <span>{cliente}</span>}
                    {proyecto.fecha_vencimiento && (
                      <span className={styles.filaMetaItem}>
                        <Calendar size={12} />
                        {proyecto.fecha_vencimiento.slice(0, 10)}
                      </span>
                    )}
                  </p>
                </div>

                <div className={styles.filaProgreso}>
                  <div className={styles.progresoTrack}>
                    <div className={styles.progresoFill} style={{ width: `${progreso}%` }} />
                  </div>
                </div>

                <span className={styles.filaConteo}>
                  <ListTodo size={13} />
                  {totalTareas}
                </span>
                <span className={styles.filaConteo}>
                  <FileText size={13} />
                  {totalDocumentos}
                </span>

                <span className={`${shared.badge} ${shared[BADGE_ESTADO[proyecto.estado]]}`}>
                  {proyecto.estado}
                </span>

                <button
                  className={shared.iconBtn}
                  onClick={(e) => abrirModalEditar(proyecto, e)}
                  title="Editar"
                  aria-label="Editar proyecto"
                >
                  <Pencil size={15} />
                </button>
              </Link>
            );
          })}
        </div>
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
