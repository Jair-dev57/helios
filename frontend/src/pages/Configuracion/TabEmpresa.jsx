import { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import { Building2, Upload, Trash2 } from 'lucide-react';
import { obtenerEmpresa, actualizarEmpresa, subirLogoEmpresa, quitarLogoEmpresa } from '../../api/empresa';
import { mensajeError, urlPublica } from '../../api/client';
import { useEmpresa } from '../../hooks/useEmpresa';
import shared from '../../styles/shared.module.css';
import styles from './Configuracion.module.css';

const FORMATOS_IMAGEN = 'image/png,image/jpeg,image/webp';
const CAMPOS = ['nombre', 'nit', 'direccion', 'telefono', 'email_contacto', 'sitio_web'];

const formDesde = (empresa) => Object.fromEntries(CAMPOS.map((c) => [c, empresa[c] || '']));

const TabEmpresa = () => {
  const { setEmpresa } = useEmpresa();
  const inputLogo = useRef(null);
  const [datos, setDatos] = useState(null);
  const [form, setForm] = useState(formDesde({}));
  const [guardando, setGuardando] = useState(false);
  const [subiendoLogo, setSubiendoLogo] = useState(false);

  // Mantiene sincronizada la marca que se ve en el menu lateral y el login
  const aplicar = (empresa) => {
    setDatos(empresa);
    setEmpresa({ nombre: empresa.nombre, logo_url: empresa.logo_url });
  };

  useEffect(() => {
    obtenerEmpresa()
      .then((empresa) => {
        setDatos(empresa);
        setForm(formDesde(empresa));
      })
      .catch(() => toast.error('No se pudieron cargar los datos de la empresa'));
  }, []);

  const guardar = async (e) => {
    e.preventDefault();
    setGuardando(true);
    try {
      const empresa = await actualizarEmpresa(form);
      aplicar(empresa);
      setForm(formDesde(empresa));
      toast.success('Datos de la empresa actualizados');
    } catch (err) {
      toast.error(mensajeError(err, 'No se pudieron guardar los cambios'));
    } finally {
      setGuardando(false);
    }
  };

  const elegirLogo = async (e) => {
    const archivo = e.target.files?.[0];
    e.target.value = '';
    if (!archivo) return;
    setSubiendoLogo(true);
    try {
      aplicar(await subirLogoEmpresa(archivo));
      toast.success('Logo actualizado');
    } catch (err) {
      toast.error(mensajeError(err, 'No se pudo subir el logo'));
    } finally {
      setSubiendoLogo(false);
    }
  };

  const eliminarLogo = async () => {
    try {
      aplicar(await quitarLogoEmpresa());
      toast.success('Logo eliminado');
    } catch (err) {
      toast.error(mensajeError(err, 'No se pudo quitar el logo'));
    }
  };

  if (!datos) return <p className={shared.loadingText}>Cargando...</p>;

  const campo = (nombre, label, props = {}) => (
    <div className={shared.field}>
      <label>{label}</label>
      <input
        type="text"
        value={form[nombre]}
        onChange={(e) => setForm({ ...form, [nombre]: e.target.value })}
        {...props}
      />
    </div>
  );

  return (
    <div className={styles.layout}>
      <section className={`${shared.card} ${styles.tarjetaLateral}`}>
        <h2 className={styles.tituloSeccion}>Logo</h2>
        <div className={styles.logoFila}>
          <div className={styles.logoVista}>
            {datos.logo_url ? (
              <img src={urlPublica(datos.logo_url)} alt="Logo de la empresa" />
            ) : (
              <Building2 size={48} />
            )}
          </div>
          <div className={styles.logoTexto}>
            <p className={styles.ayuda}>
              Se muestra en el menú lateral y en la pantalla de inicio de sesión. PNG, JPG o WEBP de hasta 2 MB;
              mejor con fondo transparente.
            </p>
            <div className={styles.cabeceraAcciones}>
              <input ref={inputLogo} type="file" accept={FORMATOS_IMAGEN} hidden onChange={elegirLogo} />
              <button
                className={shared.btnSecondary}
                onClick={() => inputLogo.current?.click()}
                disabled={subiendoLogo}
              >
                <Upload size={15} className={styles.iconoBoton} />
                {subiendoLogo ? 'Subiendo...' : datos.logo_url ? 'Cambiar logo' : 'Subir logo'}
              </button>
              {datos.logo_url && (
                <button className={shared.btnSecondary} onClick={eliminarLogo}>
                  <Trash2 size={15} className={styles.iconoBoton} />
                  Quitar
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className={`${shared.card} ${styles.columna}`}>
        <h2 className={styles.tituloSeccion}>Datos de la empresa</h2>
        <form onSubmit={guardar} className={shared.form}>
          <div className={styles.grid}>
            {campo('nombre', 'Nombre de la empresa', { required: true, maxLength: 150 })}
            {campo('nit', 'NIT')}
            {campo('direccion', 'Dirección')}
            {campo('telefono', 'Teléfono', { type: 'tel' })}
            {campo('email_contacto', 'Correo de contacto', { type: 'email' })}
            {campo('sitio_web', 'Sitio web', { placeholder: 'https://' })}
          </div>
          <div className={styles.acciones}>
            <button type="submit" className={shared.btnPrimary} disabled={guardando}>
              {guardando ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
};

export default TabEmpresa;
