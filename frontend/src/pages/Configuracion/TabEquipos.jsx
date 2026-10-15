import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Plus, Pencil, SquareDashed } from 'lucide-react';
import { listarEspacios, actualizarEspacio, obtenerAccesoBasico, guardarAccesoBasico } from '../../api/espacios';
import { listarUsuarios } from '../../api/usuarios';
import { mensajeError } from '../../api/client';
import { useAuth } from '../../hooks/useAuth';
import Avatar from '../../components/ui/Avatar';
import ModalEspacio from '../../components/espacios/ModalEspacio';
import { GRUPOS_SECCIONES, SECCIONES } from './secciones';
import shared from '../../styles/shared.module.css';
import styles from './Configuracion.module.css';

// Lo que se edita: 'basico' (Acceso basico) o el id de un equipo
const BASICO = 'basico';
const iguales = (a, b) => a.length === b.length && a.every((x) => b.includes(x));

const Interruptor = ({ checked, onChange, disabled, label }) => (
  <span className={styles.interruptor}>
    <input type="checkbox" checked={checked} onChange={onChange} disabled={disabled} aria-label={label} />
    <span />
  </span>
);

/**
 * Equipos: cada uno suma secciones a sus miembros, ademas del Acceso basico que tiene cualquier persona.
 * Solo los administradores cambian permisos y miembros.
 */
