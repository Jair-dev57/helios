import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { Plus, Search, X, Power, PowerOff, ChevronRight } from 'lucide-react';
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
import styles from './Configuracion.module.css';

const FORM_VACIO = { nombre: '', email: '', username: '', cargo: '', telefono: '', password: '', rol: '' };

const FILTROS = [
  { id: 'todos', label: 'Todos' },
  { id: 'activos', label: 'Activos', color: 'var(--success)' },
  { id: 'inactivos', label: 'Desactivados', color: 'var(--text-muted)' },
];

const cumpleFiltro = (usuario, filtro) =>
  filtro === 'todos' || (filtro === 'activos' ? usuario.activo : !usuario.activo);

// "Hace 5 min", "Hoy, 9:12", "Ayer, 17:40", "2 sep"
const formatearAcceso = (iso) => {
  if (!iso) return 'Nunca';
  const fecha = new Date(iso);
  const minutos = Math.floor((Date.now() - fecha) / 60000);
  if (minutos < 1) return 'Ahora';
  if (minutos < 60) return `Hace ${minutos} min`;
  const hora = fecha.toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' });
  const hoy = new Date();
  const ayer = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - 1);
  if (fecha.toDateString() === hoy.toDateString()) return `Hoy, ${hora}`;
  if (fecha.toDateString() === ayer.toDateString()) return `Ayer, ${hora}`;
  return fecha.toLocaleDateString('es-CO', {
    day: 'numeric',
    month: 'short',
    year: fecha.getFullYear() === hoy.getFullYear() ? undefined : 'numeric',
  });
};

const formatearFecha = (iso) =>
  new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });

