import { useCallback, useEffect, useState } from 'react';
import { Trash2, RotateCcw, Lock } from 'lucide-react';
import toast from 'react-hot-toast';
import { listarPapelera, restaurarDePapelera, eliminarDePapelera, vaciarPapelera } from '../../api/papelera';
import IconoArchivo from '../../components/IconoArchivo';
import IconoCarpeta from './IconoCarpeta';
import { fechaRelativa, fechaCompleta, formatoTamano } from './formato';
import styles from './Papelera.module.css';

const DIA = 24 * 60 * 60 * 1000;

function diasRestantes(expira) {
  const dias = Math.ceil((new Date(expira) - Date.now()) / DIA);
  if (dias <= 1) return 'Se elimina hoy';
  return `Se elimina en ${dias} días`;
}

const nombreCompleto = (e) => (e.extension ? `${e.nombre}.${e.extension}` : e.nombre);

/**
 * Lo borrado del proyecto. Cualquiera puede restaurar; eliminar para siempre y vaciar, solo administradores.
 * onCambio: algo salio o volvio de la papelera (recargar arbol y contador). onAbrir(carpetaId): ir a donde quedo.
 */
export default function Papelera({ proyectoId, esAdministrador, onCambio, onAbrir }) {
  const [elementos, setElementos] = useState(null);
  const [ocupado, setOcupado] = useState(null);

  const cargar = useCallback(async () => {
    try {
      setElementos(await listarPapelera(proyectoId));
    } catch (err) {
      toast.error('No se pudo cargar la papelera.');
      setElementos([]);
    }
  }, [proyectoId]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const clave = (e) => `${e.tipo}-${e.id}`;

  const restaurar = async (e) => {
    setOcupado(clave(e));
    try {
      const { carpeta_id: carpetaId } = await restaurarDePapelera(e.tipo, e.id);
      await cargar();
      onCambio();
      toast.success((t) => (
        <span className={styles.aviso}>
          «{nombreCompleto(e)}» restaurado
          {carpetaId && (
            <button onClick={() => { toast.dismiss(t.id); onAbrir(carpetaId); }}>Ver</button>
          )}
        </span>
      ), { duration: 5000 });
    } catch (err) {
      toast.error(err.response?.data?.detail || 'No se pudo restaurar.');
    } finally {
      setOcupado(null);
    }
  };

  const eliminar = async (e) => {
    const contenido = e.tipo === 'carpeta' && e.archivos
      ? ` y sus ${e.archivos} archivo${e.archivos === 1 ? '' : 's'}`
      : '';
    if (!confirm(`¿Eliminar «${nombreCompleto(e)}»${contenido} para siempre? Esto no se puede deshacer.`)) return;
    setOcupado(clave(e));
    try {
      await eliminarDePapelera(e.tipo, e.id);
      await cargar();
      onCambio();
      toast.success('Eliminado para siempre');
    } catch (err) {
      toast.error('No se pudo eliminar.');
    } finally {
      setOcupado(null);
    }
  };

  const vaciar = async () => {
    if (!confirm(`¿Vaciar la papelera? Se eliminarán para siempre ${elementos.length} elemento${elementos.length === 1 ? '' : 's'}.`)) return;
    setOcupado('todo');
    try {
      await vaciarPapelera(proyectoId);
      await cargar();
      onCambio();
      toast.success('Papelera vaciada');
    } catch (err) {
      toast.error('No se pudo vaciar la papelera.');
    } finally {
      setOcupado(null);
    }
  };

  return (
    <section className={styles.papelera} aria-labelledby="titulo-papelera">
      <header className={styles.cabecera}>
        <div>
          <h2 id="titulo-papelera" className={styles.titulo}><Trash2 size={18} /> Papelera</h2>
          <p className={styles.explicacion}>Lo que se borra se guarda aquí 30 días. Después se elimina para siempre.</p>
        </div>
        {esAdministrador && elementos?.length > 0 && (
          <button className={styles.vaciar} onClick={vaciar} disabled={!!ocupado}>Vaciar papelera</button>
        )}
      </header>

      {elementos === null && <p className={styles.estado}>Cargando…</p>}

      {elementos?.length === 0 && (
        <div className={styles.vacia}>
          <Trash2 size={36} strokeWidth={1.5} />
          <p className={styles.vaciaTitulo}>La papelera está vacía</p>
          <p className={styles.vaciaTexto}>Si borras un archivo o una carpeta por error, podrás recuperarlo desde aquí.</p>
        </div>
      )}

      {elementos?.length > 0 && (
        <ul className={styles.lista}>
          {elementos.map((e) => {
            const quedanPocos = new Date(e.expira_at) - Date.now() < 3 * DIA;
            return (
              <li key={clave(e)} className={styles.fila}>
                <span className={styles.icono}>
                  {e.tipo === 'carpeta' ? <IconoCarpeta color={e.color} size={30} /> : <IconoArchivo tipo={e.extension} size={28} />}
                </span>
                <div className={styles.info}>
                  <span className={styles.nombre} title={nombreCompleto(e)}>
                    {nombreCompleto(e)}
                    {e.restringido && <Lock size={12} className={styles.candado} aria-label="Restringido" />}
                  </span>
                  <span className={styles.meta}>
                    {e.ubicacion ? `Estaba en ${e.ubicacion}` : 'Estaba en la raíz del proyecto'}
                    {' · '}
                    <span title={fechaCompleta(e.eliminado_at)}>
                      Borrado {fechaRelativa(e.eliminado_at)}{e.eliminado_por ? ` por ${e.eliminado_por}` : ''}
                    </span>
                  </span>
                </div>
                <span className={styles.tamano}>
                  {e.tipo === 'carpeta'
                    ? `${e.archivos} archivo${e.archivos === 1 ? '' : 's'} · ${formatoTamano(e.tamano)}`
                    : formatoTamano(e.tamano)}
                </span>
                <span className={`${styles.expira} ${quedanPocos ? styles.expiraPronto : ''}`} title={fechaCompleta(e.expira_at)}>
                  {diasRestantes(e.expira_at)}
                </span>
                <div className={styles.acciones}>
                  <button className={styles.restaurar} onClick={() => restaurar(e)} disabled={!!ocupado}>
                    <RotateCcw size={14} /> Restaurar
                  </button>
                  {esAdministrador && (
                    <button
                      className={styles.eliminar}
                      onClick={() => eliminar(e)}
                      disabled={!!ocupado}
                      aria-label={`Eliminar para siempre ${nombreCompleto(e)}`}
                      title="Eliminar para siempre"
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
