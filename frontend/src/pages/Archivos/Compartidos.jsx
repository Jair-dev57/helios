import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Copy, Settings2, Lock, Plus } from 'lucide-react';
import { obtenerCompartidosGlobal } from '../../api/enlaces';
import ModalCompartir from '../Proyectos/ModalCompartir';
import ListaArchivos from './ListaArchivos';
import { ElegirCarpeta } from './Solicitudes';
import { copiarEnlace } from './copiarEnlace';
import { fechaRelativa, fechaCompleta, nombreArchivo, plural } from '../Proyectos/formato';
import panel from '../Proyectos/Proyectos.module.css';

const formatoDia = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short' });

const MODOS = [
  ['contigo', 'Conmigo'],
  ['tuyos', 'Por mí'],
  ['publicos', 'Enlaces públicos'],
  ['solicitudes', 'Solicitudes'],
];

const delEnlace = (e) => e.objeto;
const claveEnlace = (e) => `enlace:${e.id}`;
const fecha = (iso) => <span title={fechaCompleta(iso)}>{fechaRelativa(iso)}</span>;
const cierre = (e) => (e.expira_at ? `${e.vigente ? 'Hasta' : 'Cerró'} el ${formatoDia.format(new Date(e.expira_at))}` : e.vigente ? 'Sin fecha' : 'Cerrado');

// Columnas de cada modo, despues de Nombre
const COLUMNAS = {
  contigo: [
    { clave: 'modificado', titulo: 'Modificado', valor: (o) => o.updated_at, celda: (o) => fecha(o.updated_at) },
    { clave: 'acceso', titulo: 'Acceso', celda: () => <span><Lock size={12} /> Restringido</span> },
  ],
  enlaces: [
    { clave: 'visitas', titulo: 'Visitas', valor: (e) => e.accesos, celda: (e) => e.accesos },
    { clave: 'vence', titulo: 'Vence', valor: (e) => e.expira_at, celda: (e) => <>{cierre(e)}{e.tiene_contrasena && <Lock size={12} aria-label="Con contraseña" style={{ marginLeft: 6 }} />}</> },
    { clave: 'creado', titulo: 'Creado', valor: (e) => e.created_at, celda: (e) => <>{fecha(e.created_at)}{!e.creado_por_mi && e.creado_por && ` · ${e.creado_por}`}</> },
  ],
  solicitudes: [
    { clave: 'recibidos', titulo: 'Recibidos', valor: (e) => e.recibidos, celda: (e) => e.recibidos },
    { clave: 'semana', titulo: 'Esta semana', valor: (e) => e.recibidos_semana, celda: (e) => (e.recibidos_semana ? `+${e.recibidos_semana}` : '—') },
    { clave: 'cierra', titulo: 'Cierra', valor: (e) => e.expira_at, celda: cierre },
    { clave: 'estado', titulo: 'Estado', valor: (e) => e.vigente, celda: (e) => (e.vigente ? 'Abierta' : 'Cerrada') },
  ],
};

