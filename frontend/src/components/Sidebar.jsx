import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  Layers, Users, Settings, LogOut, X, PanelLeftClose, PanelLeftOpen, ListChecks, CalendarDays,
  Activity, House, FolderOpen, Clock, Star, Share2, Trash2, Archive, Plus,
} from 'lucide-react';
import { listarMisTareas, EVENTO_MIS_TAREAS } from '../api/tareas';
import { listarEspacios, EVENTO_ESPACIOS } from '../api/espacios';
import { useAuth } from '../hooks/useAuth';
import MarcaEmpresa from './MarcaEmpresa';
import FavoritosLateral from './FavoritosLateral';
import ModalEspacio from '../pages/Archivos/ModalEspacio';
import styles from './Sidebar.module.css';

const ARCHIVOS = ['archivos', 'documentos'];
// Areas que se listan en el menu antes de «Ver más»
const MAX_LISTA = 5;

// Menu de cada modulo; cada opcion aparece solo si el rol tiene su seccion (o todas, si es una lista)
const MODULOS = {
  proyectos: {
    titulo: 'Proyectos',
    // Como la barra lateral de un explorador: lugares, Favoritos fijados, Mi trabajo, Clientes y Equipos
    grupos: [
      {
        items: [
          { to: '/proyectos/recientes', label: 'Recientes', Icon: Clock, seccion: 'proyectos' },
          { to: '/proyectos', label: 'Todos los proyectos', Icon: Layers, seccion: 'proyectos', activoEnProyectos: true, inicio: true },
          { to: '/proyectos/compartidos', label: 'Compartidos', Icon: Share2, seccion: 'proyectos' },
        ],
      },
      { titulo: 'Favoritos', favoritos: true, items: [] },
      {
        titulo: 'Mi trabajo',
        items: [
          { to: '/mis-tareas', label: 'Mis tareas', Icon: ListChecks, seccion: 'mis_tareas', contador: 'misTareas' },
          { to: '/calendario', label: 'Calendario', Icon: CalendarDays, seccion: 'calendario' },
        ],
      },
      {
        titulo: 'Clientes',
        items: [{ to: '/proyectos/clientes', label: 'Todos los clientes', Icon: Users, seccion: 'clientes' }],
      },
      // Las mismas areas de Archivos: cada una filtra Mis proyectos (?area=ID)
      { titulo: 'Equipos', espacios: true, items: [] },
    ],
    pie: [{ to: '/proyectos/archivados', label: 'Archivados', Icon: Archive, seccion: 'proyectos' }],
  },
  archivos: {
    titulo: 'Archivos',
    grupos: [
      {
        items: [
          { to: '/archivos', label: 'Mis archivos', end: true, Icon: FolderOpen, seccion: ARCHIVOS },
          { to: '/archivos/recientes', label: 'Recientes', Icon: Clock, seccion: ARCHIVOS },
          { to: '/archivos/favoritos', label: 'Favoritos', Icon: Star, seccion: ARCHIVOS },
          { to: '/archivos/compartidos', label: 'Compartidos', Icon: Share2, seccion: ARCHIVOS },
        ],
      },
      // Las areas (espacios de equipo) se agregan al cargar (ver espaciosEquipo)
      { titulo: 'Equipos', espacios: true, items: [] },
    ],
    pie: [{ to: '/archivos/papelera', label: 'Papelera', Icon: Trash2, seccion: ARCHIVOS }],
  },
};

const rutasDe = (modulo) => MODULOS[modulo].grupos.flatMap((g) => g.items.map((i) => i.to)).concat((MODULOS[modulo].pie || []).map((i) => i.to));
const moduloDe = (pathname) => Object.keys(MODULOS).find((m) => (
  m === 'archivos' ? pathname === '/archivos' || pathname.startsWith('/archivos/') : rutasDe(m).some((r) => pathname === r || pathname.startsWith(`${r}/`))
));

// Pendientes de «Mis tareas»: se recalcula al navegar y cuando la pagina avisa un cambio
function usePendientes(activo) {
  const { pathname } = useLocation();
  const [pendientes, setPendientes] = useState(0);
  useEffect(() => {
    if (!activo) return undefined;
    let cancelado = false;
    const contar = () => listarMisTareas()
      .then((t) => { if (!cancelado) setPendientes(t.filter((x) => !x.terminada).length); })
      .catch(() => {});
    contar();
    window.addEventListener(EVENTO_MIS_TAREAS, contar);
    return () => { cancelado = true; window.removeEventListener(EVENTO_MIS_TAREAS, contar); };
  }, [activo, pathname]);
  return pendientes;
}

// Espacios de equipo para el menu de Archivos: se recargan cuando se crea, edita o elimina uno
function useEspaciosEquipo(activo) {
  const [espacios, setEspacios] = useState([]);
  useEffect(() => {
    if (!activo) return undefined;
    let cancelado = false;
    const cargar = () => listarEspacios()
      .then((e) => { if (!cancelado) setEspacios(e.equipo); })
      .catch(() => {});
    cargar();
    window.addEventListener(EVENTO_ESPACIOS, cargar);
    return () => { cancelado = true; window.removeEventListener(EVENTO_ESPACIOS, cargar); };
  }, [activo]);
  return espacios;
}

