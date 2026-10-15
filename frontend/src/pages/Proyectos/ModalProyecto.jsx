import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { X, Check, Layers, Users, UserPlus, Lock, Globe, CalendarDays, Building2, Trash2 } from 'lucide-react';
import { crearProyecto, actualizarProyecto } from '../../api/proyectos';
import { listarClientes, crearCliente } from '../../api/clientes';
import { listarEspacios, crearEspacio } from '../../api/espacios';
import { listarUsuarios } from '../../api/usuarios';
import { mensajeError } from '../../api/client';
import { useAuth } from '../../hooks/useAuth';
import Avatar from '../../components/Avatar';
import CrearEnLinea from './CrearEnLinea';
import IconoProyecto from './IconoProyecto';
import { COLORES_CARPETA, colorProyecto } from './coloresCarpeta';
import { ESTADOS_PROYECTO, NOMBRE_ESTADO, abrirCalendario, normalizarFecha } from './formato';
import shared from '../../styles/shared.module.css';
import f from '../../styles/formulario.module.css';

const COLOR_ESTADO = {
  activo: 'var(--success)',
  pausado: 'var(--warning)',
  completado: 'var(--info)',
  cancelado: 'var(--text-muted)',
};

const ACCESOS = [
  { id: 'todos', titulo: 'Toda la empresa', detalle: 'Cualquiera con acceso', Icono: Globe },
  { id: 'equipo', titulo: 'Un equipo', detalle: 'Solo sus miembros', Icono: Users },
  { id: 'personas', titulo: 'Personas', detalle: 'Las que tú elijas', Icono: UserPlus },
  { id: 'solo', titulo: 'Solo yo', detalle: 'Trabajas solo', Icono: Lock },
];

const fechaLegible = (aaaammdd) => {
  const [a, m, d] = aaaammdd.split('-').map(Number);
  const fecha = new Date(a, m - 1, d);
  return fecha.toLocaleDateString('es-CO', {
    day: 'numeric',
    month: 'short',
    year: fecha.getFullYear() === new Date().getFullYear() ? undefined : 'numeric',
  });
};

/**
 * Crear o editar un proyecto: nombre y descripcion arriba, propiedades en una fila, color y quien puede verlo.
 * proyecto: el que se edita (o nada para crear). onGuardado(proyecto) al terminar.
 * onEliminar: si se pasa (editando y con permiso), muestra «Eliminar proyecto» en el pie.
 */