/** Lo compartido en todos los proyectos y espacios: conmigo, por mí, enlaces públicos y solicitudes de archivos */
export default function Compartidos() {
  const [datos, setDatos] = useState(null);
  // ?ver=solicitudes abre ese modo (la antigua página Solicitudes redirige aqui)
  const [params, setParams] = useSearchParams();
  const modo = MODOS.some(([id]) => id === params.get('ver')) ? params.get('ver') : 'contigo';
  const setModo = (id) => setParams(id === 'contigo' ? {} : { ver: id }, { replace: true });
  const [gestionando, setGestionando] = useState(null);
  const [eligiendo, setEligiendo] = useState(false);

  const cargar = () => obtenerCompartidosGlobal()
    .then(setDatos)
    .catch(() => { setDatos({ conmigo: [], enlaces: [] }); toast.error('No se pudo cargar lo compartido.'); });
  useEffect(() => { cargar(); }, []);

  const enlaces = datos?.enlaces || [];
  const listas = {
    contigo: datos?.conmigo || [],
    tuyos: enlaces.filter((e) => e.permiso === 'ver' && e.creado_por_mi),
    publicos: enlaces.filter((e) => e.permiso === 'ver' && e.vigente),
    solicitudes: enlaces.filter((e) => e.permiso === 'subir'),
  };
  const esEnlace = modo !== 'contigo';

  const gestionar = (e) => setGestionando({
    objetivo: { tipo: e.objeto.tipo, id: e.objeto.id, nombre: e.objeto.tipo === 'documento' ? nombreArchivo(e.objeto.nombre, e.objeto.extension) : e.objeto.nombre },
    // Como en Solicitudes: el modal abre en «ver»; solo una solicitud nueva abre en «subir»
    permiso: 'ver',
  });
  const accionesEnlace = (e) => [
    e.vigente && { texto: 'Copiar enlace', Icono: Copy, accion: () => copiarEnlace(e.token) },
    { texto: modo === 'solicitudes' ? 'Gestionar solicitud…' : 'Gestionar enlaces…', Icono: Settings2, accion: () => gestionar(e) },
  ].filter(Boolean);

  const subbarra = (
    <>
      <div className={panel.segmento} role="group" aria-label="Qué mostrar">
        {MODOS.map(([id, texto]) => (
          <button key={id} type="button" aria-pressed={modo === id} onClick={() => setModo(id)}>
            {texto} {datos && <span className={panel.cuenta}>{listas[id].length}</span>}
          </button>
        ))}
      </div>
      {modo === 'solicitudes' && (
        <>
          <span className={panel.espacio} />
          <button type="button" className={panel.chip} onClick={() => setEligiendo(true)}><Plus size={14} /> Nueva solicitud</button>
        </>
      )}
    </>
  );

  const vacios = {
    contigo: ['Nadie te ha compartido archivos restringidos', 'Cuando alguien te dé acceso a un archivo restringido, aparecerá aquí.'],
    tuyos: ['No has compartido enlaces', 'Comparte un archivo o una carpeta con clic derecho → «Compartir enlace…».'],
    publicos: ['No hay enlaces públicos vigentes', 'Los enlaces que se compartan en tus proyectos y espacios aparecerán aquí.'],
    solicitudes: ['Aún no hay solicitudes', 'Crea una con «Nueva solicitud»: quien tenga el enlace podrá enviarte archivos sin cuenta.'],
  };

  return (
    <>
      <ListaArchivos
        key={modo}
        titulo="Compartidos"
        items={datos ? listas[modo] : null}
        objeto={esEnlace ? delEnlace : undefined}
        claveItem={esEnlace ? claveEnlace : null}
        columnas={esEnlace ? COLUMNAS[modo === 'solicitudes' ? 'solicitudes' : 'enlaces'] : COLUMNAS.contigo}
        subbarra={subbarra}
        menu={esEnlace ? (e, base) => [...base, null, ...accionesEnlace(e)] : undefined}
        extraPanel={esEnlace ? (e) => (
          <div className={panel.botones}>
            {accionesEnlace(e).map((a) => (
              <button key={a.texto} type="button" onClick={a.accion}><a.Icono size={14} /> {a.texto.replace('…', '')}</button>
            ))}
          </div>
        ) : undefined}
        vacio={<><b>{vacios[modo][0]}</b>{vacios[modo][1]}</>}
        estado={(n) => (modo === 'solicitudes' ? plural(n, 'solicitud', 'solicitudes') : esEnlace ? plural(n, 'enlace') : plural(n, 'elemento'))}
      />

      {eligiendo && (
        <ElegirCarpeta
          onClose={() => setEligiendo(false)}
          onElegida={(objetivo) => { setEligiendo(false); setGestionando({ objetivo, permiso: 'subir' }); }}
        />
      )}
      {gestionando && (
        <ModalCompartir
          objetivo={gestionando.objetivo}
          permisoInicial={gestionando.permiso === 'subir' ? 'subir' : 'ver'}
          onClose={() => { setGestionando(null); cargar(); }}
        />
      )}
    </>
  );
}
