import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { FolderOpen, Star } from 'lucide-react';
import { rutaObjeto, nombreLugar, claveObjeto } from '../../api/espacios';
import { obtenerFavoritosGlobal, marcarFavorito, EVENTO_FAVORITOS_ARCHIVOS } from '../../api/favoritos';
import Explorador, { TIPO_ARCHIVO } from '../../components/explorador/Explorador';
import IconoArchivo from '../../components/ui/IconoArchivo';
import PageContainer from '../../components/ui/PageContainer';
import IconoCarpeta from '../../components/ui/IconoCarpeta';
import { nombreArchivo } from '../../utils/formato';
import { useVistaGuardada } from '../../hooks/useVistaGuardada';
import panel from '../../components/explorador/PiezasExplorador.module.css';

const identidad = (i) => i;
const nombreObjeto = (o) => (o.tipo === 'documento' ? nombreArchivo(o.nombre, o.extension) : o.nombre);
const objetivoFavorito = (o) => (o.tipo === 'documento' ? { documento_id: o.id } : { carpeta_id: o.id });

/**
 * Los lugares de Archivos que juntan cosas de todos los proyectos y espacios (Recientes, Favoritos,
 * Compartidos y Papelera), en la misma ventana de explorador que Proyectos.
 *
 * items: filas (null mientras carga); objeto(item): el documento o la carpeta (forma de ObjetoCompartido);
 * claveItem(item): clave de la fila cuando un mismo objeto puede salir varias veces (p. ej. dos enlaces).
 * columnas: las de despues de Nombre [{ clave, titulo, celda(item), valor?(item) }].
 * menu(item, base) y extraPanel(item) agregan a lo comun (abrir, favorito); base son esas opciones.
 * conAcciones: false en la Papelera, donde no se abre ni se marca nada.
 */