const TabUsuarios = () => {
  const { user: usuarioActual } = useAuth();
  const [usuarios, setUsuarios] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [filtro, setFiltro] = useState('todos');
  const [busqueda, setBusqueda] = useState('');
  const [filtroRol, setFiltroRol] = useState('');

  // Panel lateral: null = cerrado, 'nuevo' = crear, o el usuario que se edita
  const [panel, setPanel] = useState(null);
  const [form, setForm] = useState(FORM_VACIO);
  const [guardando, setGuardando] = useState(false);

  const cargarDatos = async () => {
    try {
      const [usuariosData, rolesData] = await Promise.all([listarUsuarios(), listarRoles()]);
      setUsuarios(usuariosData);
      setRoles(rolesData);
      setError(null);
    } catch {
      setError('No se pudieron cargar los usuarios');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarDatos();
  }, []);

  useEffect(() => {
    if (!panel) return;
    const alPresionar = (e) => e.key === 'Escape' && setPanel(null);
    window.addEventListener('keydown', alPresionar);
    return () => window.removeEventListener('keydown', alPresionar);
  }, [panel]);

  const abrirNuevo = () => {
    setForm({ ...FORM_VACIO, rol: roles.find((r) => !r.es_administrador)?.nombre || roles[0]?.nombre || '' });
    setPanel('nuevo');
  };

  const abrirUsuario = (usuario) => {
    setForm({
      nombre: usuario.nombre || '',
      email: usuario.email || '',
      username: usuario.username || '',
      cargo: usuario.cargo || '',
      telefono: usuario.telefono || '',
      password: '',
      rol: usuario.rol || roles[0]?.nombre || '',
    });
    setPanel(usuario);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setGuardando(true);
    try {
      if (panel === 'nuevo') {
        await crearUsuario(form);
        toast.success('Usuario creado');
      } else {
        // La contraseña solo se envia si el administrador escribio una nueva
        const { password, ...datosActualizar } = form;
        await actualizarUsuario(panel.id, password ? { ...datosActualizar, password } : datosActualizar);
        toast.success('Usuario actualizado');
      }
      setPanel(null);
      cargarDatos();
    } catch (err) {
      toast.error(mensajeError(err, 'No se pudo guardar el usuario'));
    } finally {
      setGuardando(false);
    }
  };

  const handleToggleActivo = async (usuario) => {
    try {
      const actualizado = await actualizarUsuario(usuario.id, { activo: !usuario.activo });
      setPanel(actualizado);
      cargarDatos();
      toast.success(usuario.activo ? 'Usuario desactivado' : 'Usuario reactivado');
    } catch {
      toast.error('No se pudo actualizar el usuario');
    }
  };

  const esAdmin = (nombreRol) => roles.find((r) => r.nombre === nombreRol)?.es_administrador;
  const texto = busqueda.trim().toLowerCase();
  const visibles = usuarios.filter(
    (u) =>
      cumpleFiltro(u, filtro) &&
      (!filtroRol || u.rol === filtroRol) &&
      [u.nombre, u.email, u.username, u.cargo].some((v) => v?.toLowerCase().includes(texto))
  );

  const editando = panel && panel !== 'nuevo' ? panel : null;
  const esYo = editando?.id === usuarioActual?.id;

  return (
    <div>
      <div className={styles.resumen}>
        {FILTROS.map((f) => (
          <button
            key={f.id}
            className={filtro === f.id ? styles.chipActivo : styles.chip}
            onClick={() => setFiltro(f.id)}
          >
            {f.color && <span className={styles.chipPunto} style={{ background: f.color }} />}
            {f.label}
            <strong>{usuarios.filter((u) => cumpleFiltro(u, f.id)).length}</strong>
          </button>
        ))}
      </div>

      <div className={styles.toolbar}>
        <label className={styles.buscador}>
          <Search size={16} />
          <input
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre, usuario o correo"
          />
        </label>
        <select
          className={styles.selectFiltro}
          value={filtroRol}
          onChange={(e) => setFiltroRol(e.target.value)}
          aria-label="Filtrar por rol"
        >
          <option value="">Todos los roles</option>
          {roles.map((r) => (
            <option key={r.id} value={r.nombre}>
              {r.nombre}
            </option>
          ))}
        </select>
        <button className={`${shared.btnPrimary} ${styles.toolbarDerecha}`} onClick={abrirNuevo}>
          <Plus size={16} className={styles.iconoBoton} />
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
          <table className={`${shared.table} ${styles.tablaUsuarios}`}>
            <thead>
              <tr>
                <th>Usuario</th>
                <th>Correo</th>
                <th>Rol</th>
                <th>Estado</th>
                <th>Último acceso</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {visibles.map((usuario) => (
                <tr
                  key={usuario.id}
                  className={editando?.id === usuario.id ? styles.filaSeleccionada : undefined}
                  onClick={() => abrirUsuario(usuario)}
                >
                  <td>
                    <div className={styles.usuarioCelda}>
                      <Avatar usuario={usuario} size={34} />
                      <div className={styles.usuarioTexto}>
                        <span className={styles.usuarioNombre}>
                          {usuario.nombre}
                          {usuario.id === usuarioActual?.id && <span className={styles.etiquetaTu}>Tú</span>}
                        </span>
                        <span className={styles.usuarioCargo}>
                          {[usuario.username && `@${usuario.username}`, usuario.cargo].filter(Boolean).join(' · ') ||
                            'Sin usuario ni cargo'}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td>{usuario.email}</td>
                  <td>
                    <span className={esAdmin(usuario.rol) ? styles.rolAdmin : styles.rol}>{usuario.rol}</span>
                  </td>
                  <td>
                    <span className={`${shared.badge} ${usuario.activo ? shared['badge-success'] : shared['badge-neutral']}`}>
                      {usuario.activo ? 'Activo' : 'Desactivado'}
                    </span>
                  </td>
                  <td className={styles.celdaTenue}>{formatearAcceso(usuario.ultimo_acceso)}</td>
                  <td className={styles.celdaFlecha}>
                    <ChevronRight size={16} />
                  </td>
                </tr>
              ))}
              {visibles.length === 0 && (
                <tr>
                  <td colSpan={6} className={styles.sinResultados}>
                    Ningún usuario coincide con la búsqueda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          <div className={styles.pieTabla}>
            {visibles.length} de {usuarios.length} usuarios · haz clic en una fila para ver el detalle
          </div>
        </div>
      )}

      {panel && (
        <>
          <div className={styles.panelFondo} onClick={() => setPanel(null)} />
          <aside className={styles.panel} aria-label={editando ? 'Detalle de usuario' : 'Nuevo usuario'}>
            <div className={styles.panelCabecera}>
              {editando ? (
                <>
                  <Avatar usuario={editando} size={56} />
                  <div className={styles.panelTitulo}>
                    <h2>{editando.nombre}</h2>
                    <span className={styles.usuarioCargo}>{editando.email}</span>
                    <div className={styles.panelEtiquetas}>
                      <span className={esAdmin(editando.rol) ? styles.rolAdmin : styles.rol}>{editando.rol}</span>
                      <span className={`${shared.badge} ${editando.activo ? shared['badge-success'] : shared['badge-neutral']}`}>
                        {editando.activo ? 'Activo' : 'Desactivado'}
                      </span>
                    </div>
                  </div>
                </>
              ) : (
                <div className={styles.panelTitulo}>
                  <h2>Nuevo usuario</h2>
                </div>
              )}
              <button className={styles.panelCerrar} onClick={() => setPanel(null)} aria-label="Cerrar">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className={styles.panelForm}>
              <div className={styles.panelCuerpo}>
                <section>
                  <h3 className={styles.panelSeccion}>Datos</h3>
                  <div className={`${shared.form} ${styles.grid}`}>
                    <div className={`${shared.field} ${styles.campoAncho}`}>
                      <label>Nombre completo</label>
                      <input
                        type="text"
                        value={form.nombre}
                        onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                        required
                        autoFocus={!editando}
                      />
                    </div>
                    <div className={shared.field}>
                      <label>Nombre de usuario</label>
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
                      <label>Cargo</label>
                      <input
                        type="text"
                        value={form.cargo}
                        onChange={(e) => setForm({ ...form, cargo: e.target.value })}
                        placeholder="ej. Diseñadora"
                      />
                    </div>
                    <div className={shared.field}>
                      <label>Correo electrónico</label>
                      <input
                        type="email"
                        value={form.email}
                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                        required
                        disabled={!!editando}
                      />
                    </div>
                    <div className={shared.field}>
                      <label>Teléfono</label>
                      <input
                        type="tel"
                        value={form.telefono}
                        onChange={(e) => setForm({ ...form, telefono: e.target.value })}
                      />
                    </div>
                  </div>
                </section>

                <section>
                  <h3 className={styles.panelSeccion}>Rol</h3>
                  <div className={styles.opcionesRol}>
                    {roles.map((r) => (
                      <label key={r.id} className={form.rol === r.nombre ? styles.opcionRolActiva : styles.opcionRol}>
                        <input
                          type="radio"
                          name="rol"
                          checked={form.rol === r.nombre}
                          onChange={() => setForm({ ...form, rol: r.nombre })}
                          disabled={esYo}
                        />
                        <span>
                          {r.nombre}
                          <small>{r.es_administrador ? 'Acceso total a todas las secciones' : 'Acceso según sus permisos'}</small>
                        </span>
                      </label>
                    ))}
                  </div>
                  {esYo && <p className={styles.ayuda}>No puedes cambiar tu propio rol.</p>}
                </section>

                <section>
                  <h3 className={styles.panelSeccion}>Acceso</h3>
                  <div className={shared.form}>
                    <div className={shared.field}>
                      <label>{editando ? 'Restablecer contraseña (dejar vacío para no cambiarla)' : 'Contraseña'}</label>
                      <input
                        type="password"
                        autoComplete="new-password"
                        value={form.password}
                        onChange={(e) => setForm({ ...form, password: e.target.value })}
                        required={!editando}
                        minLength={6}
                      />
                    </div>
                    {editando && !esYo && (
                      <button
                        type="button"
                        className={editando.activo ? styles.accionPeligro : styles.accion}
                        onClick={() => handleToggleActivo(editando)}
                      >
                        {editando.activo ? <PowerOff size={16} /> : <Power size={16} />}
                        <span>
                          {editando.activo ? 'Desactivar usuario' : 'Reactivar usuario'}
                          <small>
                            {editando.activo
                              ? 'No podrá iniciar sesión; conserva su historial'
                              : 'Podrá volver a iniciar sesión'}
                          </small>
                        </span>
                      </button>
                    )}
                  </div>
                </section>

                {editando && (
                  <section>
                    <h3 className={styles.panelSeccion}>Actividad</h3>
                    <dl className={styles.datosActividad}>
                      <dt>Último acceso</dt>
                      <dd>{formatearAcceso(editando.ultimo_acceso)}</dd>
                      <dt>Creado</dt>
                      <dd>{formatearFecha(editando.created_at)}</dd>
                    </dl>
                  </section>
                )}
              </div>

              <div className={styles.panelPie}>
                <button type="button" className={shared.btnSecondary} onClick={() => setPanel(null)}>
                  Cancelar
                </button>
                <button type="submit" className={shared.btnPrimary} disabled={guardando}>
                  {guardando ? 'Guardando...' : editando ? 'Guardar cambios' : 'Crear usuario'}
                </button>
              </div>
            </form>
          </aside>
        </>
      )}
    </div>
  );
};

export default TabUsuarios;
