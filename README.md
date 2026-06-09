<div align="center">

# 🌞 Helios
### Sistema de Gestión de Proyectos en la Nube

*Centralizando la gestión de proyectos, clientes y documentación de forma remota, segura y escalable.*

![Python](https://img.shields.io/badge/Python-3.12+-3776AB?style=for-the-badge&logo=python&logoColor=white)
![Litestar](https://img.shields.io/badge/Litestar-2.x-EF5C02?style=for-the-badge)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16+-336791?style=for-the-badge&logo=postgresql&logoColor=white)
![React](https://img.shields.io/badge/React-18.x-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![License](https://img.shields.io/badge/Licencia-Académica-blue?style=for-the-badge)

</div>

---

## 📖 Sobre el proyecto

**Helios** nació como respuesta a una necesidad real: la empresa **Cimaverso** gestionaba sus proyectos, clientes y documentación de forma local y desorganizada, lo que generaba pérdida de información, duplicidad de datos y dificultades para el trabajo remoto.

La solución es una plataforma web en la nube que centraliza toda esa información, permitiendo el acceso seguro desde cualquier lugar y dispositivo. Si bien fue diseñada inicialmente para Cimaverso, **Helios está construido con una arquitectura escalable pensada para ser adoptada por cualquier organización**.

> Proyecto de grado — Ingeniería de Sistemas  
> **Universidad Nacional Abierta y a Distancia (UNAD)**

---

## ✨ Funcionalidades

- 📁 **Gestión de proyectos** — Creación, edición y seguimiento del estado de proyectos
- 👥 **Gestión de clientes** — Administración de clientes asociados a cada proyecto
- 📄 **Gestión documental** — Carga, organización y recuperación de documentos
- 🔐 **Autenticación y roles** — Control de acceso seguro por roles de usuario
- ☁️ **Acceso remoto** — Disponible desde cualquier dispositivo con conexión a internet
- 📊 **Seguimiento en tiempo real** — Control del avance y estado de los proyectos

---

## 🚀 Stack tecnológico

| Capa | Tecnología | Descripción |
|------|-----------|-------------|
| Backend | [Litestar](https://litestar.dev/) 2.x | Framework ASGI moderno y de alto rendimiento |
| ORM | SQLAlchemy 2.0 | Manejo asíncrono de base de datos |
| Base de datos | PostgreSQL 16+ | Base de datos relacional en producción |
| Servidor | Granian (ASGI) | Servidor de alto rendimiento |
| Frontend | Vue.js 3 | Interfaz de usuario reactiva e intuitiva |
| Lenguaje | Python 3.12+ | Backend |
| Gestor de paquetes | uv | Gestión de dependencias Python |

---

## ⚙️ Instalación y configuración

### Requisitos previos

- Python 3.12+
- [uv](https://docs.astral.sh/uv/)
- PostgreSQL 16+
- Node.js 18+

### Backend

```bash
# Clonar el repositorio
git clone https://github.com/Jair-dev57/helios.git
cd helios/backend

# Instalar dependencias
uv sync

# Activar entorno virtual
# Windows
.venv\Scripts\activate
# Linux/Mac
source .venv/bin/activate

# Configurar variables de entorno
cp .env.example .env
# Editar .env con tus credenciales de base de datos

# Correr el servidor
granian --interface asgi main:app --reload
```

### Frontend

```bash
cd helios/frontend

# Instalar dependencias
npm install

# Correr en desarrollo
npm run dev
```

---

## 🌐 Documentación de la API

Una vez el servidor esté corriendo, la documentación interactiva está disponible en:

- **Swagger UI:** `http://127.0.0.1:8000/schema/swagger`
- **Redoc:** `http://127.0.0.1:8000/schema/redoc`

---

## 🗺️ Roadmap

- [x] Configuración inicial del proyecto
- [x] Módulo de proyectos (CRUD)
- [ ] Módulo de clientes
- [ ] Módulo de documentos
- [ ] Autenticación con JWT
- [ ] Control de roles
- [ ] Frontend con Vue.js
- [ ] Despliegue en la nube

---

## 👨‍💻 Autores

| Nombre | Rol |
|--------|-----|
| **Edison Jair Estupiñan Amaya** | Desarrollo backend & arquitectura |
| **María Inés Martínez Romero** | Desarrollo frontend & diseño |

---

## 🏢 Aplicación inicial

**Cimaverso** — Empresa colombiana para la que fue desarrollada la versión inicial de Helios.

---

## 📄 Licencia

Este proyecto es de uso académico, desarrollado como proyecto de grado en la **UNAD**. Su arquitectura está diseñada para escalar y ser adoptada por cualquier organización.
