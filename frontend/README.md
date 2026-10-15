# Helios — frontend

React + Vite. `pnpm dev` para desarrollo, `pnpm build` para producción y `pnpm lint` para revisar el código.

## Estructura de `src/`

| Carpeta | Contenido |
| --- | --- |
| `api/` | Llamadas al backend, un archivo por recurso (`client.js` es la instancia de axios). |
| `components/ui/` | Piezas pequeñas usadas en toda la app: `Avatar`, iconos, `LogoCliente`, `MarcaEmpresa`, `PageContainer`. |
| `components/explorador/` | `Explorador` (vista de carpetas/lista de proyectos, clientes y archivos) y las piezas que las páginas le pasan. |
| `components/documentos/` | Visor de documentos y sus comentarios. |
| `components/compartir/` | Enlaces públicos y solicitudes de archivos: `ModalCompartir`, `Solicitudes`, `ObjetoCompartido`. |
| `components/espacios/` | `ModalEspacio`: crear o editar el espacio de archivos de un equipo. |
| `components/graficos/` | Gráficos SVG del tablero (anillo, barras, líneas, mapa de proyectos, mapa de calor). |
| `context/` | Proveedores de React (sesión, empresa, tema). |
| `hooks/` | Hooks propios; los contextos se leen con `useAuth`, `useEmpresa` y `useTheme`. |
| `layouts/` | El marco de la app: `DashboardLayout`, barra lateral, búsqueda y notificaciones. |
| `pages/` | Una carpeta por sección. `Documentos/` es el explorador de archivos de un proyecto o de un espacio de equipo; `Proyectos/proyecto/` son las pestañas de un proyecto abierto. |
| `routes/` | Rutas y la protección por sección. |
| `styles/` | Tema (`tema/`: `base`, `claro` y `oscuro`) y estilos compartidos: `shared`, `formulario`, `listado`, `cabecera` (cabecera con pestañas de un proyecto o equipo) y `tablero` (tarjetas del Inicio y del resumen). |
| `utils/` | Funciones sin React: formatos de fecha y tamaño, colores, subida de carpetas, enlaces. |

## Reglas para mantener el orden

- `components/`, `layouts/`, `hooks/` y `utils/` no importan nada de `pages/`.
- Una página no importa archivos de otra página. Si algo se comparte, va a `components/` (o a `styles/` si es solo CSS).
  La única excepción es la pestaña Proyectos de un equipo (`Archivos/EspacioLayout`), que muestra la página `Proyectos`.
- Cada componente importa su propio `.module.css`; no se usan clases del CSS de otra página.
