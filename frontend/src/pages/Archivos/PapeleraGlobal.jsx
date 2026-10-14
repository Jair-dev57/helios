import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { RotateCcw, Trash2 } from 'lucide-react';
import { listarPapeleraGlobal, restaurarDePapelera, eliminarDePapelera } from '../../api/papelera';
import { rutaObjeto, claveObjeto } from '../../api/espacios';
import ListaArchivos from './ListaArchivos';
import { fechaRelativa, fechaCompleta, formatoTamano, nombreArchivo, plural } from '../Proyectos/formato';
import { useAuth } from '../../hooks/useAuth';
import panel from '../Proyectos/Proyectos.module.css';
import styles from './Archivos.module.css';

const DIA_MS = 86400000;
const diasQuedan = (e) => Math.max(0, Math.ceil((new Date(e.expira_at) - Date.now()) / DIA_MS));

/** Lo borrado en todos los proyectos y espacios. Restaurar: cualquiera; eliminar para siempre: administradores */
export default function PapeleraGlobal() {
  const { esAdministrador } = useAuth();
  const navigate = useNavigate();
  const [elementos, setElementos] = useState(null);
  const [ocupado, setOcupado] = useState(null);
  const [confirmando, setConfirmando] = useState(null);

  useEffect(() => {
    listarPapeleraGlobal()
      .then(setElementos)
      .catch(() => { setElementos([]); toast.error('No se pudo cargar la papelera.'); });
  }, []);

  const nombre = (e) => (e.tipo === 'documento' ? nombreArchivo(e.nombre, e.extension) : e.nombre);
  const quitar = (e) => setElementos((prev) => prev.filter((x) => claveObjeto(x) !== claveObjeto(e)));

  const restaurar = async (e) => {
    setOcupado(claveObjeto(e));
    try {
      const { carpeta_id: carpetaId } = await restaurarDePapelera(e.tipo, e.id);
      quitar(e);
      toast((t) => (
        <span className={styles.avisoToast}>
          «{nombre(e)}» restaurado
          {carpetaId && (
            <button onClick={() => { toast.dismiss(t.id); navigate(rutaObjeto({ ...e, tipo: 'carpeta', id: carpetaId })); }}>Ver</button>
          )}
        </span>
      ), { icon: <RotateCcw size={16} /> });
    } catch (err) {
      toast.error(err.response?.data?.detail || 'No se pudo restaurar.');
    } finally {
      setOcupado(null);
    }
  };

  const eliminar = async (e) => {
    setOcupado(claveObjeto(e));
    try {
      await eliminarDePapelera(e.tipo, e.id);
      quitar(e);
      toast.success(`«${nombre(e)}» eliminado para siempre`);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'No se pudo eliminar.');
    } finally {
      setOcupado(null);
      setConfirmando(null);
    }
  };

  return (
    <ListaArchivos
      titulo="Papelera"
      items={elementos}
      conAcciones={false}
      abrir={restaurar}
      columnas={[
        { clave: 'carpeta', titulo: 'Carpeta', valor: (e) => e.ubicacion, celda: (e) => e.ubicacion || '—' },
        { clave: 'borrado', titulo: 'Borrado', valor: (e) => e.eliminado_at, celda: (e) => <span title={fechaCompleta(e.eliminado_at)}>{fechaRelativa(e.eliminado_at)}{e.eliminado_por && ` · ${e.eliminado_por}`}</span> },
        { clave: 'tamano', titulo: 'Tamaño', valor: (e) => e.tamano || 0, celda: (e) => (e.tipo === 'carpeta' ? plural(e.archivos, 'archivo', 'archivos') : formatoTamano(e.tamano)) },
        {
          clave: 'quedan',
          titulo: 'Se borra en',
          valor: diasQuedan,
          celda: (e) => <span className={diasQuedan(e) <= 3 ? styles.urgente : ''} title={fechaCompleta(e.expira_at)}>{diasQuedan(e) === 0 ? 'Hoy' : plural(diasQuedan(e), 'día', 'días')}</span>,
        },
      ]}
      subbarra={<span>Lo borrado en todos tus proyectos y espacios. Se elimina solo a los 30 días. Doble clic restaura.</span>}
      menu={(e) => [
        { texto: 'Restaurar', Icono: RotateCcw, accion: () => restaurar(e), atajo: 'Enter' },
        ...(esAdministrador ? [null, { texto: 'Eliminar para siempre…', Icono: Trash2, accion: () => setConfirmando(claveObjeto(e)) }] : []),
      ]}
      extraPanel={(e) => (
        <div className={panel.botones}>
          <button type="button" className={panel.primario} onClick={() => restaurar(e)} disabled={ocupado === claveObjeto(e)}>
            <RotateCcw size={14} /> Restaurar
          </button>
          {esAdministrador && (confirmando === claveObjeto(e) ? (
            <>
              <button type="button" className={panel.peligro} onClick={() => eliminar(e)} disabled={ocupado === claveObjeto(e)}>Sí, eliminar</button>
              <button type="button" onClick={() => setConfirmando(null)}>No</button>
            </>
          ) : (
            <button type="button" onClick={() => setConfirmando(claveObjeto(e))} style={{ gridColumn: '1 / -1' }}>
              <Trash2 size={14} /> Eliminar para siempre
            </button>
          ))}
        </div>
      )}
      vacio={<><b>La papelera está vacía</b>Lo que borres en cualquier proyecto o espacio aparecerá aquí durante 30 días.</>}
    />
  );
}
