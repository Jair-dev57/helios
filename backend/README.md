<div align="center">

# 🌞 Helios
### Software Web de Gestión de Proyectos en la Nube

*Centraliza la gestión de proyectos, clientes y documentación de forma remota, segura y escalable — con inteligencia integrada para el seguimiento automático.*

![Python](https://img.shields.io/badge/Python-3.12+-3776AB?style=for-the-badge&logo=python&logoColor=white)
![Litestar](https://img.shields.io/badge/Litestar-2.x-EF5C02?style=for-the-badge)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16+-336791?style=for-the-badge&logo=postgresql&logoColor=white)
![React](https://img.shields.io/badge/React-18.x-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![License](https://img.shields.io/badge/Licencia-Académica-blue?style=for-the-badge)

</div>

---

## 📖 Sobre el proyecto

**Helios** es un software web de gestión de proyectos en la nube, desarrollado como respuesta a una necesidad real: la empresa **Cimaverso** gestionaba sus proyectos, clientes y documentación de forma local y desorganizada, lo que generaba pérdida de archivos, duplicidad de datos y dificultades para el trabajo remoto.

La solución es una plataforma web centralizada que permite el acceso seguro desde cualquier lugar y dispositivo, con indicadores automáticos que facilitan el seguimiento del estado de los proyectos sin intervención manual. Si bien fue diseñada inicialmente para Cimaverso, **Helios está construido con una arquitectura escalable pensada para ser adoptada por cualquier organización**.

> Proyecto de grado — Ingeniería de Sistemas  
> **Universidad Nacional Abierta y a Distancia (UNAD)**  
> Tutor: Nathalia Andrea Cuervo Díaz

---

## ✨ Funcionalidades

### Gestión central
- 📁 **Proyectos** — Creación, edición y seguimiento del estado de proyectos
- 👥 **Clientes** — Administración de clientes asociados a cada proyecto
- 📄 **Documentos** — Carga, organización, versionado e historial de documentos
- 🔐 **Autenticación y roles** — Control de acceso seguro con roles diferenciados por usuario
- ☁️ **Acceso remoto** — Disponible desde cualquier dispositivo con conexión a internet

### Innovación diferenciadora
- 📊 **Dashboard inteligente** — Visualización automática del estado y avance de proyectos en tiempo real
- 🔔 **Alertas automáticas** — Notificaciones de vencimientos de plazos y documentos sin configuración manual
- 📈 **Métricas de productividad** — Indicadores automáticos sobre cumplimiento, carga de trabajo y rendimiento por proyecto
- 🔍 **Búsqueda avanzada** — Motor de búsqueda sobre proyectos y documentos con filtros por estado, cliente y fecha
- 📋 **Historial de documentos** — Trazabilidad completa de cambios y versiones por documento

---

## 🎯 Alcance del proyecto

### ✅ Incluye

| Módulo | Funcionalidad |
|--------|--------------|
| Proyectos | CRUD completo, estados, asignación de clientes |
| Clientes | Registro y administración de clientes |
| Documentos | Carga, organización, historial y búsqueda |
| Usuarios y roles | Autenticación JWT, roles con permisos diferenciados |
| Dashboard | Indicadores automáticos, alertas de vencimiento, métricas |
| Búsqueda | Búsqueda full-text sobre proyectos y documentos |

### ❌ No incluye

- Facturación o contabilidad
- Gestión financiera
- Aplicación móvil nativa
- Integración con herramientas externas (Slack, Google Drive, etc.)
- Módulo de comunicación o chat entre usuarios

> El alcance fue delimitado intencionalmente para producir un prototipo funcional y bien ejecutado dentro del contexto académico.

---

## 🚀 Stack tecnológico

| Capa | Tecnología | Descripción |
|------|-----------|-------------|
| Backend | [Litestar](https://litestar.dev/) 2.x | Framework ASGI moderno y de alto rendimiento |
| ORM | SQLAlchemy 2.0 | Manejo asíncrono de base de datos |
| Base de datos | PostgreSQL 16+ | Base de datos relacional en producción |
| Búsqueda | PostgreSQL Full-Text Search | Motor de búsqueda integrado sin dependencias externas |
| Servidor | Granian (ASGI) | Servidor de alto rendimiento |
| Frontend | React 18.x | Interfaz de usuario reactiva e intuitiva |
| Lenguaje | Python 3.12+ | Backend |
| Gestor de paquetes | uv | Gestión de dependencias Python |

---

## 🗺️ Roadmap

- [x] Configuración inicial del proyecto
- [x] Módulo de proyectos (CRUD)
- [ ] Módulo de clientes
- [ ] Módulo de documentos con historial
- [ ] Autenticación con JWT
- [ ] Control de roles y permisos
- [ ] Dashboard con indicadores automáticos
- [ ] Sistema de alertas de vencimiento
- [ ] Métricas de productividad
- [ ] Búsqueda full-text
- [ ] Frontend con React 18
- [ ] Despliegue en la nube

---

## 👨‍💻 Autores

| Nombre | Rol |
|--------|-----|
| **Edison Jair Estupiñan Amaya** | Desarrollo backend & arquitectura |
| **María Inés Martínez Romero** | Desarrollo frontend & diseño |

> Supervisado por **Nathalia Andrea Cuervo Díaz** — Tutor UNAD

---

## 🏢 Caso de aplicación inicial

**Cimaverso** — Empresa colombiana de desarrollo de software para la que fue diseñada la versión inicial de Helios. La plataforma resuelve problemas concretos de pérdida de archivos, búsqueda ineficiente y duplicidad de datos que afectaban su operación diaria.

---

## 📄 Licencia

Este proyecto es de uso académico, desarrollado como proyecto de grado en la **UNAD**. Su arquitectura está diseñada para escalar y ser adoptada por cualquier organización.