/**
 * Riel con los modulos (Inicio, Proyectos, Archivos, Actividad) y, al lado, el menu del modulo actual.
 * Colapsar (Ctrl+B) oculta el menu del modulo; el riel siempre queda.
 */
const Sidebar = ({ abierto, onCerrar, colapsado = false, onColapsar }) => {
  const { tieneSeccion, logout, esAdministrador } = useAuth();
  const [creandoEquipo, setCreandoEquipo] = useState(false);
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // alguna: basta una de las secciones (Mis proyectos reune proyectos y clientes)
  const permitido = (item) => [].concat(item.seccion || [])[item.alguna ? 'some' : 'every'](tieneSeccion);
  const verArchivos = ARCHIVOS.every(tieneSeccion);
  const contadores = { misTareas: usePendientes(tieneSeccion('mis_tareas')) };
  const espaciosEquipo = useEspaciosEquipo(verArchivos);

  const modulo = moduloDe(pathname);
  // El modulo Proyectos abre en Todos los proyectos, o en su primera opcion permitida
  const itemsProyectos = MODULOS.proyectos.grupos.flatMap((g) => g.items).filter(permitido);
  const inicioProyectos = (itemsProyectos.find((i) => i.inicio) || itemsProyectos[0])?.to;

  // Hasta MAX_LISTA areas (la abierta siempre se ve) y «Ver más» si quedan otros
  const recortar = (items, rutaTodos) => {
    let visibles = items.slice(0, MAX_LISTA);
    const abierto = items.find((i) => i.to === pathname);
    if (abierto && !visibles.includes(abierto)) visibles = [...visibles.slice(0, MAX_LISTA - 1), abierto];
    if (items.length > visibles.length) visibles.push({ to: rutaTodos, end: true, label: 'Ver más', verMas: true });
    return visibles;
  };

  const grupos = modulo
    ? MODULOS[modulo].grupos
      .map((g) => {
        if (g.favoritos) return tieneSeccion('proyectos') ? g : { ...g, items: [] };
        if (!g.espacios) return { ...g, items: g.items.filter(permitido) };
        if (!verArchivos) return { ...g, items: [] };
        // Al final de la lista, «Nuevo equipo» para los administradores (los unicos que pueden crearlos)
        const crear = esAdministrador ? [{ to: 'nuevo-equipo', nuevoEquipo: true }] : [];
        if (modulo === 'proyectos') {
          const items = espaciosEquipo.map((e) => ({ to: `/proyectos/equipo/${e.id}`, label: e.nombre, color: e.color }));
          return { ...g, items: [...items, ...crear] };
        }
        const items = espaciosEquipo.map((e) => ({ to: `/archivos/equipo/${e.id}`, label: e.nombre, color: e.color }));
        // Sin equipos queda el enlace a la lista
        if (!items.length) return { ...g, items: [{ to: '/archivos/equipo', end: true, label: 'Ver equipos', verMas: true }, ...crear] };
        return { ...g, items: [...recortar(items, '/archivos/equipo'), ...crear] };
      })
      .filter((g) => g.items.length || (g.favoritos && tieneSeccion('proyectos')))
    : [];
  const pie = modulo ? (MODULOS[modulo].pie || []).filter(permitido) : [];

  const claseRiel = (activo) => `${styles.rielItem} ${activo ? styles.rielActivo : ''}`;
  const claseItem = ({ isActive }) => `${styles.navItem} ${isActive ? styles.navItemActive : ''}`;

  // activoEnProyectos: Mis proyectos, tambien dentro de un proyecto (no en la pagina de un equipo)
  // color: el de un equipo, que se muestra como un punto en lugar del icono
  const itemMenu = ({ to, label, end, Icon, color, contador, verMas, nuevoEquipo, activoEnProyectos }) => {
    if (nuevoEquipo) {
      return (
        <button key={to} type="button" className={`${styles.navItem} ${styles.nuevoEquipo}`} onClick={() => setCreandoEquipo(true)}>
          <Plus size={17} strokeWidth={1.6} className={styles.navIcon} />
          <span className={styles.texto}>Nuevo equipo</span>
        </button>
      );
    }
    if (verMas) {
      return (
        <NavLink key={to} to={to} end={end} onClick={onCerrar} className={({ isActive }) => `${styles.verMas} ${isActive ? styles.verMasActivo : ''}`}>
          {label}
        </NavLink>
      );
    }
    const n = contador ? contadores[contador] : 0;
    const contenido = (
      <>
        {Icon && <Icon size={17} strokeWidth={1.6} className={styles.navIcon} />}
        {color !== undefined && <span className={styles.puntoEquipo} style={{ background: color || 'var(--accent)' }} aria-hidden="true" />}
        <span className={styles.texto}>{label}</span>
        {n > 0 && <span className={styles.contador}>{n}</span>}
      </>
    );
    const clase = (isActive) => `${claseItem({ isActive })} ${Icon || color !== undefined ? '' : styles.sinIcono}`;
    if (activoEnProyectos) {
      const propio = /^\/proyectos(\/\d+(\/.*)?)?$/.test(pathname);
      return (
        <Link key={to} to={to} onClick={onCerrar} className={clase(propio)} aria-current={propio ? 'page' : undefined} title={label}>
          {contenido}
        </Link>
      );
    }
    return (
      <NavLink key={to} to={to} end={end} onClick={onCerrar} className={({ isActive }) => clase(isActive)} title={label}>
        {contenido}
      </NavLink>
    );
  };

  return (
    <>
      {abierto && <div className={styles.overlay} onClick={onCerrar} />}
      <aside className={`${styles.sidebar} ${abierto ? styles.sidebarAbierto : ''} ${colapsado ? styles.colapsado : ''}`}>
        <nav className={styles.riel} aria-label="Módulos">
          <MarcaEmpresa tamanoLogo={40} vertical className={styles.marca} classNameNombre={styles.nombreEmpresa} />
          <button className={styles.cerrarBtn} onClick={onCerrar} aria-label="Cerrar menu">
            <X size={20} />
          </button>

          <NavLink to="/" end onClick={onCerrar} className={({ isActive }) => claseRiel(isActive)}>
            <House size={20} strokeWidth={1.6} /> <span>Inicio</span>
          </NavLink>
          {inicioProyectos && (
            <NavLink to={inicioProyectos} onClick={onCerrar} className={claseRiel(modulo === 'proyectos')}>
              <Layers size={20} strokeWidth={1.6} /> <span>Proyectos</span>
              {contadores.misTareas > 0 && <span className={styles.rielContador}>{contadores.misTareas}</span>}
            </NavLink>
          )}
          {verArchivos && (
            <NavLink to="/archivos" onClick={onCerrar} className={claseRiel(modulo === 'archivos')}>
              <FolderOpen size={20} strokeWidth={1.6} /> <span>Archivos</span>
            </NavLink>
          )}
          {tieneSeccion('actividad') && (
            <NavLink to="/actividad" onClick={onCerrar} className={({ isActive }) => claseRiel(isActive)}>
              <Activity size={20} strokeWidth={1.6} /> <span>Actividad</span>
            </NavLink>
          )}

          <div className={styles.rielPie}>
            {modulo && (
              <button
                type="button"
                className={`${styles.rielBoton} ${styles.soloEscritorio}`}
                onClick={onColapsar}
                aria-expanded={!colapsado}
                aria-label={`${colapsado ? 'Mostrar' : 'Ocultar'} menú de ${MODULOS[modulo].titulo}`}
                title={`${colapsado ? 'Mostrar' : 'Ocultar'} menú (Ctrl+B)`}
              >
                {colapsado ? <PanelLeftOpen size={19} /> : <PanelLeftClose size={19} />}
              </button>
            )}
            {/* Todos entran a Configuracion (Mi perfil); Empresa y Usuarios dependen de la seccion */}
            <NavLink
              to="/configuracion"
              onClick={onCerrar}
              className={({ isActive }) => `${styles.rielBoton} ${isActive ? styles.rielActivo : ''}`}
              aria-label="Configuración"
              title="Configuración"
            >
              <Settings size={19} />
            </NavLink>
            <button type="button" className={`${styles.rielBoton} ${styles.salir}`} onClick={handleLogout} aria-label="Cerrar sesión" title="Cerrar sesión">
              <LogOut size={19} />
            </button>
          </div>
        </nav>

        {modulo && (
          <nav className={styles.menu} aria-label={MODULOS[modulo].titulo}>
            <h2 className={styles.menuTitulo}>{MODULOS[modulo].titulo}</h2>
            <div className={styles.nav}>
              {grupos.map((g) => (g.favoritos ? <FavoritosLateral key="favoritos" onCerrar={onCerrar} /> : (
                <div key={g.titulo || 'principal'} className={styles.grupo}>
                  {g.titulo && <span className={styles.grupoTitulo}>{g.titulo}</span>}
                  {g.items.map(itemMenu)}
                </div>
              )))}
            </div>
            {pie.length > 0 && <div className={styles.footer}>{pie.map(itemMenu)}</div>}
          </nav>
        )}
        {/* En un portal: en celular el menu usa transform y encerraria al modal */}
        {creandoEquipo && createPortal(
          <ModalEspacio
            onClose={() => setCreandoEquipo(false)}
            onGuardado={(equipo) => {
              // El menu se recarga solo (crearEspacio avisa); se abre el equipo nuevo en el modulo actual
              setCreandoEquipo(false);
              onCerrar?.();
              navigate(`/${modulo === 'archivos' ? 'archivos' : 'proyectos'}/equipo/${equipo.id}`);
            }}
          />,
          document.body,
        )}
      </aside>
    </>
  );
};

export default Sidebar;