const TabEquipos = () => {
  const { esAdministrador } = useAuth();
  const [equipos, setEquipos] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [basico, setBasico] = useState([]);
  const [loading, setLoading] = useState(true);
  const [seleccion, setSeleccion] = useState(BASICO);
  // Secciones que se estan editando (sin guardar) de lo seleccionado
  const [secciones, setSecciones] = useState([]);
  const [guardando, setGuardando] = useState(false);
  // Modal de equipo: null cerrado, 'nuevo' o el equipo que se edita
  const [modal, setModal] = useState(null);

  const cargar = async (seleccionar) => {
    try {
      const [espacios, usuariosData, basicoData] = await Promise.all([
        listarEspacios(),
        listarUsuarios().catch(() => []),
        obtenerAccesoBasico(),
      ]);
      setEquipos(espacios.equipo);
      setUsuarios(usuariosData.filter((u) => u.activo));
      setBasico(basicoData);
      if (seleccionar !== undefined) setSeleccion(seleccionar);
    } catch {
      toast.error('No se pudieron cargar los equipos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargar();
  }, []);

  const equipo = equipos.find((e) => e.id === seleccion);
  const guardadas = seleccion === BASICO ? basico : equipo?.secciones || [];
  useEffect(() => {
    setSecciones(guardadas);
  }, [seleccion, guardadas.join()]); // eslint-disable-line react-hooks/exhaustive-deps

  // Si el equipo seleccionado ya no existe (se elimino), vuelve al Acceso basico
  useEffect(() => {
    if (!loading && seleccion !== BASICO && !equipo) setSeleccion(BASICO);
  }, [loading, seleccion, equipo]);

  const hayCambios = !iguales(secciones, guardadas);
  const miembros = equipo ? usuarios.filter((u) => equipo.miembro_ids.includes(u.id)) : [];
  const sinEquipo = usuarios.filter((u) => !u.es_administrador && !u.equipo_ids?.length);

  const alternar = (s) => setSecciones((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));

  const guardar = async () => {
    setGuardando(true);
    try {
      if (seleccion === BASICO) {
        setBasico(await guardarAccesoBasico(secciones));
      } else {
        const actualizado = await actualizarEspacio(equipo.id, { secciones });
        setEquipos((prev) => prev.map((e) => (e.id === actualizado.id ? actualizado : e)));
      }
      toast.success('Permisos guardados. Cada persona los verá al recargar la página.');
    } catch (err) {
      toast.error(mensajeError(err, 'No se pudieron guardar los permisos'));
    } finally {
      setGuardando(false);
    }
  };

  if (loading) return <p className={shared.loadingText}>Cargando...</p>;

  const total = secciones.filter((s) => seleccion === BASICO || !basico.includes(s)).length;

  return (
    <div className={styles.rolesLayout}>
      <div className={`${shared.card} ${styles.listaRoles}`}>
        <button
          className={seleccion === BASICO ? styles.itemRolActivo : styles.itemRol}
          onClick={() => setSeleccion(BASICO)}
        >
          <SquareDashed size={16} />
          <span className={styles.itemRolNombre}>Acceso básico</span>
          <span className={styles.itemRolCuenta}>todos</span>
        </button>
        <hr className={styles.separadorLista} />
        {equipos.map((e) => (
          <button
            key={e.id}
            className={e.id === seleccion ? styles.itemRolActivo : styles.itemRol}
            onClick={() => setSeleccion(e.id)}
          >
            <span className={styles.puntoEquipoLista} style={{ background: e.color || 'var(--accent)' }} />
            <span className={styles.itemRolNombre}>{e.nombre}</span>
            <span className={styles.itemRolCuenta}>{e.miembro_ids.length}</span>
          </button>
        ))}
        {esAdministrador && (
          <button className={styles.nuevoRol} onClick={() => setModal('nuevo')}>
            <Plus size={16} />
            Nuevo equipo
          </button>
        )}
      </div>

      <div className={`${shared.card} ${styles.panelRol}`}>
        {seleccion === BASICO ? (
          <div className={styles.rolCabecera}>
            <h2 className={styles.rolNombre}>Acceso básico</h2>
            <span className={styles.usuarioCargo}>Lo tiene cualquier persona, también sin equipo</span>
          </div>
        ) : equipo && (
          <>
            <div className={styles.rolCabecera}>
              <span className={styles.puntoEquipoGrande} style={{ background: equipo.color || 'var(--accent)' }} />
              <h2 className={styles.rolNombre}>{equipo.nombre}</h2>
              <span className={styles.usuarioCargo}>
                {miembros.length} {miembros.length === 1 ? 'persona' : 'personas'}
                {' · '}archivos {equipo.abierto ? 'visibles para todos' : 'solo para miembros'}
              </span>
              {esAdministrador && (
                <button className={shared.btnSecondary} onClick={() => setModal(equipo)}>
                  <Pencil size={14} className={styles.iconoBoton} />
                  Editar equipo
                </button>
              )}
            </div>
            <section className={styles.grupoPermisos}>
              <h3 className={styles.panelSeccion}>Miembros</h3>
              <div className={styles.etiquetas}>
                {miembros.map((u) => (
                  <span key={u.id} className={styles.chipMiembro}>
                    <Avatar usuario={u} size={22} />
                    {u.nombre}
                  </span>
                ))}
                {miembros.length === 0 && <span className={styles.usuarioCargo}>Nadie todavía.</span>}
                {esAdministrador && (
                  <button type="button" className={styles.chipAgregar} onClick={() => setModal(equipo)}>+ Agregar o quitar</button>
                )}
              </div>
            </section>
          </>
        )}

        <h3 className={styles.panelSeccion}>
          {seleccion === BASICO ? 'Qué incluye' : 'Qué suma a sus miembros'}
          <span className={styles.usuarioCargo}>
            {seleccion === BASICO ? `${secciones.length} de ${SECCIONES.length}` : `+${total} secciones`}
          </span>
        </h3>
        {seleccion !== BASICO && (
          <p className={styles.ayuda} style={{ marginBottom: 'var(--space-4)' }}>
            Se suma al Acceso básico: lo que ya viene en el básico aparece apagado.
          </p>
        )}

        {GRUPOS_SECCIONES.map((grupo) => (
          <div key={grupo.titulo} className={styles.grupoPermisos}>
            <h4 className={styles.subtituloGrupo}>{grupo.titulo}</h4>
            <div className={styles.permisos}>
              {grupo.items.map(({ seccion, label, descripcion, Icon }) => {
                const enBasico = seleccion !== BASICO && basico.includes(seccion);
                return (
                  <label key={seccion} className={enBasico ? styles.permisoBloqueado : styles.permiso}>
                    <Icon size={16} className={styles.permisoIcono} />
                    <span>
                      {label}
                      <small>{enBasico ? 'Ya viene en el Acceso básico' : descripcion}</small>
                    </span>
                    <Interruptor
                      checked={enBasico || secciones.includes(seccion)}
                      onChange={() => alternar(seccion)}
                      disabled={enBasico || !esAdministrador}
                      label={label}
                    />
                  </label>
                );
              })}
            </div>
          </div>
        ))}

        {seleccion === BASICO && sinEquipo.length > 0 && (
          <p className={styles.ayuda}>
            {sinEquipo.length === 1 ? '1 persona no tiene' : `${sinEquipo.length} personas no tienen`} equipo y solo
            cuentan con esto: {sinEquipo.map((u) => u.nombre).join(', ')}.
          </p>
        )}

        {esAdministrador && (
          <div className={styles.barraGuardar}>
            <span>{hayCambios ? 'Tienes cambios sin guardar' : 'Sin cambios'}</span>
            <button className={shared.btnSecondary} onClick={() => setSecciones(guardadas)} disabled={!hayCambios}>
              Descartar
            </button>
            <button className={shared.btnPrimary} onClick={guardar} disabled={!hayCambios || guardando}>
              {guardando ? 'Guardando...' : 'Guardar permisos'}
            </button>
          </div>
        )}
      </div>

      {modal && (
        <ModalEspacio
          espacio={modal === 'nuevo' ? undefined : modal}
          onClose={() => setModal(null)}
          onGuardado={(guardado) => { setModal(null); cargar(guardado.id); }}
          onEliminado={() => { setModal(null); cargar(BASICO); }}
        />
      )}
    </div>
  );
};

export default TabEquipos;
