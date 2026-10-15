import {
  Search, FolderKanban, FileText, ListTodo, ListChecks, CalendarDays, Activity, FolderOpen, Users, UserCog, Shield,
  History, Building2,
} from 'lucide-react';

// Secciones que se pueden dar con el Acceso basico o con un equipo (las claves son las del backend)
export const GRUPOS_SECCIONES = [
  {
    titulo: 'General',
    items: [
      { seccion: 'busqueda', label: 'Búsqueda global', descripcion: 'Buscar en toda la aplicación', Icon: Search },
      { seccion: 'mis_tareas', label: 'Mis tareas', descripcion: 'Sus tareas asignadas', Icon: ListChecks },
      { seccion: 'calendario', label: 'Calendario', descripcion: 'Fechas y entregas', Icon: CalendarDays },
      { seccion: 'archivos', label: 'Archivos', descripcion: 'Mis archivos y carpetas de equipo', Icon: FolderOpen },
      { seccion: 'documentos', label: 'Documentos', descripcion: 'Abrir y subir archivos (lo necesita Archivos)', Icon: FileText },
    ],
  },
  {
    titulo: 'Trabajo',
    items: [
      { seccion: 'proyectos', label: 'Proyectos', descripcion: 'Ver y editar proyectos', Icon: FolderKanban },
      { seccion: 'tareas', label: 'Tareas de proyectos', descripcion: 'Todas las tareas de sus proyectos', Icon: ListTodo },
      { seccion: 'clientes', label: 'Clientes', descripcion: 'Directorio de clientes', Icon: Users },
      { seccion: 'actividad', label: 'Actividad del equipo', descripcion: 'Lo que hacen los demás', Icon: Activity },
    ],
  },
  {
    titulo: 'Administración',
    items: [
      { seccion: 'usuarios', label: 'Personas', descripcion: 'Ver la lista de personas', Icon: UserCog },
      { seccion: 'equipos', label: 'Equipos y permisos', descripcion: 'Ver los equipos y sus permisos', Icon: Shield },
      { seccion: 'historial', label: 'Historial', descripcion: 'Registro de cambios', Icon: History },
      { seccion: 'configuracion', label: 'Datos de la empresa', descripcion: 'Nombre, logo y datos de contacto', Icon: Building2 },
    ],
  },
];

export const SECCIONES = GRUPOS_SECCIONES.flatMap((g) => g.items);

/**
 * De donde le viene cada seccion a una persona: { seccion: ['admin'] | ['basico'] | [equipo_id, ...] }.
 * Lo del Acceso basico no se repite como equipo.
 */
export function origenPermisos(persona, equipos, basico) {
  if (persona.es_administrador) return Object.fromEntries(SECCIONES.map((s) => [s.seccion, ['admin']]));
  const origen = {};
  basico.forEach((s) => { origen[s] = ['basico']; });
  equipos
    .filter((e) => persona.equipo_ids?.includes(e.id))
    .forEach((e) => e.secciones.forEach((s) => {
      if (!origen[s]?.includes('basico')) origen[s] = [...(origen[s] || []), e.id];
    }));
  return origen;
}
