import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { Plus, Pencil, Trash2, Shield as ShieldIcon, LayoutDashboard, Search, FolderKanban, FileText, ListTodo, Users, UserCog, Shield, History, Building2 } from 'lucide-react';
import {
  listarRoles,
  crearRol,
  actualizarRol,
  eliminarRol,
  obtenerSeccionesRol,
  actualizarSeccionesRol,
} from '../../api/roles';
import shared from '../../styles/shared.module.css';
import styles from './Equipo.module.css';

const FORM_VACIO = { nombre: '', es_administrador: false };

const GRUPOS_SECCIONES = [
  {
    titulo: 'General',
    items: [
      { seccion: 'dashboard', label: 'Dashboard', Icon: LayoutDashboard },
      { seccion: 'busqueda', label: 'Búsqueda global', Icon: Search },
    ],
  },
  {
    titulo: 'Trabajo',
    items: [
      { seccion: 'proyectos', label: 'Proyectos', Icon: FolderKanban },
      { seccion: 'documentos', label: 'Documentos', Icon: FileText },
      { seccion: 'tareas', label: 'Tareas', Icon: ListTodo },
      { seccion: 'clientes', label: 'Clientes', Icon: Users },
    ],
  },
  {
    titulo: 'Administración',
    items: [
      { seccion: 'usuarios', label: 'Usuarios', Icon: UserCog },
      { seccion: 'roles', label: 'Roles y permisos', Icon: Shield },
      { seccion: 'historial', label: 'Historial', Icon: History },
      { seccion: 'configuracion', label: 'Datos de la empresa', Icon: Building2 },
    ],
  },
];

const TabRoles = () => {
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);

  const [modalAbierto, setModalAbierto] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [form, setForm] = useState(FORM_VACIO);
  const [guardando, setGuardando] = useState(false);

  const [permisosAbierto, setPermisosAbierto] = useState(false);
  const [rolPermisos, setRolPermisos] = useState(null);
  const [seccionesSeleccionadas, setSeccionesSeleccionadas] = useState([]);
  const [guardandoPermisos, setGuardandoPermisos] = useState(false);

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

  const abrirPermisos = async (rol) => {
    setRolPermisos(rol);
    setPermisosAbierto(true);
    if (!rol.es_administrador) {
      try {
        const secciones = await obtenerSeccionesRol(rol.id);
        setSeccionesSeleccionadas(secciones);
      } catch (err) {
        toast.error('No se pudieron cargar los permisos');
      }
    }
  };

  const cerrarPermisos = () => {
    setPermisosAbierto(false);
    setRolPermisos(null);
    setSeccionesSeleccionadas([]);
  };

  const toggleSeccion = (seccion) => {
    setSeccionesSeleccionadas((prev) =>
      prev.includes(seccion) ? prev.filter((s) => s !== seccion) : [...prev, seccion]
    );
  };

  const guardarPermisos = async () => {
    setGuardandoPermisos(true);
    try {
      await actualizarSeccionesRol(rolPermisos.id, seccionesSeleccionadas);
      toast.success('Permisos actualizados');
      cerrarPermisos();
    } catch (err) {
      toast.error('No se pudieron guardar los permisos');
    } finally {
      setGuardandoPermisos(false);
    }
  };

  return (
    <div>
      <div className={styles.sectionHeader}>
        <button className={shared.btnPrimary} onClick={abrirModalCrear}>
          <Plus size={16} style={{ marginRight: 6, verticalAlign: -3 }} />
          Nuevo rol
        </button>
      </div>

      {loading ? (
        <p className={shared.loadingText}>Cargando...</p>
      ) : roles.length === 0 ? (
        <p className={shared.emptyText}>No hay roles registrados todavia.</p>
      ) : (
        <div className={shared.tableWrapper}>
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
                  <td>
                    <div className={shared.iconBtnGroup}>
                      <button
                        className={shared.iconBtn}
                        onClick={() => abrirPermisos(rol)}
                        title="Permisos"
                        aria-label="Ver permisos del rol"
                      >
                        <ShieldIcon size={15} />
                      </button>
                      <button
                        className={shared.iconBtn}
                        onClick={() => abrirModalEditar(rol)}
                        title="Editar"
                        aria-label="Editar rol"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        className={`${shared.iconBtn} ${shared.iconBtnDanger}`}
                        onClick={() => handleEliminar(rol.id)}
                        title="Eliminar"
                        aria-label="Eliminar rol"
                      >
                        <Trash2 size={15} />
                      </button>
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

      {permisosAbierto && (
        <div className={shared.overlay} onClick={cerrarPermisos}>
          <div className={shared.modal} onClick={(e) => e.stopPropagation()} style={{ maxWidth: 460 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <h2 className={shared.modalTitle} style={{ margin: 0 }}>Permisos del rol</h2>
              <span className={`${shared.badge} ${shared['badge-neutral']}`}>{rolPermisos?.nombre}</span>
            </div>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: '0.4rem 0 1.1rem' }}>
              Elige a que secciones puede entrar este rol.
            </p>

            {rolPermisos?.es_administrador ? (
              <p className={shared.emptyText}>Este rol tiene acceso total, no necesita configurar permisos.</p>
            ) : (
              <div>
                {GRUPOS_SECCIONES.map((grupo) => (
                  <div key={grupo.titulo} style={{ marginBottom: 16 }}>
                    <p style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', margin: '0 0 6px' }}>
                      {grupo.titulo}
                    </p>
                    {grupo.items.map(({ seccion, label, Icon }, i) => (
                      <label
                        key={seccion}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          padding: '0.5rem 0.2rem',
                          borderBottom: i < grupo.items.length - 1 ? '1px solid var(--border)' : 'none',
                          cursor: 'pointer',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={seccionesSeleccionadas.includes(seccion)}
                          onChange={() => toggleSeccion(seccion)}
                        />
                        <Icon size={16} style={{ color: 'var(--text-secondary)' }} />
                        <span style={{ fontSize: '0.87rem' }}>{label}</span>
                      </label>
                    ))}
                  </div>
                ))}
              </div>
            )}

            <div className={shared.modalActions}>
              <button type="button" className={shared.btnSecondary} onClick={cerrarPermisos}>
                Cancelar
              </button>
              {!rolPermisos?.es_administrador && (
                <button
                  type="button"
                  className={shared.btnPrimary}
                  onClick={guardarPermisos}
                  disabled={guardandoPermisos}
                >
                  {guardandoPermisos ? 'Guardando...' : 'Guardar permisos'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TabRoles;
