import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Check, Globe, Users } from 'lucide-react';
import { crearEspacio, actualizarEspacio, eliminarEspacio } from '../../api/espacios';
import { listarUsuarios } from '../../api/usuarios';
import Avatar from '../../components/Avatar';
import { COLORES_CARPETA } from '../Proyectos/coloresCarpeta';
import shared from '../../styles/shared.module.css';
import styles from './Archivos.module.css';

/** Crear o editar un espacio de equipo (solo administradores). Sin espacio: crear uno nuevo. */
export default function ModalEspacio({ espacio, onClose, onGuardado, onEliminado }) {
  const [form, setForm] = useState({
    nombre: espacio?.nombre || '',
    descripcion: espacio?.descripcion || '',
    color: espacio?.color || COLORES_CARPETA[0].valor,
    abierto: espacio?.abierto ?? false,
    miembro_ids: espacio?.miembro_ids || [],
  });
  const [usuarios, setUsuarios] = useState([]);
  const [guardando, setGuardando] = useState(false);
  const [confirmarBorrado, setConfirmarBorrado] = useState(false);

  useEffect(() => {
    listarUsuarios().then((u) => setUsuarios(u.filter((x) => x.activo))).catch(() => setUsuarios([]));
  }, []);

  const cambiar = (campo, valor) => setForm((f) => ({ ...f, [campo]: valor }));
  const alternarMiembro = (id) => cambiar(
    'miembro_ids',
    form.miembro_ids.includes(id) ? form.miembro_ids.filter((x) => x !== id) : [...form.miembro_ids, id],
  );

  const guardar = async (e) => {
    e.preventDefault();
    if (!form.nombre.trim()) return;
    setGuardando(true);
    try {
      const datos = { ...form, nombre: form.nombre.trim(), descripcion: form.descripcion.trim() };
      const guardado = espacio ? await actualizarEspacio(espacio.id, datos) : await crearEspacio(datos);
      toast.success(espacio ? 'Espacio actualizado' : `Espacio «${guardado.nombre}» creado`);
      onGuardado(guardado);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'No se pudo guardar el espacio.');
    } finally {
      setGuardando(false);
    }
  };

  const borrar = async () => {
    try {
      await eliminarEspacio(espacio.id);
      toast.success('Espacio eliminado');
      onEliminado?.();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'No se pudo eliminar el espacio.');
      setConfirmarBorrado(false);
    }
  };

  return (
    <div className={shared.overlay} onClick={onClose}>
      <form className={`${shared.modal} ${styles.modalEspacio}`} onClick={(e) => e.stopPropagation()} onSubmit={guardar}>
        <h3 className={shared.modalTitle}>{espacio ? 'Editar espacio' : 'Nuevo espacio de equipo'}</h3>

        <div className={shared.field}>
          <label htmlFor="espacio-nombre">Nombre</label>
          <input
            id="espacio-nombre"
            value={form.nombre}
            onChange={(e) => cambiar('nombre', e.target.value)}
            placeholder="Ej.: Talento humano, Plantillas institucionales"
            maxLength={80}
            autoFocus
          />
        </div>
        <div className={shared.field}>
          <label htmlFor="espacio-descripcion">Descripción (opcional)</label>
          <input
            id="espacio-descripcion"
            value={form.descripcion}
            onChange={(e) => cambiar('descripcion', e.target.value)}
            placeholder="Qué se guarda aquí"
            maxLength={200}
          />
        </div>
        <div className={shared.field}>
          <span className={styles.etiquetaCampo}>Color</span>
          <div className={styles.paleta} role="radiogroup" aria-label="Color del espacio">
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
                {form.color === c.valor && <Check size={14} strokeWidth={3} />}
              </button>
            ))}
          </div>
        </div>

        <div className={shared.field}>
          <span className={styles.etiquetaCampo}>Quién lo ve</span>
          <div className={styles.opcionesAcceso} role="radiogroup" aria-label="Quién lo ve">
            <button type="button" role="radio" aria-checked={form.abierto} onClick={() => cambiar('abierto', true)}>
              <Globe size={17} /><span><b>Todo el equipo</b><small>Cualquiera con acceso a archivos</small></span>
            </button>
            <button type="button" role="radio" aria-checked={!form.abierto} onClick={() => cambiar('abierto', false)}>
              <Users size={17} /><span><b>Solo algunas personas</b><small>Las que elijas abajo</small></span>
            </button>
          </div>
        </div>

        {!form.abierto && (
          <ul className={styles.miembros} aria-label="Personas con acceso">
            {usuarios.map((u) => (
              <li key={u.id}>
                <label>
                  <input type="checkbox" checked={form.miembro_ids.includes(u.id)} onChange={() => alternarMiembro(u.id)} />
                  <Avatar usuario={u} size={26} />
                  <span>{u.nombre}<small>{u.rol}</small></span>
                </label>
              </li>
            ))}
            {usuarios.length === 0 && <li className={styles.miembrosVacio}>Cargando personas…</li>}
          </ul>
        )}
        {!form.abierto && <p className={styles.nota}>Los administradores ven todos los espacios de equipo.</p>}

        <div className={`${shared.modalActions} ${styles.accionesModal}`}>
          {espacio && (
            confirmarBorrado ? (
              <span className={styles.confirmar}>
                ¿Eliminar? Solo si está vacío.
                <button type="button" className={styles.peligro} onClick={borrar}>Sí, eliminar</button>
                <button type="button" className={styles.enlace} onClick={() => setConfirmarBorrado(false)}>No</button>
              </span>
            ) : (
              <button type="button" className={styles.enlacePeligro} onClick={() => setConfirmarBorrado(true)}>Eliminar espacio</button>
            )
          )}
          <span className={styles.espacioFlexible} />
          <button type="button" className={shared.btnSecondary} onClick={onClose}>Cancelar</button>
          <button type="submit" className={shared.btnPrimary} disabled={guardando || !form.nombre.trim()}>
            {guardando ? 'Guardando…' : espacio ? 'Guardar' : 'Crear espacio'}
          </button>
        </div>
      </form>
    </div>
  );
}
