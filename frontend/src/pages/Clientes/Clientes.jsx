import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { Plus, Pencil, Power, PowerOff } from 'lucide-react';
import {
  listarClientes,
  crearCliente,
  actualizarCliente,
  toggleActivoCliente,
} from '../../api/clientes';
import { listarProyectos } from '../../api/proyectos';
import PageContainer from '../../components/PageContainer';
import shared from '../../styles/shared.module.css';
import styles from './Clientes.module.css';

const FORM_VACIO = { nombre: '', email: '', telefono: '', empresa: '' };

const iniciales = (nombre) => {
  if (!nombre) return '?';
  const partes = nombre.trim().split(/\s+/);
  return (partes[0][0] + (partes[1]?.[0] || '')).toUpperCase();
};

const Clientes = () => {
  const [clientes, setClientes] = useState([]);
  const [proyectos, setProyectos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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
  };

  useEffect(() => {
    cargarDatos();
  }, []);

  const conteoProyectos = (clienteId) =>
    proyectos.filter((p) => p.cliente_id === clienteId).length;

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

  return (
    <PageContainer>
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
        <p className={shared.emptyText}>No hay clientes registrados todavia.</p>
      ) : (
        <table className={shared.table}>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Empresa</th>
              <th>Email</th>
              <th>Telefono</th>
              <th>Proyectos</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {clientes.map((cliente) => (
              <tr key={cliente.id}>
                <td>
                  <div className={styles.nombreCelda}>
                    <div className={styles.avatar}>{iniciales(cliente.nombre)}</div>
                    {cliente.nombre}
                  </div>
                </td>
                <td>{cliente.empresa || '-'}</td>
                <td>{cliente.email || '-'}</td>
                <td>{cliente.telefono || '-'}</td>
                <td>
                  <span className={`${shared.badge} ${shared['badge-neutral']}`}>
                    {conteoProyectos(cliente.id)}
                  </span>
                </td>
                <td>
                  <span className={`${shared.badge} ${cliente.activo ? shared['badge-success'] : shared['badge-danger']}`}>
                    {cliente.activo ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                <td>
                  <div className={shared.iconBtnGroup}>
                    <button
                      className={shared.iconBtn}
                      onClick={() => abrirModalEditar(cliente)}
                      title="Editar"
                      aria-label="Editar cliente"
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      className={shared.iconBtn}
                      onClick={() => handleToggleActivo(cliente)}
                      title={cliente.activo ? 'Desactivar' : 'Activar'}
                      aria-label={cliente.activo ? 'Desactivar cliente' : 'Activar cliente'}
                    >
                      {cliente.activo ? <PowerOff size={15} /> : <Power size={15} />}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

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
