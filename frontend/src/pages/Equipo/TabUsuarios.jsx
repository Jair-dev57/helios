import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { Plus, Pencil, Power, PowerOff } from 'lucide-react';
import {
  listarUsuarios,
  crearUsuario,
  actualizarUsuario,
} from '../../api/usuarios';
import { listarRoles } from '../../api/roles';
import { mensajeError } from '../../api/client';
import { useAuth } from '../../hooks/useAuth';
import Avatar from '../../components/Avatar';
import shared from '../../styles/shared.module.css';
import styles from './Equipo.module.css';

const FORM_VACIO = { nombre: '', email: '', username: '', cargo: '', telefono: '', password: '', rol: '' };

const TabUsuarios = () => {
  const { user: usuarioActual } = useAuth();
  const [usuarios, setUsuarios] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [modalAbierto, setModalAbierto] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [form, setForm] = useState(FORM_VACIO);
  const [guardando, setGuardando] = useState(false);

  const cargarDatos = async () => {
    setLoading(true);
    try {
      const [usuariosData, rolesData] = await Promise.all([listarUsuarios(), listarRoles()]);
      setUsuarios(usuariosData);
      setRoles(rolesData);
      setError(null);
    } catch (err) {
      setError('No se pudieron cargar los usuarios');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarDatos();
  }, []);

  const abrirModalCrear = () => {
    setEditandoId(null);
    setForm({ ...FORM_VACIO, rol: roles[0]?.nombre || '' });
    setModalAbierto(true);
  };

  const abrirModalEditar = (usuario) => {
    setEditandoId(usuario.id);
    setForm({
      nombre: usuario.nombre || '',
      email: usuario.email || '',
      username: usuario.username || '',
      cargo: usuario.cargo || '',
      telefono: usuario.telefono || '',
      password: '',
      rol: usuario.rol || roles[0]?.nombre || '',
    });
    setModalAbierto(true);
  };

  const cerrarModal = () => {
    setModalAbierto(false);
    setEditandoId(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setGuardando(true);
    try {
      if (editandoId) {
        // La contraseña solo se envia si el administrador escribio una nueva
        const { password, ...datosActualizar } = form;
        await actualizarUsuario(editandoId, password ? { ...datosActualizar, password } : datosActualizar);
        toast.success('Usuario actualizado');
      } else {
        await crearUsuario(form);
        toast.success('Usuario creado');
      }
      cerrarModal();
      cargarDatos();
    } catch (err) {
      toast.error(mensajeError(err, 'No se pudo guardar el usuario'));
    } finally {
      setGuardando(false);
    }
  };

  const handleToggleActivo = async (usuario) => {
    try {
      await actualizarUsuario(usuario.id, { activo: !usuario.activo });
      cargarDatos();
      toast.success(usuario.activo ? 'Usuario desactivado' : 'Usuario activado');
    } catch (err) {
      toast.error('No se pudo actualizar el usuario');
    }
  };

  return (
    <div>
      <div className={styles.sectionHeader}>
        <button className={shared.btnPrimary} onClick={abrirModalCrear}>
          <Plus size={16} style={{ marginRight: 6, verticalAlign: -3 }} />
          Nuevo usuario
        </button>
      </div>

      {error && <div className={shared.errorBanner}>{error}</div>}

      {loading ? (
        <p className={shared.loadingText}>Cargando...</p>
      ) : usuarios.length === 0 ? (
        <p className={shared.emptyText}>No hay usuarios registrados todavia.</p>
      ) : (
        <div className={shared.tableWrapper}>
          <table className={shared.table}>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Usuario</th>
                <th>Email</th>
                <th>Rol</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {usuarios.map((usuario) => (
                <tr key={usuario.id}>
                  <td>
                    <div className={styles.usuarioCelda}>
                      <Avatar usuario={usuario} size={30} />
                      <div className={styles.usuarioTexto}>
                        <span>{usuario.nombre}</span>
                        {usuario.cargo && <span className={styles.usuarioCargo}>{usuario.cargo}</span>}
                      </div>
                    </div>
                  </td>
                  <td>{usuario.username ? `@${usuario.username}` : '—'}</td>
                  <td>{usuario.email}</td>
                  <td>
                    <span className={`${shared.badge} ${shared['badge-neutral']}`}>{usuario.rol}</span>
                  </td>
                  <td>
                    <span className={`${shared.badge} ${usuario.activo ? shared['badge-success'] : shared['badge-danger']}`}>
                      {usuario.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td>
                    <div className={shared.iconBtnGroup}>
                      <button
                        className={shared.iconBtn}
                        onClick={() => abrirModalEditar(usuario)}
                        title="Editar"
                        aria-label="Editar usuario"
                      >
                        <Pencil size={15} />
                      </button>
                      {usuario.id !== usuarioActual?.id && (
                        <button
                          className={shared.iconBtn}
                          onClick={() => handleToggleActivo(usuario)}
                          title={usuario.activo ? 'Desactivar' : 'Activar'}
                          aria-label={usuario.activo ? 'Desactivar usuario' : 'Activar usuario'}
                        >
                          {usuario.activo ? <PowerOff size={15} /> : <Power size={15} />}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalAbierto && (
        <div className={shared.overlay} onClick={cerrarModal}>
          <div className={shared.modal} onClick={(e) => e.stopPropagation()}>
            <h2 className={shared.modalTitle}>{editandoId ? 'Editar usuario' : 'Nuevo usuario'}</h2>
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
                <label>Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  required
                  disabled={!!editandoId}
                />
              </div>
              <div className={shared.field}>
                <label>Nombre de usuario (opcional)</label>
                <input
                  type="text"
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                  placeholder="ej. maria.martinez"
                  pattern="[A-Za-z0-9._\-]{3,30}"
                  title="3 a 30 caracteres: letras, numeros, punto, guion o guion bajo"
                />
              </div>
              <div className={shared.field}>
                <label>Cargo (opcional)</label>
                <input
                  type="text"
                  value={form.cargo}
                  onChange={(e) => setForm({ ...form, cargo: e.target.value })}
                />
              </div>
              <div className={shared.field}>
                <label>Teléfono (opcional)</label>
                <input
                  type="tel"
                  value={form.telefono}
                  onChange={(e) => setForm({ ...form, telefono: e.target.value })}
                />
              </div>
              <div className={shared.field}>
                <label>{editandoId ? 'Nueva contraseña (dejar vacío para no cambiarla)' : 'Contraseña'}</label>
                <input
                  type="password"
                  autoComplete="new-password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  required={!editandoId}
                  minLength={6}
                />
              </div>
              <div className={shared.field}>
                <label>Rol</label>
                <select value={form.rol} onChange={(e) => setForm({ ...form, rol: e.target.value })}>
                  {roles.map((r) => (
                    <option key={r.id} value={r.nombre}>
                      {r.nombre}
                    </option>
                  ))}
                </select>
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
    </div>
  );
};

export default TabUsuarios;
