import { useState, useEffect } from 'react';
import {
  listarClientes,
  crearCliente,
  actualizarCliente,
  eliminarCliente,
} from '../../api/clientes';
import styles from './Clientes.module.css';

const FORM_VACIO = { nombre: '', email: '', telefono: '', empresa: '' };

const Clientes = () => {
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [modalAbierto, setModalAbierto] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [form, setForm] = useState(FORM_VACIO);
  const [guardando, setGuardando] = useState(false);

  const cargarClientes = async () => {
    setLoading(true);
    try {
      const data = await listarClientes();
      setClientes(data);
      setError(null);
    } catch (err) {
      setError('No se pudieron cargar los clientes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarClientes();
  }, []);

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
      } else {
        await crearCliente(form);
      }
      cerrarModal();
      cargarClientes();
    } catch (err) {
      setError('No se pudo guardar el cliente');
    } finally {
      setGuardando(false);
    }
  };

  const handleEliminar = async (id) => {
    if (!confirm('Seguro que quieres eliminar este cliente?')) return;
    try {
      await eliminarCliente(id);
      cargarClientes();
    } catch (err) {
      setError('No se pudo eliminar el cliente');
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Clientes</h1>
        <button className={styles.buttonPrimary} onClick={abrirModalCrear}>
          + Nuevo cliente
        </button>
      </div>

      {error && <div className={styles.error}>{error}</div>}

      {loading ? (
        <p className={styles.loadingText}>Cargando...</p>
      ) : clientes.length === 0 ? (
        <p className={styles.emptyText}>No hay clientes registrados todavia.</p>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Empresa</th>
              <th>Email</th>
              <th>Telefono</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {clientes.map((cliente) => (
              <tr key={cliente.id}>
                <td>{cliente.nombre}</td>
                <td>{cliente.empresa || '-'}</td>
                <td>{cliente.email || '-'}</td>
                <td>{cliente.telefono || '-'}</td>
                <td className={styles.actions}>
                  <button className={styles.linkButton} onClick={() => abrirModalEditar(cliente)}>
                    Editar
                  </button>
                  <button
                    className={`${styles.linkButton} ${styles.linkButtonDanger}`}
                    onClick={() => handleEliminar(cliente.id)}
                  >
                    Eliminar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {modalAbierto && (
        <div className={styles.overlay} onClick={cerrarModal}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h2 className={styles.modalTitle}>
              {editandoId ? 'Editar cliente' : 'Nuevo cliente'}
            </h2>
            <form onSubmit={handleSubmit} className={styles.form}>
              <div className={styles.field}>
                <label>Nombre</label>
                <input
                  type="text"
                  value={form.nombre}
                  onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                  required
                  autoFocus
                />
              </div>
              <div className={styles.field}>
                <label>Empresa</label>
                <input
                  type="text"
                  value={form.empresa}
                  onChange={(e) => setForm({ ...form, empresa: e.target.value })}
                />
              </div>
              <div className={styles.field}>
                <label>Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
              <div className={styles.field}>
                <label>Telefono</label>
                <input
                  type="text"
                  value={form.telefono}
                  onChange={(e) => setForm({ ...form, telefono: e.target.value })}
                />
              </div>
              <div className={styles.modalActions}>
                <button type="button" className={styles.buttonSecondary} onClick={cerrarModal}>
                  Cancelar
                </button>
                <button type="submit" className={styles.buttonPrimary} disabled={guardando}>
                  {guardando ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Clientes;