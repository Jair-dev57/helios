import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, LayoutGrid, List, Info, Search, Plus } from 'lucide-react';
import styles from './Explorador.module.css';

// Tipo de dato al arrastrar un elemento (la barra lateral lo recibe en Favoritos)
export const TIPO_ARRASTRE = 'application/x-helios-proyecto';

// En pantallas tactiles un toque abre (no hay doble clic)
const esTactil = () => window.matchMedia?.('(hover: none)').matches;

/**
 * Ventana tipo explorador del sistema (Finder / Explorador de Windows): barra de herramientas con
 * atras/adelante, vistas Iconos y Lista, panel de informacion, menu contextual, teclado y barra de estado.
 *
 * elementos: [{ id, nombre, ... }] ya filtrados; columnas: [{ clave, titulo, celda(e), ordenable? }].
 * grupo(e): titulo del grupo (p. ej. «Hoy») o undefined. icono(e, size), detalle(e) bajo el nombre en iconos,
 * subtitulo(e) bajo el nombre en la lista. titulo puede ser texto o una ruta («Clientes › UNAD»).
 * menu(e): [{ texto, Icono, accion, atajo } | null] (null = separador). panel(e): contenido del panel de informacion.
 */
export default function Explorador({
  titulo,
  elementos,
  columnas,
  grupo,
  icono,
  detalle,
  subtitulo,
  marcas,
  orden,
  onOrdenar,
  vista,
  onVista,
  conInfo,
  onInfo,
  seleccion,
  onSeleccion,
  onAbrir,
  onFavorito,
  menu,
  panel,
  subbarra,
  vacio,
  busqueda,
  onBusqueda,
  onNuevo,
  estado,
  cargando,
}) {
  const navigate = useNavigate();
  const [contexto, setContexto] = useState(null);
  const puedeVolver = (window.history.state?.idx ?? 0) > 0;

  // El menu contextual se cierra al hacer clic fuera, con Escape o al desplazarse
  useEffect(() => {
    if (!contexto) return undefined;
    const cerrar = () => setContexto(null);
    window.addEventListener('click', cerrar);
    window.addEventListener('scroll', cerrar, true);
    return () => { window.removeEventListener('click', cerrar); window.removeEventListener('scroll', cerrar, true); };
  }, [contexto]);

  const seleccionado = elementos.find((e) => e.id === seleccion);

  const teclado = (ev) => {
    if (ev.target.tagName === 'INPUT') return;
    const ctrl = ev.ctrlKey || ev.metaKey;
    if (ev.key === 'Escape') { setContexto(null); onSeleccion(null); return; }
    if (['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight'].includes(ev.key) && !ev.altKey && elementos.length) {
      ev.preventDefault();
      const i = elementos.findIndex((e) => e.id === seleccion);
      const paso = ev.key === 'ArrowDown' || ev.key === 'ArrowRight' ? 1 : -1;
      onSeleccion(elementos[Math.max(0, Math.min(elementos.length - 1, i < 0 ? 0 : i + paso))].id);
    }
    if (ev.key === 'Enter' && seleccionado) onAbrir(seleccionado);
    if (ctrl && ev.key.toLowerCase() === 'd' && seleccionado && onFavorito) { ev.preventDefault(); onFavorito(seleccionado); }
    if (ctrl && ev.key.toLowerCase() === 'i') { ev.preventDefault(); onInfo(!conInfo); }
    if (ctrl && (ev.key === '1' || ev.key === '2')) { ev.preventDefault(); onVista(ev.key === '1' ? 'iconos' : 'lista'); }
    if (ev.altKey && ev.key === 'ArrowLeft') navigate(-1);
    if (ev.altKey && ev.key === 'ArrowRight') navigate(1);
  };

  // Clic selecciona; doble clic (o un toque en pantallas tactiles) abre; clic derecho abre el menu
  const propsElemento = (e) => ({
    'data-id': e.id,
    draggable: true,
    onClick: (ev) => { ev.stopPropagation(); if (esTactil()) onAbrir(e); else onSeleccion(e.id); },
    onDoubleClick: () => onAbrir(e),
    onContextMenu: (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      onSeleccion(e.id);
      setContexto({ x: Math.min(ev.clientX, window.innerWidth - 230), y: ev.clientY, elemento: e });
    },
    onDragStart: (ev) => {
      ev.dataTransfer.setData(TIPO_ARRASTRE, String(e.id));
      ev.dataTransfer.setData('text/plain', e.nombre);
      ev.dataTransfer.effectAllowed = 'copyMove';
    },
  });

  // Grupos seguidos (Recientes: Hoy, Ayer…); sin grupo, uno solo sin titulo
  const grupos = [];
  elementos.forEach((e) => {
    const g = grupo?.(e);
    if (!grupos.length || grupos.at(-1).titulo !== g) grupos.push({ titulo: g, items: [] });
    grupos.at(-1).items.push(e);
  });

  const lista = (
    <table className={styles.tabla}>
      <thead>
        <tr>
          {columnas.map((c) => (
            <th
              key={c.clave}
              className={c.ordenable && onOrdenar ? styles.ordenable : ''}
              onClick={c.ordenable && onOrdenar ? () => onOrdenar(c.clave) : undefined}
              aria-sort={orden?.col === c.clave ? (orden.dir > 0 ? 'ascending' : 'descending') : undefined}
            >
              {c.titulo}
              {orden?.col === c.clave && <span className={styles.flecha}>{orden.dir > 0 ? '▲' : '▼'}</span>}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {grupos.map((g, gi) => [
          g.titulo && (
            <tr key={`g${gi}`} className={styles.filaGrupo}><td colSpan={columnas.length}>{g.titulo}</td></tr>
          ),
          ...g.items.map((e) => (
            <tr key={e.id} className={seleccion === e.id ? styles.seleccionada : ''} {...propsElemento(e)}>
              {columnas.map((c, i) => (
                <td key={c.clave}>
                  {i === 0 ? (
                    <span className={styles.celdaNombre}>
                      {icono(e, subtitulo ? 26 : 18)}
                      {subtitulo ? (
                        <span className={styles.nombreDoble}><b>{e.nombre}</b><small>{subtitulo(e)}</small></span>
                      ) : <b>{e.nombre}</b>}
                      {marcas?.(e)}
                    </span>
                  ) : c.celda(e)}
                </td>
              ))}
            </tr>
          )),
        ])}
      </tbody>
    </table>
  );

  const iconos = (
    <div className={styles.rejilla}>
      {grupos.map((g, gi) => [
        g.titulo && <div key={`g${gi}`} className={styles.grupoTitulo}>{g.titulo}</div>,
        ...g.items.map((e) => (
          <div key={e.id} className={`${styles.tile} ${seleccion === e.id ? styles.seleccionada : ''}`} {...propsElemento(e)}>
            {icono(e, 58)}
            <b>{e.nombre}</b>
            {detalle && <small>{detalle(e)}</small>}
          </div>
        )),
      ])}
    </div>
  );

  return (
    <section className={styles.ventana} onKeyDown={teclado}>
      <div className={styles.herramientas}>
        <button type="button" className={styles.boton} onClick={() => navigate(-1)} disabled={!puedeVolver} title="Atrás (Alt+←)" aria-label="Atrás">
          <ChevronLeft size={17} />
        </button>
        <button type="button" className={styles.boton} onClick={() => navigate(1)} title="Adelante (Alt+→)" aria-label="Adelante">
          <ChevronRight size={17} />
        </button>
        <h1 className={styles.titulo}>{titulo}</h1>
        <span className={styles.espacio} />
        <div className={styles.grupoBotones} role="group" aria-label="Vista">
          <button type="button" className={styles.boton} aria-pressed={vista === 'iconos'} onClick={() => onVista('iconos')} title="Iconos (Ctrl+1)" aria-label="Vista de iconos">
            <LayoutGrid size={15} />
          </button>
          <button type="button" className={styles.boton} aria-pressed={vista === 'lista'} onClick={() => onVista('lista')} title="Lista (Ctrl+2)" aria-label="Vista de lista">
            <List size={15} />
          </button>
        </div>
        <button type="button" className={`${styles.boton} ${styles.soloAncho}`} aria-pressed={conInfo} onClick={() => onInfo(!conInfo)} title="Información (Ctrl+I)" aria-label="Panel de información">
          <Info size={16} />
        </button>
        <label className={styles.buscar}>
          <Search size={14} />
          <input value={busqueda} onChange={(ev) => onBusqueda(ev.target.value)} placeholder="Buscar" aria-label="Buscar" />
        </label>
        {onNuevo && (
          <button type="button" className={styles.nuevo} onClick={onNuevo}>
            <Plus size={15} /> Nuevo
          </button>
        )}
      </div>

      {subbarra && <div className={styles.subbarra}>{subbarra}</div>}

      <div className={styles.cuerpo}>
        <div className={styles.contenido} tabIndex={0} onClick={() => onSeleccion(null)}>
          {cargando ? <p className={styles.vacio}>Cargando…</p>
            : elementos.length === 0 ? <div className={styles.vacio}>{vacio}</div>
              : vista === 'iconos' ? iconos : lista}
        </div>
        {conInfo && (
          <aside className={styles.info} aria-label="Información">
            {seleccionado ? panel(seleccionado) : <p className={styles.infoVacia}>Selecciona un elemento para ver su información.</p>}
          </aside>
        )}
      </div>

      <footer className={styles.estado}>
        <span>{estado}{seleccionado && ', 1 seleccionado'}</span>
        <span>{seleccionado?.nombre}</span>
      </footer>

      {contexto && createPortal(
        <div className={styles.menuContextual} style={{ left: contexto.x, top: contexto.y }} role="menu" onClick={(ev) => ev.stopPropagation()}>
          {menu(contexto.elemento).map((op, i) => (op ? (
            <button
              key={op.texto}
              type="button"
              role="menuitem"
              onClick={() => { setContexto(null); op.accion(); }}
            >
              {op.Icono && <op.Icono size={15} />}
              {op.texto}
              {op.atajo && <kbd>{op.atajo}</kbd>}
            </button>
          ) : <hr key={`s${i}`} />))}
        </div>,
        document.body,
      )}
    </section>
  );
}
