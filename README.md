# 💪 Gym Manager Pro

<div align="center">

![Version](https://img.shields.io/badge/version-1.0.7-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Tests](https://github.com/salinas2000/gym-manager-updates/workflows/%F0%9F%A7%AA%20Tests/badge.svg)
![Electron](https://img.shields.io/badge/Electron-34.0.0-47848F.svg)
![React](https://img.shields.io/badge/React-18.3.1-61DAFB.svg)
![Coverage](https://img.shields.io/badge/coverage-60%25-yellow.svg)

**Sistema profesional de gestión integral para gimnasios**

[Características](#-características) • [Instalación](#-instalación) • [Testing](#-testing) • [Documentación](#-documentación) • [Seguridad](#-seguridad)

</div>

---

## 📋 Descripción

Gym Manager Pro es una aplicación de escritorio multiplataforma construida con Electron y React que proporciona una solución completa para la gestión de gimnasios, incluyendo:

- 👥 Gestión de clientes y membresías
- 💰 Control financiero y pagos
- 🏋️ Planificación de entrenamientos
- 📊 Análisis y métricas en tiempo real
- ☁️ Sincronización en la nube
- 📦 Control de inventario

---

## ✨ Características

### Gestión de Clientes
- ✅ CRUD completo de clientes
- ✅ Historial de membresías
- ✅ Estados activos/inactivos
- ✅ Cancelaciones programadas
- ✅ Búsqueda y filtrado avanzado

### Sistema Financiero
- 💳 Registro de pagos
- 📈 Gráficos de crecimiento
- 📊 Reportes mensuales
- 💰 Análisis de tarifas
- 🔔 Alertas de deudores

### Planificación de Entrenamientos
- 🏋️ Biblioteca de ejercicios categorizada
- 📝 Constructor de rutinas
- 📅 Mesociclos y periodización
- 📤 Exportación a Excel personalizable
- ☁️ Subida automática a Google Drive
- 🎨 Plantillas personalizables

### Inventario
- 📦 Gestión de productos
- 📊 Control de stock
- ⚠️ Alertas de stock mínimo
- 📈 Historial de movimientos
- 💵 Análisis de rentabilidad

### Cloud & Sincronización
- ☁️ Backup automático a Supabase
- 🔄 Sincronización en tiempo real
- 📱 Multi-dispositivo
- 🔐 Encriptación de datos
- 📤 Exportación/Importación local

---

## 🚀 Instalación

### Prerrequisitos

- **Node.js** >= 18.x
- **npm** >= 9.x
- **Git**

### Desarrollo

```bash
# 1. Clonar el repositorio
git clone https://github.com/tu-usuario/gym-manager-pro.git
cd gym-manager-pro

# 2. Instalar dependencias
npm install

# 3. Configurar credenciales (VER SECCIÓN SEGURIDAD)
cp .env.local.example .env.local
# Edita .env.local con tus credenciales

# 4. Iniciar en modo desarrollo
npm run dev
```

### Producción

```bash
# Compilar la aplicación
npm run build

# Los instaladores estarán en: release/
```

---

## 🧪 Testing

### Ejecutar Tests

```bash
# Todos los tests
npm test

# Con reporte de cobertura
npm run test:coverage

# Modo watch (desarrollo)
npm run test:watch

# Solo main process
npm run test:main

# Solo renderer process
npm run test:renderer
```

### Cobertura Actual

- **Credential Manager**: ✅ 100% cobertura
- **Customer Service**: ✅ 100% cobertura
- **Payment Service**: ✅ 100% cobertura
- **React Components**: ✅ Componentes críticos cubiertos

Ver guía completa: [docs/TESTING_GUIDE.md](docs/TESTING_GUIDE.md)

---

## 🔐 Seguridad

### ⚠️ IMPORTANTE: Configuración de Credenciales

Esta aplicación utiliza un **sistema seguro de credenciales** de 3 niveles:

1. **Variables de entorno del sistema** (Recomendado para producción)
2. **Archivo `.env.local`** (Recomendado para desarrollo)
3. **Electron Store encriptado** (Fallback automático)

### 🚨 Primera Vez - Acción Requerida

```bash
# Si es la primera vez, lee esta guía de 15 minutos:
cat docs/START_HERE.md

# O ejecuta la migración automática:
npm run migrate-credentials
```

### 📖 Documentación de Seguridad

- **[docs/START_HERE.md](docs/START_HERE.md)** - Guía rápida de inicio (15 min)
- **[docs/SECURITY_UPGRADE.md](docs/SECURITY_UPGRADE.md)** - Actualización urgente de seguridad
- **[docs/CREDENTIALS_SETUP.md](docs/CREDENTIALS_SETUP.md)** - Configuración completa de credenciales

### Credenciales Requeridas

| Servicio | Requerido | Propósito |
|----------|-----------|-----------|
| **Supabase** | ✅ Sí | Base de datos cloud, backup, sincronización |
| **Google OAuth** | ⚠️ Opcional | Integración con Google Drive |
| **GitHub Token** | ⚠️ Opcional | Actualizaciones automáticas |

---

## 📁 Estructura del Proyecto

```
gym-manager-pro/
│
├── 📁 docs/                          # Documentación completa
│   ├── START_HERE.md                 # ⭐ Empieza aquí
│   ├── SECURITY_UPGRADE.md           # Actualización de seguridad
│   ├── CREDENTIALS_SETUP.md          # Configuración de credenciales
│   ├── IMPLEMENTATION_SUMMARY.md     # Resumen técnico
│   └── VISUAL_SUMMARY.md             # Resumen visual
│
├── 📁 scripts/                       # Scripts de utilidad
│   └── migrate-credentials.js        # Migración de credenciales
│
├── 📁 tools/                         # Herramientas de debugging
│   ├── check_db.js                   # Verificar base de datos
│   ├── debug_analytics.js            # Debug de analytics
│   └── debug_gyms.js                 # Debug de gimnasios
│
├── 📁 src/
│   ├── 📁 main/                      # Proceso principal de Electron
│   │   ├── 📁 config/                # Configuración
│   │   │   └── credentials.js        # ⭐ Credential Manager
│   │   ├── 📁 db/                    # Base de datos
│   │   │   ├── database.js           # SQLite Manager
│   │   │   └── seeds/                # Datos iniciales
│   │   ├── 📁 ipc/                   # IPC Handlers
│   │   │   └── handlers.js           # Comunicación IPC
│   │   ├── 📁 services/              # Lógica de negocio
│   │   │   ├── cloud/                # Servicios cloud
│   │   │   ├── local/                # Servicios locales
│   │   │   └── io/                   # Import/Export
│   │   └── main.js                   # Entry point
│   │
│   ├── 📁 preload/                   # Scripts de preload
│   │   └── index.js                  # Bridge seguro
│   │
│   └── 📁 renderer/                  # Frontend React
│       ├── 📁 components/            # Componentes compartidos
│       ├── 📁 context/               # Context providers
│       ├── 📁 features/              # Módulos por función
│       │   ├── admin/                # Panel de administración
│       │   ├── customers/            # Gestión de clientes
│       │   ├── dashboard/            # Dashboards
│       │   ├── finance/              # Finanzas
│       │   ├── inventory/            # Inventario
│       │   ├── settings/             # Configuración
│       │   ├── templates/            # Plantillas Excel
│       │   └── training/             # Entrenamientos
│       ├── 📁 pages/                 # Páginas principales
│       └── main.jsx                  # Entry point React
│
├── 📄 .env.local.example             # Template de credenciales
├── 📄 .gitignore                     # Archivos ignorados
├── 📄 package.json                   # Dependencias
├── 📄 vite.config.js                 # Configuración Vite
└── 📄 README.md                      # Este archivo
```

---

## 🛠️ Tecnologías

### Core
- **[Electron](https://www.electronjs.org/)** v34.0.0 - Framework de escritorio
- **[React](https://react.dev/)** v18.3.1 - UI Library
- **[Vite](https://vitejs.dev/)** v6.0.7 - Build tool

### Database & Backend
- **[better-sqlite3](https://github.com/WiseLibs/better-sqlite3)** v11.8.1 - Base de datos local
- **[Supabase](https://supabase.com/)** - Backend cloud y sincronización
- **[googleapis](https://github.com/googleapis/google-api-nodejs-client)** v170.1.0 - Integración Google Drive

### UI & Styling
- **[Tailwind CSS](https://tailwindcss.com/)** v3.4.17 - Utility-first CSS
- **[Tremor](https://www.tremor.so/)** v3.18.6 - Data visualization
- **[Recharts](https://recharts.org/)** v3.7.0 - Gráficos
- **[Lucide React](https://lucide.dev/)** v0.473.0 - Iconos

### Tools & Utils
- **[ExcelJS](https://github.com/exceljs/exceljs)** v4.4.0 - Generación de Excel
- **[Zod](https://zod.dev/)** v3.24.1 - Validación de schemas
- **[electron-log](https://github.com/megahertz/electron-log)** v5.4.3 - Logging
- **[electron-store](https://github.com/sindresorhus/electron-store)** v6.0.1 - Persistencia

---

## 📜 Scripts Disponibles

```bash
# Desarrollo
npm run dev              # Inicia app en modo desarrollo con hot-reload

# Build & Release
npm run build            # Compila la aplicación
npm run release          # Build + incrementa versión patch
npm run ship             # Build + publica a GitHub releases

# Utilidades
npm run migrate-credentials  # Migra credenciales antiguas al nuevo sistema
npm run rebuild          # Recompila módulos nativos

# Maintenance
npm run postinstall      # Auto-ejecutado después de npm install
```

---

## 🧪 Testing

### Smoke Tests

```bash
# Verificar que la base de datos inicia correctamente
node tools/check_db.js

# Verificar analytics
node tools/debug_analytics.js

# Verificar gimnasios
node tools/debug_gyms.js
```

### Tests Manuales

1. **Iniciar app**: `npm run dev`
2. **Verificar logs**: Busca "✅" en la consola
3. **Probar CRUD**: Crear, editar, eliminar cliente
4. **Probar sync**: Hacer cambio y verificar en Supabase

---

## 🔄 Actualización

La aplicación soporta **auto-updates** desde GitHub Releases:

1. Usuario recibe notificación de nueva versión
2. Descarga en segundo plano
3. Instala al reiniciar

### Para Desarrolladores

```bash
# 1. Crear nueva versión
npm run ship

# 2. El build automáticamente:
#    - Incrementa versión en package.json
#    - Compila la app
#    - Publica a GitHub releases
#    - Usuarios reciben update automáticamente
```

---

## 🤝 Contribución

### Workflow

1. Fork el proyecto
2. Crea tu branch (`git checkout -b feature/AmazingFeature`)
3. Commit cambios (`git commit -m 'Add AmazingFeature'`)
4. Push al branch (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

### Coding Standards

- **JavaScript/JSX**: ES6+ con módulos
- **Estilo**: Tailwind CSS utility classes
- **Commits**: Conventional Commits (feat, fix, docs, etc.)
- **Seguridad**: NUNCA commits credenciales

---

## 📄 Licencia

Este proyecto está bajo la licencia MIT. Ver [LICENSE](LICENSE) para más detalles.

---

## 🙏 Agradecimientos

- [Electron](https://www.electronjs.org/) - Framework multiplataforma
- [React](https://react.dev/) - UI Library
- [Supabase](https://supabase.com/) - Backend as a Service
- [Tailwind CSS](https://tailwindcss.com/) - CSS Framework

---

## 📞 Soporte

### Problemas Comunes

**Q: La app no inicia**
```bash
# 1. Verifica credenciales
cat .env.local

# 2. Revisa logs
# Windows: %APPDATA%\gym-manager-pro\logs\main.log
# macOS: ~/Library/Logs/gym-manager-pro/main.log
# Linux: ~/.config/gym-manager-pro/logs/main.log

# 3. Reinstala dependencias
rm -rf node_modules
npm install
```

**Q: "Supabase credentials incomplete"**
```bash
# Lee la guía de configuración
cat docs/CREDENTIALS_SETUP.md

# O ejecuta migración
npm run migrate-credentials
```

**Q: Google Drive no funciona**
```bash
# Google Drive es OPCIONAL
# Si no lo necesitas, ignora el warning
# Si lo necesitas, configura OAuth en:
# https://console.cloud.google.com
```

### Recursos

- **Documentación**: [docs/](docs/)
- **Issues**: [GitHub Issues](https://github.com/tu-usuario/gym-manager-pro/issues)
- **Changelog**: Ver [releases](https://github.com/tu-usuario/gym-manager-pro/releases)

---

## 🗺️ Roadmap

### v1.1.0 (Próximo)
- [ ] Tests automatizados (Jest + React Testing Library)
- [ ] Proxy backend para OAuth (Cloudflare Workers)
- [ ] UI de configuración de credenciales
- [ ] Modo oscuro completo

### v1.2.0
- [ ] Exportación de reportes en PDF
- [ ] Notificaciones push
- [ ] Multi-idioma (i18n)
- [ ] Módulo de nutrición

### v2.0.0
- [ ] Versión web (PWA)
- [ ] App móvil (React Native)
- [ ] Sistema de roles y permisos
- [ ] Integración con pasarelas de pago

---

<div align="center">

**Hecho con ❤️ por Antigravity**

⭐ Si te gusta el proyecto, dale una estrella en GitHub

</div>
