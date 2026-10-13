import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  FolderKanban, Settings, LogOut, X, PanelLeftClose, PanelLeftOpen, ListChecks, CalendarDays,
  Activity, House, Briefcase, FolderOpen, Clock, Star, Share2, Trash2,
} from 'lucide-react';
import { listarMisTareas, EVENTO_MIS_TAREAS } from '../api/tareas';
import { listarEspacios, EVENTO_ESPACIOS } from '../api/espacios';
import { useAuth } from '../hooks/useAuth';
import MarcaEmpresa from './MarcaEmpresa';
import styles from './Sidebar.module.css';

const ARCHIVOS = ['archivos', 'documentos'];
// Areas que se listan en el menu antes de «Ver más»
const MAX_LISTA = 5;

// Menu de cada modulo; cada opcion aparece solo si el rol tiene su seccion (o todas, si es una lista)
const MODULOS = {
  proyectos: {
    titulo: 'Proyectos',
    grupos: [
      {
        items: [
          { to: '/proyectos', label: 'Mis proyectos', Icon: FolderKanban, seccion: ['proyectos', 'dashboard', 'clientes'], alguna: true, activoSinArea: true },
        ],
      },
      {
        titulo: 'Mi trabajo',
        items: [
          { to: '/mis-tareas', label: 'Mis tareas', Icon: ListChecks, seccion: 'mis_tareas', contador: 'misTareas' },
          { to: '/calendario', label: 'Calendario', Icon: CalendarDays, seccion: 'calendario' },
        ],
      },
      // Las mismas areas de Archivos: cada una filtra Mis proyectos (?area=ID)
      { titulo: 'Áreas', espacios: true, items: [] },
    ],
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
      { titulo: 'Áreas', espacios: true, items: [] },
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
  const { tieneSeccion, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname, search } = useLocation();
  const areaActual = new URLSearchParams(search).get('area');

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // alguna: basta una de las secciones (Mis proyectos reune proyectos, resumen y clientes)
  const permitido = (item) => [].concat(item.seccion || [])[item.alguna ? 'some' : 'every'](tieneSeccion);
  const verArchivos = ARCHIVOS.every(tieneSeccion);
  const contadores = { misTareas: usePendientes(tieneSeccion('mis_tareas')) };
  const espaciosEquipo = useEspaciosEquipo(verArchivos);

  const modulo = moduloDe(pathname);
  // El modulo Proyectos abre en su primera opcion permitida (Mis proyectos, si el rol lo tiene)
  const inicioProyectos = MODULOS.proyectos.grupos.flatMap((g) => g.items).find(permitido)?.to;

  // Hasta MAX_LISTA areas (la abierta siempre se ve) y «Ver más» si quedan otros
  const recortar = (items, rutaTodos) => {
    let visibles = items.slice(0, MAX_LISTA);
    const abierto = items.find((i) => i.activo || i.to === pathname);
    if (abierto && !visibles.includes(abierto)) visibles = [...visibles.slice(0, MAX_LISTA - 1), abierto];
    if (items.length > visibles.length) visibles.push({ to: rutaTodos, end: true, label: 'Ver más', verMas: true });
    return visibles;
  };

  const grupos = modulo
    ? MODULOS[modulo].grupos
      .map((g) => {
        if (!g.espacios) return { ...g, items: g.items.filter(permitido) };
        if (!verArchivos) return { ...g, items: [] };
        if (modulo === 'proyectos') {
          const items = espaciosEquipo.map((e) => ({
            to: `/proyectos?area=${e.id}`, label: e.nombre, activo: pathname === '/proyectos' && areaActual === String(e.id),
          }));
          return { ...g, items };
        }
        const items = espaciosEquipo.map((e) => ({ to: `/archivos/equipo/${e.id}`, label: e.nombre }));
        // Sin areas queda el enlace a la lista (alli un administrador crea la primera)
        if (!items.length) return { ...g, items: [{ to: '/archivos/equipo', end: true, label: 'Ver áreas', verMas: true }] };
        return { ...g, items: recortar(items, '/archivos/equipo') };
      })
      .filter((g) => g.items.length)
    : [];
  const pie = modulo ? (MODULOS[modulo].pie || []).filter(permitido) : [];

  const claseRiel = (activo) => `${styles.rielItem} ${activo ? styles.rielActivo : ''}`;
  const claseItem = ({ isActive }) => `${styles.navItem} ${isActive ? styles.navItemActive : ''}`;

  // activo: lo decide el item (areas, por ?area=); activoSinArea: Mis proyectos, salvo mientras se filtra por area
  const itemMenu = ({ to, label, end, Icon, contador, verMas, activo, activoSinArea }) => {
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
        {Icon && <Icon size={18} strokeWidth={2} className={styles.navIcon} />}
        <span className={styles.texto}>{label}</span>
        {n > 0 && <span className={styles.contador}>{n}</span>}
      </>
    );
    const clase = (isActive) => `${claseItem({ isActive })} ${Icon ? '' : styles.sinIcono}`;
    const propio = activoSinArea ? (pathname === to || pathname.startsWith(`${to}/`)) && !areaActual : activo;
    if (propio !== undefined) {
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
            <House size={21} /> <span>Inicio</span>
          </NavLink>
          {inicioProyectos && (
            <NavLink to={inicioProyectos} onClick={onCerrar} className={claseRiel(modulo === 'proyectos')}>
              <Briefcase size={21} /> <span>Proyectos</span>
              {contadores.misTareas > 0 && <span className={styles.rielContador}>{contadores.misTareas}</span>}
            </NavLink>
          )}
          {verArchivos && (
            <NavLink to="/archivos" onClick={onCerrar} className={claseRiel(modulo === 'archivos')}>
              <FolderOpen size={21} /> <span>Archivos</span>
            </NavLink>
          )}
          {tieneSeccion('actividad') && (
            <NavLink to="/actividad" onClick={onCerrar} className={({ isActive }) => claseRiel(isActive)}>
              <Activity size={21} /> <span>Actividad</span>
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
              {grupos.map((g) => (
                <div key={g.titulo || 'principal'} className={styles.grupo}>
                  {g.titulo && <span className={styles.grupoTitulo}>{g.titulo}</span>}
                  {g.items.map(itemMenu)}
                </div>
              ))}
            </div>
            {pie.length > 0 && <div className={styles.footer}>{pie.map(itemMenu)}</div>}
          </nav>
        )}
      </aside>
    </>
  );
};

export default Sidebar;
