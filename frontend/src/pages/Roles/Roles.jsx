import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { listarRoles, crearRol, actualizarRol, eliminarRol } from '../../api/roles';
import PageContainer from '../../components/PageContainer';
import shared from '../../styles/shared.module.css';
import styles from './Roles.module.css';

const FORM_VACIO = { nombre: '', es_administrador: false };

const Roles = () => {
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [form, setForm] = useState(FORM_VACIO);
  const [guardando, setGuardando] = useState(false);

  const cargarRoles = async () => {
    setLoading(true);
    try {
      setRoles(await listarRoles());
    } catch (err) {
      toast.error('No se pudieron cargar los roles');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarRoles();
  }, []);

  const abrirModalCrear = () => {
    setEditandoId(null);
    setForm(FORM_VACIO);
    setModalAbierto(true);
  };

  const abrirModalEditar = (rol) => {
    setEditandoId(rol.id);
    setForm({ nombre: rol.nombre, es_administrador: rol.es_administrador });
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
        await actualizarRol(editandoId, form);
        toast.success('Rol actualizado');
      } else {
        await crearRol(form);
        toast.success('Rol creado');
      }
      cerrarModal();
      cargarRoles();
    } catch (err) {
      toast.error('No se pudo guardar el rol');
    } finally {
      setGuardando(false);
    }
  };

  const handleEliminar = async (id) => {
    if (!confirm('Seguro que quieres eliminar este rol?')) return;
    try {
      await eliminarRol(id);
      cargarRoles();
      toast.success('Rol eliminado');
    } catch (err) {
      toast.error('No se pudo eliminar el rol');
    }
  };

  return (
    <PageContainer>
      <div className={styles.header}>
        <h1 className={styles.title}>Roles</h1>
        <button className={shared.btnPrimary} onClick={abrirModalCrear}>
          + Nuevo rol
        </button>
      </div>

      {loading ? (
        <p className={shared.loadingText}>Cargando...</p>
      ) : roles.length === 0 ? (
        <p className={shared.emptyText}>No hay roles registrados todavia.</p>
      ) : (
        <table className={shared.table}>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Acceso total</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {roles.map((rol) => (
              <tr key={rol.id}>
                <td>{rol.nombre}</td>
                <td>
                  <span className={`${shared.badge} ${rol.es_administrador ? shared['badge-success'] : shared['badge-neutral']}`}>
                    {rol.es_administrador ? 'Si' : 'No'}
                  </span>
                </td>
                <td className={shared.tableActions}>
                  <button className={shared.linkBtn} onClick={() => abrirModalEditar(rol)}>
                    Editar
                  </button>
                  <button
                    className={`${shared.linkBtn} ${shared.linkBtnDanger}`}
                    onClick={() => handleEliminar(rol.id)}
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
        <div className={shared.overlay} onClick={cerrarModal}>
          <div className={shared.modal} onClick={(e) => e.stopPropagation()}>
            <h2 className={shared.modalTitle}>{editandoId ? 'Editar rol' : 'Nuevo rol'}</h2>
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
                <label>
                  <input
                    type="checkbox"
                    checked={form.es_administrador}
                    onChange={(e) => setForm({ ...form, es_administrador: e.target.checked })}
                    style={{ marginRight: 8 }}
                  />
                  Acceso total (como gerente)
                </label>
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

export default Roles;
