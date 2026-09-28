import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Users, Lock } from 'lucide-react';
import { obtenerAccesoDocumento, actualizarAccesoDocumento } from '../../api/documentos';
import { listarUsuarios } from '../../api/usuarios';
import { listarRoles } from '../../api/roles';
import { mensajeError } from '../../api/client';
import shared from '../../styles/shared.module.css';
import styles from './ModalAccesoDocumento.module.css';

const OPCIONES = [
  {
    restringido: false,
    Icono: Users,
    titulo: 'Todo el equipo',
    texto: 'Lo ve cualquier persona con acceso a Documentos.',
  },
  {
    restringido: true,
    Icono: Lock,
    titulo: 'Restringido',
    texto: 'Solo lo ven los administradores y las personas que elijas.',
  },
];

/** Solo para administradores: restringe un documento y elige con quién compartirlo. */
export default function ModalAccesoDocumento({ documento, onClose, onGuardado }) {
  const [restringido, setRestringido] = useState(documento.restringido);
  const [elegidos, setElegidos] = useState(new Set());
  const [usuarios, setUsuarios] = useState(null);
  const [rolesAdmin, setRolesAdmin] = useState(new Set());
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    let cancelado = false;
    Promise.all([obtenerAccesoDocumento(documento.id), listarUsuarios(), listarRoles()])
      .then(([acceso, listaUsuarios, roles]) => {
        if (cancelado) return;
        setRestringido(acceso.restringido);
        setElegidos(new Set(acceso.usuario_ids));
        setRolesAdmin(new Set(roles.filter((r) => r.es_administrador).map((r) => r.nombre)));
        setUsuarios(listaUsuarios.filter((u) => u.activo));
      })
      .catch((err) => {
        toast.error(mensajeError(err, 'No se pudo cargar el acceso del archivo.'));
        onClose();
      });
    return () => { cancelado = true; };
  }, [documento.id, onClose]);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Los administradores primero: siempre tienen acceso y no se pueden quitar
  const lista = useMemo(() => (usuarios || [])
    .map((u) => ({ ...u, esAdmin: rolesAdmin.has(u.rol) }))
    .sort((a, b) => (b.esAdmin - a.esAdmin) || a.nombre.localeCompare(b.nombre)), [usuarios, rolesAdmin]);

  const alternar = (id) => setElegidos((prev) => {
    const nuevo = new Set(prev);
    if (nuevo.has(id)) nuevo.delete(id);
    else nuevo.add(id);
    return nuevo;
  });

  const guardar = async () => {
    try {
      setGuardando(true);
      const idsNoAdmin = lista.filter((u) => !u.esAdmin && elegidos.has(u.id)).map((u) => u.id);
      await actualizarAccesoDocumento(documento.id, { restringido, usuario_ids: restringido ? idsNoAdmin : [] });
      toast.success(restringido ? 'Archivo restringido' : 'Archivo visible para todo el equipo');
      onGuardado();
    } catch (err) {
      toast.error(mensajeError(err, 'No se pudo cambiar el acceso.'));
    } finally {
      setGuardando(false);
    }
  };

  const nCompartidos = lista.filter((u) => !u.esAdmin && elegidos.has(u.id)).length;

  return (
    <div className={shared.overlay} onClick={onClose}>
      <div className={`${shared.modal} ${styles.modal}`} onClick={(e) => e.stopPropagation()}>
        <h3 className={shared.modalTitle}>Acceso al archivo</h3>
        <p className={styles.contexto}>
          <strong>{documento.nombre}.{documento.tipo}</strong>
        </p>

        {!usuarios ? (
          <p className={shared.loadingText}>Cargando...</p>
        ) : (
          <>
            <div className={styles.opciones} role="radiogroup" aria-label="Quién puede ver el archivo">
              {OPCIONES.map(({ restringido: valor, Icono, titulo, texto }) => (
                <button
                  key={titulo}
                  type="button"
                  role="radio"
                  aria-checked={restringido === valor}
                  className={`${styles.opcion} ${restringido === valor ? styles.opcionActiva : ''}`}
                  onClick={() => setRestringido(valor)}
                >
                  <Icono size={18} />
                  <span>
                    <strong>{titulo}</strong>
                    <small>{texto}</small>
                  </span>
                </button>
              ))}
            </div>

            {restringido && (
              <div className={styles.personas}>
                <div className={styles.personasCabecera}>
                  <span>Personas con acceso</span>
                  <small>{nCompartidos ? `${nCompartidos} elegida${nCompartidos === 1 ? '' : 's'}` : 'Solo administradores'}</small>
                </div>
                <ul className={styles.lista}>
                  {lista.map((u) => (
                    <li key={u.id}>
                      <label className={u.esAdmin ? styles.fijo : ''}>
                        <input
                          type="checkbox"
                          checked={u.esAdmin || elegidos.has(u.id)}
                          disabled={u.esAdmin}
                          onChange={() => alternar(u.id)}
                        />
                        <span className={styles.nombre}>{u.nombre}</span>
                        <span className={styles.rol}>{u.esAdmin ? `${u.rol} · siempre` : u.rol}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}

        <div className={shared.modalActions}>
          <button className={shared.btnSecondary} onClick={onClose}>Cancelar</button>
          <button className={shared.btnPrimary} onClick={guardar} disabled={guardando || !usuarios}>
            {guardando ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
}
