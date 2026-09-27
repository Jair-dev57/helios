import { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import { Camera, Trash2 } from 'lucide-react';
import { getMe, actualizarPerfil, cambiarPassword, subirAvatar, quitarAvatar } from '../../api/auth';
import { mensajeError } from '../../api/client';
import { useAuth } from '../../hooks/useAuth';
import Avatar from '../../components/Avatar';
import shared from '../../styles/shared.module.css';
import styles from './Configuracion.module.css';

const FORMATOS_IMAGEN = 'image/png,image/jpeg,image/webp';

const TabPerfil = () => {
  const { user, actualizarUsuario } = useAuth();
  const inputFoto = useRef(null);
  const [form, setForm] = useState({ nombre: '', username: '', telefono: '', cargo: '' });
  const [guardando, setGuardando] = useState(false);
  const [subiendoFoto, setSubiendoFoto] = useState(false);
  const [claves, setClaves] = useState({ actual: '', nueva: '', confirmar: '' });
  const [cambiandoClave, setCambiandoClave] = useState(false);

  const llenarForm = (u) =>
    setForm({ nombre: u.nombre || '', username: u.username || '', telefono: u.telefono || '', cargo: u.cargo || '' });

  useEffect(() => {
    getMe()
      .then((u) => {
        actualizarUsuario(u);
        llenarForm(u);
      })
      .catch(() => toast.error('No se pudo cargar tu perfil'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const guardarDatos = async (e) => {
    e.preventDefault();
    setGuardando(true);
    try {
      const actualizado = await actualizarPerfil(form);
      actualizarUsuario(actualizado);
      llenarForm(actualizado);
      toast.success('Perfil actualizado');
    } catch (err) {
      toast.error(mensajeError(err, 'No se pudo actualizar el perfil'));
    } finally {
      setGuardando(false);
    }
  };

  const elegirFoto = async (e) => {
    const archivo = e.target.files?.[0];
    e.target.value = '';
    if (!archivo) return;
    setSubiendoFoto(true);
    try {
      actualizarUsuario(await subirAvatar(archivo));
      toast.success('Foto actualizada');
    } catch (err) {
      toast.error(mensajeError(err, 'No se pudo subir la foto'));
    } finally {
      setSubiendoFoto(false);
    }
  };

  const eliminarFoto = async () => {
    try {
      actualizarUsuario(await quitarAvatar());
      toast.success('Foto eliminada');
    } catch (err) {
      toast.error(mensajeError(err, 'No se pudo quitar la foto'));
    }
  };

  const guardarClave = async (e) => {
    e.preventDefault();
    if (claves.nueva !== claves.confirmar) {
      toast.error('Las contraseñas nuevas no coinciden');
      return;
    }
    setCambiandoClave(true);
    try {
      await cambiarPassword(claves.actual, claves.nueva);
      setClaves({ actual: '', nueva: '', confirmar: '' });
      toast.success('Contraseña actualizada');
    } catch (err) {
      toast.error(mensajeError(err, 'No se pudo cambiar la contraseña'));
    } finally {
      setCambiandoClave(false);
    }
  };

  return (
    <div className={styles.layout}>
      <section className={`${shared.card} ${styles.tarjetaLateral}`}>
        <Avatar usuario={user} size={96} />
        <div className={styles.cabeceraInfo}>
          <span className={styles.cabeceraNombre}>{user?.nombre}</span>
          <span className={styles.cabeceraDetalle}>
            {user?.username ? `@${user.username} · ` : ''}
            {user?.email}
          </span>
          <span className={`${shared.badge} ${shared['badge-neutral']}`}>{user?.rol}</span>
        </div>
        <div className={styles.cabeceraAcciones}>
          <input ref={inputFoto} type="file" accept={FORMATOS_IMAGEN} hidden onChange={elegirFoto} />
          <button className={shared.btnSecondary} onClick={() => inputFoto.current?.click()} disabled={subiendoFoto}>
            <Camera size={15} className={styles.iconoBoton} />
            {subiendoFoto ? 'Subiendo...' : 'Cambiar foto'}
          </button>
          {user?.avatar_url && (
            <button className={shared.btnSecondary} onClick={eliminarFoto}>
              <Trash2 size={15} className={styles.iconoBoton} />
              Quitar
            </button>
          )}
        </div>
      </section>

      <div className={styles.columna}>
        <section className={shared.card}>
          <h2 className={styles.tituloSeccion}>Datos personales</h2>
          <form onSubmit={guardarDatos} className={shared.form}>
            <div className={styles.grid}>
              <div className={shared.field}>
                <label>Nombre completo</label>
                <input
                  type="text"
                  value={form.nombre}
                  onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                  required
                />
              </div>
              <div className={shared.field}>
                <label>Nombre de usuario</label>
                <input
                  type="text"
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                  placeholder="ej. jair.estupinan"
                  pattern="[A-Za-z0-9._\-]{3,30}"
                  title="3 a 30 caracteres: letras, numeros, punto, guion o guion bajo"
                />
              </div>
              <div className={shared.field}>
                <label>Correo electrónico</label>
                <input type="email" value={user?.email || ''} disabled />
              </div>
              <div className={shared.field}>
                <label>Teléfono</label>
                <input
                  type="tel"
                  value={form.telefono}
                  onChange={(e) => setForm({ ...form, telefono: e.target.value })}
                />
              </div>
              <div className={shared.field}>
                <label>Cargo</label>
                <input
                  type="text"
                  value={form.cargo}
                  onChange={(e) => setForm({ ...form, cargo: e.target.value })}
                  placeholder="ej. Desarrollador backend"
                />
              </div>
            </div>
            <div className={styles.acciones}>
              <button type="submit" className={shared.btnPrimary} disabled={guardando}>
                {guardando ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </div>
          </form>
        </section>

        <section className={shared.card}>
          <h2 className={styles.tituloSeccion}>Cambiar contraseña</h2>
          <form onSubmit={guardarClave} className={shared.form}>
            <div className={styles.grid}>
              <div className={`${shared.field} ${styles.campoAncho}`}>
                <label>Contraseña actual</label>
                <input
                  type="password"
                  autoComplete="current-password"
                  value={claves.actual}
                  onChange={(e) => setClaves({ ...claves, actual: e.target.value })}
                  required
                />
              </div>
              <div className={shared.field}>
                <label>Nueva contraseña</label>
                <input
                  type="password"
                  autoComplete="new-password"
                  value={claves.nueva}
                  onChange={(e) => setClaves({ ...claves, nueva: e.target.value })}
                  required
                  minLength={6}
                />
              </div>
              <div className={shared.field}>
                <label>Confirmar nueva contraseña</label>
                <input
                  type="password"
                  autoComplete="new-password"
                  value={claves.confirmar}
                  onChange={(e) => setClaves({ ...claves, confirmar: e.target.value })}
                  required
                  minLength={6}
                />
              </div>
            </div>
            <div className={styles.acciones}>
              <button type="submit" className={shared.btnPrimary} disabled={cambiandoClave}>
                {cambiandoClave ? 'Guardando...' : 'Cambiar contraseña'}
              </button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
};

export default TabPerfil;
