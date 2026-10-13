import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { RotateCcw, Trash2, Lock } from 'lucide-react';
import { listarPapeleraGlobal, restaurarDePapelera, eliminarDePapelera } from '../../api/papelera';
import { nombreLugar, rutaObjeto } from '../../api/espacios';
import PageContainer from '../../components/PageContainer';
import IconoArchivo from '../../components/IconoArchivo';
import IconoCarpeta from '../Proyectos/IconoCarpeta';
import { fechaRelativa, fechaCompleta, formatoTamano, nombreArchivo, plural } from '../Proyectos/formato';
import { useAuth } from '../../hooks/useAuth';
import listado from '../../styles/listado.module.css';
import shared from '../../styles/shared.module.css';
import styles from './Archivos.module.css';

const DIA_MS = 86400000;

/** Lo borrado en todos los proyectos y espacios. Restaurar: cualquiera; eliminar para siempre: administradores */
export default function PapeleraGlobal() {
  const { esAdministrador } = useAuth();
  const navigate = useNavigate();
  const [elementos, setElementos] = useState(null);
  const [ocupado, setOcupado] = useState(null);
  const [confirmando, setConfirmando] = useState(null);

  const cargar = () => listarPapeleraGlobal()
    .then(setElementos)
    .catch(() => { setElementos([]); toast.error('No se pudo cargar la papelera.'); });
  useEffect(() => { cargar(); }, []);

  const clave = (e) => `${e.tipo}:${e.id}`;
  const nombre = (e) => (e.tipo === 'documento' ? nombreArchivo(e.nombre, e.extension) : e.nombre);

  const restaurar = async (e) => {
    setOcupado(clave(e));
    try {
      const { carpeta_id: carpetaId } = await restaurarDePapelera(e.tipo, e.id);
      setElementos((prev) => prev.filter((x) => clave(x) !== clave(e)));
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
    setOcupado(clave(e));
    try {
      await eliminarDePapelera(e.tipo, e.id);
      setElementos((prev) => prev.filter((x) => clave(x) !== clave(e)));
      toast.success(`«${nombre(e)}» eliminado para siempre`);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'No se pudo eliminar.');
    } finally {
      setOcupado(null);
      setConfirmando(null);
    }
  };

  return (
    <PageContainer>
      <header className={listado.header}>
        <div>
          <h1 className={listado.title}>Papelera</h1>
          <p className={styles.subtitulo}>Lo borrado en todos tus proyectos y espacios. Se elimina solo a los 30 días.</p>
        </div>
      </header>

      {elementos === null ? (
        <p className={shared.loadingText}>Cargando…</p>
      ) : elementos.length === 0 ? (
        <div className={listado.vacio}>
          <b>La papelera está vacía</b>
          <span>Lo que borres en cualquier proyecto o espacio aparecerá aquí durante 30 días.</span>
        </div>
      ) : (
        <ul className={styles.filas}>
          {elementos.map((e) => {
            const dias = Math.max(0, Math.ceil((new Date(e.expira_at) - Date.now()) / DIA_MS));
            const ubicacion = [nombreLugar(e), e.ubicacion].filter(Boolean).join(' / ');
            return (
              <li key={clave(e)} className={styles.filaCompartida}>
                <span className={styles.objeto}>
                  {e.tipo === 'documento' ? <IconoArchivo tipo={e.extension} size={30} /> : <IconoCarpeta color={e.color} size={30} />}
                  <span className={styles.objetoTexto}>
                    <b title={nombre(e)}>{nombre(e)} {e.restringido && <Lock size={12} aria-label="Restringido" />}</b>
                    <small>
                      Estaba en {ubicacion}
                      {e.tipo === 'carpeta' && ` · ${plural(e.archivos, 'archivo', 'archivos')}`}
                      {e.tamano ? ` · ${formatoTamano(e.tamano)}` : ''}
                    </small>
                  </span>
                </span>
                <span className={styles.datosEnlace}>
                  <span title={fechaCompleta(e.eliminado_at)}>
                    Borrado {fechaRelativa(e.eliminado_at)}{e.eliminado_por && ` por ${e.eliminado_por}`}
                  </span>
                  <span className={dias <= 3 ? styles.urgente : ''} title={fechaCompleta(e.expira_at)}>
                    {dias === 0 ? 'Se elimina hoy' : `Quedan ${plural(dias, 'día', 'días')}`}
                  </span>
                </span>
                <span className={styles.accionesFila}>
                  {confirmando === clave(e) ? (
                    <>
                      <button className={`${styles.botonFila} ${styles.botonPeligro}`} onClick={() => eliminar(e)} disabled={ocupado === clave(e)}>
                        Sí, eliminar
                      </button>
                      <button className={styles.botonFila} onClick={() => setConfirmando(null)}>No</button>
                    </>
                  ) : (
                    <>
                      <button className={styles.botonFila} onClick={() => restaurar(e)} disabled={ocupado === clave(e)}>
                        <RotateCcw size={14} /> <span>Restaurar</span>
                      </button>
                      {esAdministrador && (
                        <button
                          className={styles.botonFila}
                          onClick={() => setConfirmando(clave(e))}
                          title="Eliminar para siempre"
                          aria-label={`Eliminar para siempre ${nombre(e)}`}
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </PageContainer>
  );
}
