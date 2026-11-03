# Helios

Plataforma de gestión de proyectos y documentación nativa de la nube, desarrollada para Cimaverso. Permite administrar proyectos, tareas, archivos, clientes y equipos de trabajo desde un único sistema centralizado.

## Tecnologías

- **Backend:** Python + Litestar
- **Frontend:** React
- **Base de datos:** PostgreSQL
- **Autenticación:** JWT
- **Contenedores:** Docker / docker-compose

## Funcionalidades principales

- Autenticación y gestión de roles y permisos
- Gestión de proyectos (creación, edición, archivado)
- Tablero de tareas por estado (Kanban)
- Gestión documental: carpetas, subida de archivos, versionado e historial
- Gestión de clientes
- Calendario personal y de equipo
- Búsqueda global y semántica
- Registro de actividad y auditoría
- Administración de equipos y permisos por módulo

## Estructura del repositorio
├── backend/ # API REST en Python (Litestar)
├── Interfaz/ # Aplicación frontend en React
└── docker-compose.yml # Orquestación de servicios

## Requisitos previos

- Docker y Docker Compose
- Node.js (para desarrollo del frontend)
- Python 3.x (para desarrollo del backend)

## Instalación y ejecución

1. Clonar el repositorio:
   ```bash
   git clone https://github.com/Jair-dev57/Helios.git
   cd Helios
   ```

2. Configurar variables de entorno (crear archivo `.env` en `backend/` con las credenciales de base de datos, JWT secret, etc.)

3. Levantar los servicios con Docker:
   ```bash
   docker-compose up -d
   ```

4. La API quedará disponible en `http://localhost:<puerto>` y el frontend en `http://localhost:<puerto>`.

## Autores

- Jair Estupiñán
- María Inés Martínez Romero

## Licencia

Proyecto desarrollado como trabajo de grado para la Universidad Nacional Abierta y a Distancia (UNAD).
