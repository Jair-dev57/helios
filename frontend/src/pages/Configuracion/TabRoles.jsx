import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { Plus, Pencil, Trash2, Copy, Shield as ShieldIcon, Search, FolderKanban, FileText, ListTodo, ListChecks, CalendarDays, Activity, FolderOpen, Users, UserCog, Shield, History, Building2 } from 'lucide-react';
import {
  listarRoles,
  crearRol,
  actualizarRol,
  eliminarRol,
  obtenerSeccionesRol,
  actualizarSeccionesRol,
} from '../../api/roles';
import { listarUsuarios } from '../../api/usuarios';
import Avatar from '../../components/Avatar';
import shared from '../../styles/shared.module.css';
import styles from './Configuracion.module.css';

const GRUPOS_SECCIONES = [
  {
    titulo: 'General',
    items: [
      { seccion: 'busqueda', label: 'Búsqueda global', descripcion: 'Buscar en toda la aplicación', Icon: Search },
    ],
  },
  {
    titulo: 'Trabajo',
    items: [
      { seccion: 'mis_tareas', label: 'Mis tareas', descripcion: 'Tareas asignadas al usuario', Icon: ListChecks },
      { seccion: 'calendario', label: 'Calendario', descripcion: 'Fechas y entregas', Icon: CalendarDays },
      { seccion: 'actividad', label: 'Actividad', descripcion: 'Movimientos del equipo', Icon: Activity },
      { seccion: 'archivos', label: 'Archivos', descripcion: 'Mis archivos y Áreas (requiere Documentos)', Icon: FolderOpen },
      { seccion: 'proyectos', label: 'Proyectos', descripcion: 'Ver y editar proyectos', Icon: FolderKanban },
      { seccion: 'documentos', label: 'Documentos', descripcion: 'Documentos de los proyectos', Icon: FileText },
      { seccion: 'tareas', label: 'Tareas', descripcion: 'Todas las tareas', Icon: ListTodo },
      { seccion: 'clientes', label: 'Clientes', descripcion: 'Directorio de clientes', Icon: Users },
    ],
  },
  {
    titulo: 'Administración',
    items: [
      { seccion: 'usuarios', label: 'Usuarios', descripcion: 'Crear y editar usuarios', Icon: UserCog },
      { seccion: 'roles', label: 'Roles y permisos', descripcion: 'Definir qué ve cada rol', Icon: Shield },
      { seccion: 'historial', label: 'Historial', descripcion: 'Registro de cambios', Icon: History },
      { seccion: 'configuracion', label: 'Datos de la empresa', descripcion: 'Nombre, logo y datos de contacto', Icon: Building2 },
    ],
  },
];

const TOTAL_SECCIONES = GRUPOS_SECCIONES.reduce((n, g) => n + g.items.length, 0);

const mismasSecciones = (a, b) => a.length === b.length && a.every((s) => b.includes(s));

const Interruptor = ({ checked, onChange, disabled, label }) => (
  <span className={styles.interruptor}>
    <input type="checkbox" checked={checked} onChange={onChange} disabled={disabled} aria-label={label} />
    <span />
  </span>
);

