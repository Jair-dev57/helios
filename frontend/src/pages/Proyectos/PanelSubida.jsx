import { useState } from 'react';
import { Pause, Play, ChevronDown, ChevronUp, X } from 'lucide-react';
import { formatoTamano } from './formato';
import styles from './SubidaLocal.module.css';

const ESTADOS = {
  cola: { texto: 'En cola', clase: 'espera' },
  subiendo: { texto: null, clase: 'activo' },
  listo: { texto: 'Listo', clase: 'ok' },
  version: { texto: 'Nueva versión', clase: 'ok' },
  igual: { texto: 'Sin cambios', clase: 'espera' },
  omitido: { texto: 'Omitido', clase: 'espera' },
  error: { texto: 'Error', clase: 'error' },
  cancelado: { texto: 'Cancelado', clase: 'espera' },
};
// Arriba lo que necesita atencion o esta en marcha
const ORDEN = { error: 0, subiendo: 1, cola: 2 };
const FINALES = new Set(['listo', 'version', 'igual', 'omitido', 'error', 'cancelado']);

export default function PanelSubida({ subida, onPausar, onReanudar, onCancelar, onReintentar, onCerrar }) {
  const [minimizado, setMinimizado] = useState(false);
  const { titulo, filas, pausada, cancelada, terminada } = subida;

  const hechos = filas.filter((f) => FINALES.has(f.estado)).length;
  const total = filas.reduce((s, f) => s + f.bytes, 0);
  const enviados = filas.reduce((s, f) => s + f.bytes * (FINALES.has(f.estado) ? 1 : f.progreso), 0);
  const porcentaje = total ? Math.round((enviados / total) * 100) : 100;
  const cuenta = (...estados) => filas.filter((f) => estados.includes(f.estado)).length;
  const errores = cuenta('error');

  let resumen;
  if (!terminada) {
    resumen = `${hechos} de ${filas.length} archivos · ${formatoTamano(enviados)} de ${formatoTamano(total)}${pausada ? ' · en pausa' : ''}`;
  } else {
    const partes = [];
    const subidos = cuenta('listo', 'version');
    if (subidos) partes.push(`${subidos} subido${subidos === 1 ? '' : 's'}`);
    if (cuenta('igual')) partes.push(`${cuenta('igual')} sin cambios`);
    if (cuenta('omitido')) partes.push(`${cuenta('omitido')} omitido${cuenta('omitido') === 1 ? '' : 's'}`);
    if (errores) partes.push(`${errores} con error`);
    if (cuenta('cancelado')) partes.push(`${cuenta('cancelado')} cancelado${cuenta('cancelado') === 1 ? '' : 's'}`);
    resumen = partes.join(' · ') || 'Carpetas creadas';
  }
  const ordenadas = [...filas].sort((a, b) => (ORDEN[a.estado] ?? 3) - (ORDEN[b.estado] ?? 3));

  return (
    <section className={styles.panel} role="status" aria-label="Progreso de la subida">
      <div className={styles.panelCabecera}>
        <div className={styles.panelTitulo}>
          <strong>{terminada ? (cancelada ? 'Subida cancelada' : 'Subida terminada') : `Subiendo ${titulo}`}</strong>
          <span>{resumen}</span>
        </div>
        {!terminada && (
          pausada
            ? <button className={styles.panelBoton} onClick={onReanudar} aria-label="Reanudar" title="Reanudar"><Play size={14} /></button>
            : <button className={styles.panelBoton} onClick={onPausar} aria-label="Pausar" title="Pausar"><Pause size={14} /></button>
        )}
        <button
          className={styles.panelBoton}
          onClick={() => setMinimizado((m) => !m)}
          aria-label={minimizado ? 'Mostrar detalle' : 'Ocultar detalle'}
          title={minimizado ? 'Mostrar detalle' : 'Ocultar detalle'}
        >
          {minimizado ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
        {terminada && (
          <button className={styles.panelBoton} onClick={onCerrar} aria-label="Cerrar" title="Cerrar"><X size={14} /></button>
        )}
      </div>
      <div className={styles.barra} aria-hidden="true">
        <div className={`${styles.barraAvance} ${errores ? styles.barraConError : ''}`} style={{ width: `${porcentaje}%` }} />
      </div>

      {!minimizado && (
        <>
          <ul className={styles.panelLista}>
            {ordenadas.map((f) => {
              const estado = ESTADOS[f.estado];
              return (
                <li key={f.id}>
                  <div className={styles.panelArchivo}>
                    <span title={f.nombre}>{f.nombre}</span>
                    <small title={f.error || f.ruta}>{f.error || f.ruta || 'Carpeta de destino'}</small>
                  </div>
                  <span className={`${styles.estado} ${styles[estado.clase]}`}>
                    {estado.texto ?? `${Math.round(f.progreso * 100)} %`}
                  </span>
                  {f.estado === 'error' && !cancelada && (
                    <button className={styles.reintentar} onClick={() => onReintentar(f.id)}>Reintentar</button>
                  )}
                </li>
              );
            })}
          </ul>
          {!terminada && (
            <div className={styles.panelPie}>
              <span>Puedes seguir trabajando mientras se sube</span>
              <button className={styles.cancelar} onClick={onCancelar}>Cancelar</button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