export default function ModalProyecto({ proyecto, clienteInicial, onClose, onGuardado, onEliminar }) {
  const { user, tieneSeccion, esAdministrador } = useAuth();
  const [form, setForm] = useState(() => ({
    nombre: proyecto?.nombre || '',
    descripcion: proyecto?.descripcion || '',
    estado: proyecto?.estado || 'activo',
    fecha_vencimiento: proyecto?.fecha_vencimiento ? proyecto.fecha_vencimiento.slice(0, 10) : '',
    cliente_id: proyecto?.cliente_id || clienteInicial || '',
    area_id: proyecto?.area_id || '',
    // Vacio al crear: toma un color automatico segun su id
    color: proyecto ? colorProyecto(proyecto) : '',
    // Un proyecto con equipo y visible para todos es el caso viejo, de antes de unir equipo y acceso: se abre como «Un equipo»
    acceso: proyecto?.area_id && (proyecto.acceso || 'todos') === 'todos' && (proyecto.usuario_id === user?.id || esAdministrador)
      ? 'equipo'
      : proyecto?.acceso || 'todos',
    miembro_ids: proyecto?.miembro_ids || [],
  }));
  const [clientes, setClientes] = useState([]);
  const [equipos, setEquipos] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [creandoEn, setCreandoEn] = useState(null);
  const [guardando, setGuardando] = useState(false);

  // Quien lo ve lo decide quien lo creo (o un administrador)
  const duenoId = proyecto ? proyecto.usuario_id : user?.id;
  const puedeCambiarAcceso = !proyecto || proyecto.usuario_id === user?.id || esAdministrador;
  const cambiar = (campo, valor) => setForm((actual) => ({ ...actual, [campo]: valor }));
  // El equipo del proyecto y «Un equipo» van juntos: elegir equipo lo deja visible solo para ese equipo,
  // quitarlo lo vuelve a abrir a la empresa, y elegir «Toda la empresa» lo saca del equipo
  const cambiarEquipo = (areaId) => setForm((actual) => {
    if (!puedeCambiarAcceso) return { ...actual, area_id: areaId };
    if (areaId && actual.acceso === 'todos') return { ...actual, area_id: areaId, acceso: 'equipo' };
    if (!areaId && actual.acceso === 'equipo') return { ...actual, area_id: '', acceso: 'todos' };
    return { ...actual, area_id: areaId };
  });
  const cambiarAcceso = (acceso) => setForm((actual) => ({ ...actual, acceso, ...(acceso === 'todos' ? { area_id: '' } : {}) }));

  useEffect(() => {
    listarClientes().then(setClientes).catch(() => {});
    if (tieneSeccion('archivos')) listarEspacios().then((e) => setEquipos(e.equipo)).catch(() => {});
    listarUsuarios().then((u) => setUsuarios(u.filter((x) => x.activo))).catch(() => {});
  }, [tieneSeccion]);

  const guardar = async () => {
    if (!form.nombre.trim() || guardando) return;
    if (form.acceso === 'equipo' && !form.area_id) {
      toast.error('Elige el equipo que puede ver el proyecto.');
      return;
    }
    setGuardando(true);
    try {
      const payload = {
        nombre: form.nombre.trim(),
        descripcion: form.descripcion,
        estado: form.estado,
        cliente_id: form.cliente_id ? Number(form.cliente_id) : null,
        area_id: form.area_id ? Number(form.area_id) : null,
        fecha_vencimiento: form.fecha_vencimiento ? `${normalizarFecha(form.fecha_vencimiento)}T00:00:00Z` : null,
        color: form.color || null,
      };
      if (puedeCambiarAcceso) {
        payload.acceso = form.acceso;
        payload.miembro_ids = form.acceso === 'personas' ? form.miembro_ids : [];
      }
      const guardado = proyecto ? await actualizarProyecto(proyecto.id, payload) : await crearProyecto(payload);
      toast.success(proyecto ? 'Proyecto actualizado' : 'Proyecto creado');
      onGuardado?.(guardado);
    } catch (err) {
      toast.error(mensajeError(err, 'No se pudo guardar el proyecto'));
      setGuardando(false);
    }
  };

  // Escape cierra y Ctrl+Enter guarda, desde cualquier campo
  useEffect(() => {
    const alTeclear = (e) => {
      if (e.key === 'Escape' && !creandoEn) onClose();
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) guardar();
    };
    window.addEventListener('keydown', alTeclear);
    return () => window.removeEventListener('keydown', alTeclear);
  });

  const crearClienteNuevo = async (nombre) => {
    try {
      const cliente = await crearCliente({ nombre });
      setClientes((prev) => [...prev, cliente]);
      cambiar('cliente_id', cliente.id);
      setCreandoEn(null);
      toast.success('Cliente creado');
    } catch (err) {
      toast.error('No se pudo crear el cliente');
      throw err;
    }
  };

  // Solo administradores; quien lo crea queda como miembro y lo completa luego en Archivos
  const crearEquipoNuevo = async (nombre) => {
    try {
      const equipo = await crearEspacio({ nombre, miembro_ids: user?.id ? [user.id] : [] });
      setEquipos((prev) => [...prev, equipo]);
      cambiarEquipo(equipo.id);
      setCreandoEn(null);
      toast.success('Equipo creado');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'No se pudo crear el equipo');
      throw err;
    }
  };

  const cliente = clientes.find((c) => c.id === Number(form.cliente_id));
  const equipo = equipos.find((e) => e.id === Number(form.area_id));
  const dueno = usuarios.find((u) => u.id === duenoId);
  const elegidos = form.miembro_ids.map((id) => usuarios.find((u) => u.id === id)).filter(Boolean);
  const disponibles = usuarios.filter((u) => u.id !== duenoId && !form.miembro_ids.includes(u.id));
  const vistaPrevia = { id: proyecto?.id, nombre: form.nombre || '?', color: form.color };

  const detalleAcceso = () => {
    if (form.acceso === 'todos') {
      return <p>Todas las personas de la empresa con acceso a Proyectos lo ven y se les pueden asignar tareas. No queda en ningún equipo; para que quede en uno, elige «Un equipo».</p>;
    }
    if (form.acceso === 'equipo') {
      return (
        <>
          {equipos.length > 0 ? (
            <div className={f.chips} role="radiogroup" aria-label="Equipo que lo ve">
              {equipos.map((e) => (
                <button
                  key={e.id}
                  type="button"
                  role="radio"
                  aria-checked={e.id === Number(form.area_id)}
                  className={f.chipOpcion}
                  onClick={() => cambiarEquipo(e.id)}
                  disabled={!puedeCambiarAcceso}
                >
                  <span className={f.punto} style={{ background: e.color || 'var(--accent)' }} />
                  {e.nombre}
                  <span className={f.clave}>· {e.abierto ? 'abierto' : e.miembro_ids.length}</span>
                </button>
              ))}
            </div>
          ) : (
            <p>Aún no hay equipos. {esAdministrador ? 'Crea uno desde la propiedad «Equipo».' : 'Pide a un administrador que cree uno.'}</p>
          )}
          <p>
            {equipo
              ? <>Lo ven los miembros de <b>{equipo.nombre}</b> y los administradores. Las tareas se pueden asignar a ellos.</>
              : 'Elige qué equipo lo puede ver.'}
          </p>
        </>
      );
    }
    if (form.acceso === 'personas') {
      return (
        <>
          <div className={f.chips}>
            {dueno && (
              <span className={f.chip}>
                <Avatar usuario={dueno} size={22} />
                {dueno.id === user?.id ? 'Tú' : dueno.nombre}
              </span>
            )}
            {elegidos.map((u) => (
              <span key={u.id} className={f.chip}>
                <Avatar usuario={u} size={22} />
                {u.nombre}
                {puedeCambiarAcceso && (
                  <button
                    type="button"
                    onClick={() => cambiar('miembro_ids', form.miembro_ids.filter((id) => id !== u.id))}
                    aria-label={`Quitar a ${u.nombre}`}
                  >
                    <X size={12} />
                  </button>
                )}
              </span>
            ))}
            {puedeCambiarAcceso && disponibles.length > 0 && (
              <label className={f.agregar}>
                + Agregar persona
                <select
                  value=""
                  onChange={(e) => cambiar('miembro_ids', [...form.miembro_ids, Number(e.target.value)])}
                  aria-label="Agregar persona"
                >
                  <option value="" disabled>Elegir…</option>
                  {disponibles.map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}
                </select>
              </label>
            )}
          </div>
          <p>Solo estas personas y los administradores lo ven, y solo a ellas se les pueden asignar tareas.</p>
        </>
      );
    }
    return <p>Nadie más lo ve. Las tareas solo se te pueden asignar a ti; cuando quieras sumar a alguien, cambia esta opción.</p>;
  };

  return (
    <div className={f.fondo} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form
        className={f.modal}
        role="dialog"
        aria-modal="true"
        aria-label={proyecto ? 'Editar proyecto' : 'Nuevo proyecto'}
        onSubmit={(e) => { e.preventDefault(); guardar(); }}
      >
        <div className={f.barra}>
          <span className={f.ruta}>
            <Layers size={15} /> Proyectos › <b>{proyecto ? 'Editar proyecto' : 'Nuevo proyecto'}</b>
          </span>
          <button type="button" className={f.cerrar} onClick={onClose} aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>

        <div className={f.cuerpo}>
          <div className={f.cabecera}>
            <IconoProyecto proyecto={vistaPrevia} size={52} />
            <div className={f.textos}>
              <input
                className={f.titulo}
                value={form.nombre}
                onChange={(e) => cambiar('nombre', e.target.value)}
                placeholder="Nombre del proyecto"
                aria-label="Nombre del proyecto"
                maxLength={200}
                required
                autoFocus
              />
              <textarea
                className={f.descripcion}
                rows={2}
                value={form.descripcion}
                onChange={(e) => cambiar('descripcion', e.target.value)}
                placeholder="Añade una descripción…"
                aria-label="Descripción"
                maxLength={500}
              />
            </div>
          </div>

          <div className={f.propiedades}>
            <label className={`${f.propiedad} ${cliente ? '' : f.propiedadVacia}`}>
              <Building2 size={15} />
              {cliente ? cliente.nombre : 'Sin cliente'}
              <select
                value={form.cliente_id}
                onChange={(e) => (e.target.value === 'nuevo' ? setCreandoEn('cliente') : cambiar('cliente_id', e.target.value))}
                aria-label="Cliente"
              >
                <option value="">Sin cliente</option>
                {clientes.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                {tieneSeccion('clientes') && <option value="nuevo">+ Nuevo cliente…</option>}
              </select>
            </label>
            {(equipos.length > 0 || esAdministrador) && (
              <label className={`${f.propiedad} ${equipo ? '' : f.propiedadVacia}`}>
                {equipo ? <span className={f.punto} style={{ background: equipo.color || 'var(--accent)' }} /> : <Users size={15} />}
                {equipo ? equipo.nombre : 'Sin equipo'}
                <select
                  value={form.area_id}
                  onChange={(e) => (e.target.value === 'nuevo' ? setCreandoEn('equipo') : cambiarEquipo(e.target.value))}
                  aria-label="Equipo"
                >
                  <option value="">Sin equipo</option>
                  {equipos.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
                  {esAdministrador && <option value="nuevo">+ Nuevo equipo…</option>}
                </select>
              </label>
            )}
            <label className={f.propiedad}>
              <span className={f.punto} style={{ background: COLOR_ESTADO[form.estado] }} />
              {NOMBRE_ESTADO[form.estado]}
              <select value={form.estado} onChange={(e) => cambiar('estado', e.target.value)} aria-label="Estado">
                {ESTADOS_PROYECTO.map((e) => <option key={e} value={e}>{NOMBRE_ESTADO[e]}</option>)}
              </select>
            </label>
            <label className={`${f.propiedad} ${form.fecha_vencimiento ? '' : f.propiedadVacia}`}>
              <CalendarDays size={15} />
              <span className={f.clave}>Entrega</span>
              {form.fecha_vencimiento ? fechaLegible(normalizarFecha(form.fecha_vencimiento)) : 'Sin fecha'}
              <input
                type="date"
                onClick={abrirCalendario}
                value={form.fecha_vencimiento}
                onChange={(e) => cambiar('fecha_vencimiento', e.target.value)}
                onBlur={(e) => cambiar('fecha_vencimiento', normalizarFecha(e.target.value))}
                aria-label="Fecha de entrega"
              />
            </label>
          </div>

          {creandoEn && (
            <CrearEnLinea
              placeholder={creandoEn === 'cliente' ? 'Nombre del cliente' : 'Nombre del equipo'}
              onCrear={creandoEn === 'cliente' ? crearClienteNuevo : crearEquipoNuevo}
              onCancelar={() => setCreandoEn(null)}
            />
          )}

          <section className={f.seccion}>
            <h3 className={f.seccionTitulo}>Color</h3>
            <div className={f.paleta} role="radiogroup" aria-label="Color del proyecto">
              {COLORES_CARPETA.map((c) => (
                <button
                  key={c.valor}
                  type="button"
                  role="radio"
                  aria-checked={form.color === c.valor}
                  aria-label={c.nombre}
                  title={c.nombre}
                  style={{ background: c.valor }}
                  onClick={() => cambiar('color', c.valor)}
                >
                  {form.color === c.valor && <Check size={12} strokeWidth={3} />}
                </button>
              ))}
            </div>
          </section>

          <section className={f.seccion}>
            <h3 className={f.seccionTitulo}>¿Quién puede verlo?</h3>
            <div className={f.opciones} role="radiogroup" aria-label="Quién puede verlo">
              {ACCESOS.map(({ id, titulo, detalle, Icono }) => (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={form.acceso === id}
                  className={f.opcion}
                  onClick={() => cambiarAcceso(id)}
                  disabled={!puedeCambiarAcceso}
                >
                  <Icono size={16} />
                  <b>{titulo}</b>
                  <small>{detalle}</small>
                </button>
              ))}
            </div>
            <div className={f.panel}>{detalleAcceso()}</div>
            {!puedeCambiarAcceso && <p className={f.nota}>Solo quien creó el proyecto puede cambiar quién lo ve.</p>}
          </section>
        </div>

        <div className={f.pie}>
          <span className={f.pieIzquierda}>
            {onEliminar ? (
              <button
                type="button"
                className={shared.btnDanger}
                onClick={onEliminar}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                <Trash2 size={14} /> Eliminar proyecto
              </button>
            ) : (
              <span className={f.atajo}><kbd>Ctrl</kbd> + <kbd>Enter</kbd> para guardar</span>
            )}
          </span>
          <button type="button" className={shared.btnSecondary} onClick={onClose}>Cancelar</button>
          <button type="submit" className={shared.btnPrimary} disabled={guardando || !form.nombre.trim()}>
            {guardando ? 'Guardando…' : proyecto ? 'Guardar cambios' : 'Crear proyecto'}
          </button>
        </div>
      </form>
    </div>
  );
}