const TabRoles = () => {
  const [roles, setRoles] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [seleccionId, setSeleccionId] = useState(null);

  // Permisos del rol seleccionado: lo guardado y lo que se esta editando
  const [guardado, setGuardado] = useState({ total: false, secciones: [] });
  const [total, setTotal] = useState(false);
  const [secciones, setSecciones] = useState([]);
  const [cargandoPermisos, setCargandoPermisos] = useState(false);
  const [guardandoPermisos, setGuardandoPermisos] = useState(false);

  // Modal para crear o renombrar
  const [modal, setModal] = useState(null);
  const [nombre, setNombre] = useState('');
  const [guardando, setGuardando] = useState(false);

  const cargarRoles = async (seleccionar) => {
    try {
      const data = await listarRoles();
      setRoles(data);
      setSeleccionId((actual) => seleccionar ?? (data.some((r) => r.id === actual) ? actual : data[0]?.id ?? null));
    } catch {
      toast.error('No se pudieron cargar los roles');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarRoles();
    // Los miembros de cada rol son informativos: sin permiso de Usuarios simplemente no se muestran
    listarUsuarios().then(setUsuarios).catch(() => {});
  }, []);

  const rol = roles.find((r) => r.id === seleccionId);

  useEffect(() => {
    if (!rol) return;
    let vigente = true;
    setCargandoPermisos(true);
    obtenerSeccionesRol(rol.id)
      .then((data) => {
        if (!vigente) return;
        setGuardado({ total: rol.es_administrador, secciones: data });
        setTotal(rol.es_administrador);
        setSecciones(data);
      })
      .catch(() => vigente && toast.error('No se pudieron cargar los permisos'))
      .finally(() => vigente && setCargandoPermisos(false));
    return () => {
      vigente = false;
    };
  }, [rol?.id, rol?.es_administrador]);

  const hayCambios = total !== guardado.total || (!total && !mismasSecciones(secciones, guardado.secciones));
  const miembros = rol ? usuarios.filter((u) => u.rol === rol.nombre) : [];

  const toggleSeccion = (seccion) => {
    setSecciones((prev) => (prev.includes(seccion) ? prev.filter((s) => s !== seccion) : [...prev, seccion]));
  };

  const toggleGrupo = (grupo) => {
    const claves = grupo.items.map((i) => i.seccion);
    const todas = claves.every((s) => secciones.includes(s));
    setSecciones((prev) => (todas ? prev.filter((s) => !claves.includes(s)) : [...new Set([...prev, ...claves])]));
  };

  const descartar = () => {
    setTotal(guardado.total);
    setSecciones(guardado.secciones);
  };

  const guardarPermisos = async () => {
    setGuardandoPermisos(true);
    try {
      if (total !== guardado.total) await actualizarRol(rol.id, { es_administrador: total });
      if (!total) await actualizarSeccionesRol(rol.id, secciones);
      setGuardado({ total, secciones });
      toast.success('Permisos actualizados');
      cargarRoles();
    } catch {
      toast.error('No se pudieron guardar los permisos');
    } finally {
      setGuardandoPermisos(false);
    }
  };

  const abrirModal = (tipo) => {
    setNombre(tipo === 'renombrar' ? rol.nombre : '');
    setModal(tipo);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setGuardando(true);
    try {
      if (modal === 'renombrar') {
        await actualizarRol(rol.id, { nombre });
        toast.success('Rol renombrado');
        cargarRoles();
        listarUsuarios().then(setUsuarios).catch(() => {});
      } else {
        const nuevo = await crearRol({ nombre, es_administrador: false });
        toast.success('Rol creado');
        cargarRoles(nuevo.id);
      }
      setModal(null);
    } catch {
      toast.error('No se pudo guardar el rol');
    } finally {
      setGuardando(false);
    }
  };

  const duplicar = async () => {
    try {
      const copia = await crearRol({ nombre: `${rol.nombre} (copia)`.slice(0, 50), es_administrador: total });
      if (!total) await actualizarSeccionesRol(copia.id, secciones);
      toast.success('Rol duplicado');
      cargarRoles(copia.id);
    } catch {
      toast.error('No se pudo duplicar el rol');
    }
  };

  const handleEliminar = async () => {
    const aviso = miembros.length
      ? ` ${miembros.length} ${miembros.length === 1 ? 'usuario lo tiene' : 'usuarios lo tienen'} asignado.`
      : '';
    if (!confirm(`¿Eliminar el rol «${rol.nombre}»?${aviso}`)) return;
    try {
      await eliminarRol(rol.id);
      toast.success('Rol eliminado');
      cargarRoles(roles.find((r) => r.id !== rol.id)?.id ?? null);
    } catch {
      toast.error('No se pudo eliminar el rol');
    }
  };

  if (loading) return <p className={shared.loadingText}>Cargando...</p>;

  return (
    <div className={styles.rolesLayout}>
      <div className={`${shared.card} ${styles.listaRoles}`}>
        {roles.map((r) => (
          <button
            key={r.id}
            className={r.id === seleccionId ? styles.itemRolActivo : styles.itemRol}
            onClick={() => setSeleccionId(r.id)}
          >
            <ShieldIcon size={16} />
            <span className={styles.itemRolNombre}>{r.nombre}</span>
            <span className={styles.itemRolCuenta}>{usuarios.filter((u) => u.rol === r.nombre).length}</span>
          </button>
        ))}
        <button className={styles.nuevoRol} onClick={() => abrirModal('crear')}>
          <Plus size={16} />
          Nuevo rol
        </button>
      </div>

      {rol ? (
        <div className={`${shared.card} ${styles.panelRol}`}>
          <div className={styles.rolCabecera}>
            <h2 className={styles.rolNombre}>{rol.nombre}</h2>
            {miembros.length > 0 && (
              <div className={styles.pilaAvatares}>
                {miembros.slice(0, 6).map((u) => (
                  <span key={u.id} title={u.nombre}>
                    <Avatar usuario={u} size={26} />
                  </span>
                ))}
              </div>
            )}
            <span className={styles.usuarioCargo}>
              {miembros.length} {miembros.length === 1 ? 'usuario' : 'usuarios'}
            </span>
            <div className={shared.iconBtnGroup}>
              <button className={shared.iconBtn} onClick={() => abrirModal('renombrar')} title="Renombrar" aria-label="Renombrar rol">
                <Pencil size={15} />
              </button>
              <button className={shared.iconBtn} onClick={duplicar} title="Duplicar" aria-label="Duplicar rol">
                <Copy size={15} />
              </button>
              <button
                className={`${shared.iconBtn} ${shared.iconBtnDanger}`}
                onClick={handleEliminar}
                title="Eliminar"
                aria-label="Eliminar rol"
              >
                <Trash2 size={15} />
              </button>
            </div>
          </div>

          <label className={styles.accesoTotal}>
            <span>
              Acceso total
              <small>Ve y administra todo, incluidas las secciones que se agreguen después.</small>
            </span>
            <Interruptor checked={total} onChange={(e) => setTotal(e.target.checked)} label="Acceso total" />
          </label>

          {GRUPOS_SECCIONES.map((grupo) => (
            <div key={grupo.titulo} className={styles.grupoPermisos}>
              <h3 className={styles.panelSeccion}>
                {grupo.titulo}
                {!total && (
                  <button type="button" className={shared.linkBtn} onClick={() => toggleGrupo(grupo)}>
                    {grupo.items.every((i) => secciones.includes(i.seccion)) ? 'Quitar todo' : 'Marcar todo'}
                  </button>
                )}
              </h3>
              <div className={styles.permisos}>
                {grupo.items.map(({ seccion, label, descripcion, Icon }) => (
                  <label key={seccion} className={total ? styles.permisoBloqueado : styles.permiso}>
                    <Icon size={16} className={styles.permisoIcono} />
                    <span>
                      {label}
                      <small>{descripcion}</small>
                    </span>
                    <Interruptor
                      checked={total || secciones.includes(seccion)}
                      onChange={() => toggleSeccion(seccion)}
                      disabled={total || cargandoPermisos}
                      label={label}
                    />
                  </label>
                ))}
              </div>
            </div>
          ))}

          <div className={styles.barraGuardar}>
            <span>
              {total
                ? 'Acceso total activo: los permisos individuales no aplican.'
                : `${secciones.length} de ${TOTAL_SECCIONES} secciones activas`}
            </span>
            <button className={shared.btnSecondary} onClick={descartar} disabled={!hayCambios}>
              Descartar
            </button>
            <button className={shared.btnPrimary} onClick={guardarPermisos} disabled={!hayCambios || guardandoPermisos}>
              {guardandoPermisos ? 'Guardando...' : 'Guardar permisos'}
            </button>
          </div>
        </div>
      ) : (
        <p className={shared.emptyText}>No hay roles registrados todavia.</p>
      )}

      {modal && (
        <div className={shared.overlay} onClick={() => setModal(null)}>
          <div className={shared.modal} onClick={(e) => e.stopPropagation()}>
            <h2 className={shared.modalTitle}>{modal === 'renombrar' ? 'Renombrar rol' : 'Nuevo rol'}</h2>
            <form onSubmit={handleSubmit} className={shared.form}>
              <div className={shared.field}>
                <label>Nombre</label>
                <input type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} required maxLength={50} autoFocus />
              </div>
              {modal === 'crear' && (
                <p className={styles.ayuda}>Después de crearlo eliges a qué secciones puede entrar.</p>
              )}
              <div className={shared.modalActions}>
                <button type="button" className={shared.btnSecondary} onClick={() => setModal(null)}>
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

export default TabRoles;
