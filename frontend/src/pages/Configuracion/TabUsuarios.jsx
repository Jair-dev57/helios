import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { Plus, Search, X, Power, PowerOff, ChevronRight, Check, ShieldCheck } from 'lucide-react';
import {
  listarUsuarios,
  crearUsuario,
  actualizarUsuario,
} from '../../api/usuarios';
import { listarEspacios, obtenerAccesoBasico } from '../../api/espacios';
import { SECCIONES, origenPermisos } from './secciones';
import { mensajeError } from '../../api/client';
import { useAuth } from '../../hooks/useAuth';
import Avatar from '../../components/Avatar';
import shared from '../../styles/shared.module.css';
import styles from './Configuracion.module.css';

const FORM_VACIO = {
  nombre: '', email: '', username: '', cargo: '', telefono: '', password: '', es_administrador: false, equipo_ids: [],
};

// filtro: 'todos', 'admin', 'sin' (sin equipo), 'inactivos' o el id de un equipo
const sinEquipo = (u) => !u.es_administrador && !u.equipo_ids?.length;
const cumpleFiltro = (usuario, filtro) => {
  if (filtro === 'todos') return true;
  if (filtro === 'admin') return usuario.es_administrador;
  if (filtro === 'sin') return usuario.activo && sinEquipo(usuario);
  if (filtro === 'inactivos') return !usuario.activo;
  return usuario.equipo_ids?.includes(filtro);
};

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
  const [equipos, setEquipos] = useState([]);
  const [basico, setBasico] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [filtro, setFiltro] = useState('todos');
  const [busqueda, setBusqueda] = useState('');

  // Panel lateral: null = cerrado, 'nuevo' = crear, o el usuario que se edita
  const [panel, setPanel] = useState(null);
  const [form, setForm] = useState(FORM_VACIO);
  const [guardando, setGuardando] = useState(false);

  const cargarDatos = async () => {
    try {
      const [usuariosData, espacios, basicoData] = await Promise.all([
        listarUsuarios(),
        listarEspacios().catch(() => ({ equipo: [] })),
        obtenerAccesoBasico().catch(() => []),
      ]);
      setUsuarios(usuariosData);
      setEquipos(espacios.equipo);
      setBasico(basicoData);
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
    // Desde el filtro de un equipo, la persona nueva entra a ese equipo
    setForm({ ...FORM_VACIO, equipo_ids: typeof filtro === 'number' ? [filtro] : [] });
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
      es_administrador: usuario.es_administrador,
      equipo_ids: usuario.equipo_ids || [],
    });
    setPanel(usuario);
  };

  const alternarEquipo = (id) => setForm((actual) => ({
    ...actual,
    equipo_ids: actual.equipo_ids.includes(id) ? actual.equipo_ids.filter((x) => x !== id) : [...actual.equipo_ids, id],
  }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setGuardando(true);
    try {
      if (panel === 'nuevo') {
        await crearUsuario(form);
        toast.success('Persona creada');
      } else {
        // La contraseña solo se envia si el administrador escribio una nueva
        const { password, ...datosActualizar } = form;
        await actualizarUsuario(panel.id, password ? { ...datosActualizar, password } : datosActualizar);
        toast.success('Cambios guardados');
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

  const texto = busqueda.trim().toLowerCase();
  const visibles = usuarios.filter(
    (u) =>
      cumpleFiltro(u, filtro) &&
      [u.nombre, u.email, u.username, u.cargo].some((v) => v?.toLowerCase().includes(texto))
  );

  const editando = panel && panel !== 'nuevo' ? panel : null;
  const esYo = editando?.id === usuarioActual?.id;
  const equipoDe = (id) => equipos.find((e) => e.id === id);
  const chipsEquipos = (u) => {
    if (u.es_administrador) {
      return <span className={styles.etiquetaAdmin}><ShieldCheck size={13} />Administrador</span>;
    }
    if (!u.equipo_ids?.length) return <span className={styles.etiquetaSinEquipo}>Sin equipo</span>;
    return u.equipo_ids.map(equipoDe).filter(Boolean).map((e) => (
      <span key={e.id} className={styles.etiquetaEquipo} style={{ '--c': e.color || 'var(--accent)' }}><i />{e.nombre}</span>
    ));
  };
  const chipsFiltro = [
    { id: 'todos', label: 'Todas' },
    { id: 'admin', label: 'Administradores', color: 'var(--accent)' },
    ...equipos.map((e) => ({ id: e.id, label: e.nombre, color: e.color || 'var(--accent)' })),
    { id: 'sin', label: 'Sin equipo', color: 'var(--warning)' },
    { id: 'inactivos', label: 'Desactivadas', color: 'var(--text-muted)' },
  ].filter((f) => typeof f.id !== 'number' || usuarios.some((u) => cumpleFiltro(u, f.id)));
  // Lo que puede usar la persona del panel (con lo que esta marcando, sin guardar)
  const origen = panel ? origenPermisos(form, equipos, basico) : {};

  return (
    <div>
      <div className={styles.resumen}>
        {chipsFiltro.map((f) => (
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
        <button className={`${shared.btnPrimary} ${styles.toolbarDerecha}`} onClick={abrirNuevo}>
          <Plus size={16} className={styles.iconoBoton} />
          Nueva persona
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
                <th>Persona</th>
                <th>Correo</th>
                <th>Equipos</th>
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
                    <div className={styles.etiquetas}>{chipsEquipos(usuario)}</div>
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
                    Nadie coincide con la búsqueda o el filtro.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          <div className={styles.pieTabla}>
            {visibles.length} de {usuarios.length} personas · haz clic en una fila para ver el detalle
          </div>
        </div>
      )}

      {panel && (
        <>
          <div className={styles.panelFondo} onClick={() => setPanel(null)} />
          <aside className={styles.panel} aria-label={editando ? 'Detalle de la persona' : 'Nueva persona'}>
            <div className={styles.panelCabecera}>
              {editando ? (
                <>
                  <Avatar usuario={editando} size={56} />
                  <div className={styles.panelTitulo}>
                    <h2>{editando.nombre}</h2>
                    <span className={styles.usuarioCargo}>{editando.email}</span>
                    <div className={styles.panelEtiquetas}>
                      {chipsEquipos(editando)}
                      <span className={`${shared.badge} ${editando.activo ? shared['badge-success'] : shared['badge-neutral']}`}>
                        {editando.activo ? 'Activo' : 'Desactivado'}
                      </span>
                    </div>
                  </div>
                </>
              ) : (
                <div className={styles.panelTitulo}>
                  <h2>Nueva persona</h2>
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
                  <h3 className={styles.panelSeccion}>Permisos</h3>
                  <label className={styles.interruptorFila}>
                    <span>
                      Administrador
                      <small>Acceso total a todo, sin importar sus equipos</small>
                    </span>
                    <span className={styles.interruptor}>
                      <input
                        type="checkbox"
                        checked={form.es_administrador}
                        onChange={(e) => setForm({ ...form, es_administrador: e.target.checked })}
                        disabled={esYo}
                        aria-label="Administrador"
                      />
                      <span />
                    </span>
                  </label>
                  {esYo && <p className={styles.ayuda}>No puedes quitarte el acceso de administrador.</p>}

                  <div className={styles.opcionesEquipo} role="group" aria-label="Equipos">
                    {equipos.map((e) => {
                      const marcado = form.equipo_ids.includes(e.id);
                      return (
                        <button
                          key={e.id}
                          type="button"
                          role="checkbox"
                          aria-checked={marcado}
                          className={styles.opcionEquipo}
                          onClick={() => alternarEquipo(e.id)}
                          disabled={form.es_administrador}
                        >
                          <span className={styles.casilla}>{marcado && <Check size={12} strokeWidth={3} />}</span>
                          <span className={styles.puntoEquipo} style={{ background: e.color || 'var(--accent)' }} />
                          <span className={styles.nombreEquipo}>{e.nombre}</span>
                          <span className={styles.usuarioCargo}>
                            {e.secciones.filter((x) => !basico.includes(x)).length
                              ? `+${e.secciones.filter((x) => !basico.includes(x)).length} secciones`
                              : 'solo archivos'}
                          </span>
                        </button>
                      );
                    })}
                    {equipos.length === 0 && <p className={styles.ayuda}>Aún no hay equipos. Créalos en la pestaña Equipos.</p>}
                  </div>
                  {!form.es_administrador && !form.equipo_ids.length && (
                    <p className={styles.ayuda}>Sin equipo: solo tendrá el Acceso básico.</p>
                  )}
                </section>

                <section>
                  <h3 className={styles.panelSeccion}>
                    Qué puede usar
                    <span className={styles.usuarioCargo}>{Object.keys(origen).length} de {SECCIONES.length}</span>
                  </h3>
                  <ul className={styles.listaPermisos}>
                    {SECCIONES.map(({ seccion, label }) => {
                      const de = origen[seccion];
                      return (
                        <li key={seccion} className={de ? undefined : styles.permisoNo}>
                          {de ? <Check size={14} className={styles.permisoSi} /> : <X size={14} />}
                          <span className={styles.nombreEquipo}>{label}</span>
                          {de?.map((d) => (d === 'admin'
                            ? <span key={d} className={styles.etiquetaAdmin}>Admin</span>
                            : d === 'basico'
                              ? <span key={d} className={styles.etiquetaSinEquipo}>Básico</span>
                              : <span key={d} className={styles.etiquetaEquipo} style={{ '--c': equipoDe(d)?.color || 'var(--accent)' }}><i />{equipoDe(d)?.nombre}</span>))}
                        </li>
                      );
                    })}
                  </ul>
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
                          {editando.activo ? 'Desactivar persona' : 'Reactivar persona'}
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
                  {guardando ? 'Guardando...' : editando ? 'Guardar cambios' : 'Crear persona'}
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