export default function ListaArchivos({
  titulo, items, objeto = identidad, claveItem = null, conAcciones = true, columnas, grupo, subbarra, vacio, menu, extraPanel, abrir, estado,
}) {
  const navigate = useNavigate();
  const [vista, cambiarVista] = useVistaGuardada('archivos.vistaLugares', ['iconos', 'lista'], 'lista');
  const [info, cambiarInfo] = useVistaGuardada('archivos.infoLugares', ['si', 'no'], 'si');
  const [seleccion, setSeleccion] = useState(null);
  const [busqueda, setBusqueda] = useState('');
  const [orden, setOrden] = useState(null);
  const [favoritos, setFavoritos] = useState(new Set());

  // Que tiene estrella, para la marca y el menu; se actualiza al cambiar Favoritos en cualquier lado
  useEffect(() => {
    const cargar = () => obtenerFavoritosGlobal().then((f) => setFavoritos(new Set(f.map(claveObjeto)))).catch(() => {});
    cargar();
    window.addEventListener(EVENTO_FAVORITOS_ARCHIVOS, cargar);
    return () => window.removeEventListener(EVENTO_FAVORITOS_ARCHIVOS, cargar);
  }, []);

  const elementos = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    let lista = (items || []).map((item) => {
      const o = objeto(item);
      const fav = claveObjeto(o);
      return { item, o, fav, id: claveItem ? claveItem(item) : fav, claveArrastre: fav, nombre: nombreObjeto(o) };
    });
    if (texto) lista = lista.filter((e) => e.nombre.toLowerCase().includes(texto) || nombreLugar(e.o).toLowerCase().includes(texto));
    if (orden) {
      const col = orden.col === 'nombre' ? { valor: (i) => nombreObjeto(objeto(i)).toLowerCase() } : columnas.find((c) => c.clave === orden.col);
      lista = [...lista].sort((a, b) => {
        const x = col.valor(a.item) ?? '';
        const y = col.valor(b.item) ?? '';
        return (x > y ? 1 : x < y ? -1 : 0) * orden.dir;
      });
    }
    return lista;
  }, [items, objeto, claveItem, busqueda, orden, columnas]);

  const abrirObjeto = (e) => (abrir ? abrir(e.item) : navigate(rutaObjeto(e.o)));
  const alternarFavorito = async (e) => {
    const marcar = !favoritos.has(e.fav);
    try {
      await marcarFavorito(objetivoFavorito(e.o), marcar);
      toast.success(marcar ? 'Añadido a Favoritos' : 'Quitado de Favoritos');
    } catch {
      toast.error('No se pudo cambiar Favoritos.');
    }
  };

  const icono = (e, size) => (e.o.tipo === 'documento'
    ? <IconoArchivo tipo={e.o.extension} size={size} />
    : <IconoCarpeta color={e.o.color} size={size} />);

  const base = (e) => [
    { texto: e.o.tipo === 'documento' ? 'Abrir' : 'Abrir carpeta', Icono: FolderOpen, accion: () => abrirObjeto(e), atajo: 'Enter' },
    { texto: favoritos.has(e.fav) ? 'Quitar de Favoritos' : 'Agregar a Favoritos', Icono: Star, accion: () => alternarFavorito(e), atajo: 'Ctrl+D' },
  ];

  const panelInfo = (e) => (
    <>
      <div className={panel.infoCabecera}>
        {icono(e, 72)}
        <h2>{e.nombre}</h2>
        <span className={panel.subtitulo}>{nombreLugar(e.o)}</span>
      </div>
      {conAcciones && <div className={panel.botones}>
        <button type="button" className={panel.primario} onClick={() => abrirObjeto(e)}>
          <FolderOpen size={14} /> {e.o.tipo === 'documento' ? 'Abrir' : 'Abrir carpeta'}
        </button>
        <button type="button" onClick={() => alternarFavorito(e)}>
          <Star size={14} fill={favoritos.has(e.fav) ? 'currentColor' : 'none'} /> {favoritos.has(e.fav) ? 'Quitar' : 'Favorito'}
        </button>
      </div>}
      <dl className={panel.datos}>
        <dt>Lugar</dt><dd>{nombreLugar(e.o)}</dd>
        {columnas.map((c) => (
          <FilaDato key={c.clave} titulo={c.titulo}>{c.celda(e.item)}</FilaDato>
        ))}
      </dl>
      {extraPanel?.(e.item)}
    </>
  );

  const n = elementos.length;
  return (
    <PageContainer wide>
      <Explorador
        titulo={titulo}
        elementos={elementos}
        columnas={[
          { clave: 'nombre', titulo: 'Nombre', ordenable: true },
          ...columnas.map((c) => ({ ...c, ordenable: !!c.valor, celda: (e) => c.celda(e.item) })),
        ]}
        grupo={grupo && !orden ? (e) => grupo(e.item) : undefined}
        icono={icono}
        detalle={(e) => nombreLugar(e.o)}
        subtitulo={(e) => nombreLugar(e.o)}
        marcas={(e) => favoritos.has(e.fav) && <Star size={11} fill="currentColor" style={{ color: 'var(--accent)', flexShrink: 0 }} aria-label="Favorito" />}
        orden={orden}
        onOrdenar={(col) => setOrden((o) => (o?.col === col ? (o.dir > 0 ? { col, dir: -1 } : null) : { col, dir: 1 }))}
        vista={vista}
        onVista={cambiarVista}
        conInfo={info === 'si'}
        onInfo={(si) => cambiarInfo(si ? 'si' : 'no')}
        seleccion={seleccion}
        onSeleccion={setSeleccion}
        onAbrir={abrirObjeto}
        onFavorito={conAcciones ? alternarFavorito : undefined}
        menu={(e) => (menu ? menu(e.item, base(e)) : base(e))}
        panel={panelInfo}
        subbarra={subbarra}
        vacio={vacio}
        busqueda={busqueda}
        onBusqueda={setBusqueda}
        estado={estado ? estado(n) : `${n} ${n === 1 ? 'elemento' : 'elementos'}`}
        cargando={items === null}
        tipoArrastre={TIPO_ARCHIVO}
      />
    </PageContainer>
  );
}

function FilaDato({ titulo, children }) {
  return <><dt>{titulo}</dt><dd>{children}</dd></>;
}
