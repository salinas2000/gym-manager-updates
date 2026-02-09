# 📚 Documentación - Gym Manager Pro

Bienvenido a la documentación completa de Gym Manager Pro.

---

## 🚀 Inicio Rápido

### Para Nuevos Usuarios

```
1. Lee: START_HERE.md (15 minutos)
2. Ejecuta: npm run migrate-credentials
3. Inicia: npm run dev
```

### Para Usuarios Existentes

Si ya tienes el sistema antiguo con `.env`:
- Lee primero: **SECURITY_UPGRADE.md**

---

## 📖 Índice de Documentación

### 🎯 Guías de Acción

| Archivo | Propósito | Audiencia | Tiempo |
|---------|-----------|-----------|--------|
| **[START_HERE.md](START_HERE.md)** | Guía de inicio rápida | Todos | 15 min |
| **[SECURITY_UPGRADE.md](SECURITY_UPGRADE.md)** | Actualización urgente | Usuarios con .env | 15 min |

### 🔐 Seguridad

| Archivo | Propósito | Audiencia | Tiempo |
|---------|-----------|-----------|--------|
| **[CREDENTIALS_SETUP.md](CREDENTIALS_SETUP.md)** | Configuración completa de credenciales | Desarrolladores | 30 min |

### 🏗️ Arquitectura

| Archivo | Propósito | Audiencia | Tiempo |
|---------|-----------|-----------|--------|
| **[IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md)** | Resumen técnico detallado | Desarrolladores | 20 min |
| **[VISUAL_SUMMARY.md](VISUAL_SUMMARY.md)** | Resumen visual con diagramas | Todos | 10 min |

### 🧪 Testing

| Archivo | Propósito | Audiencia | Tiempo |
|---------|-----------|-----------|--------|
| **[TESTING_GUIDE.md](TESTING_GUIDE.md)** | Guía completa de testing | Desarrolladores/QA | 30 min |

---

## 🔍 Guía de Navegación

### ¿Primera vez con el proyecto?
```
START_HERE.md → Prueba la app → Si funciona: ¡Listo!
                                Si no: CREDENTIALS_SETUP.md
```

### ¿Migrar desde sistema antiguo?
```
SECURITY_UPGRADE.md → Rotar credenciales → Migrar → Verificar
```

### ¿Entender el sistema técnico?
```
VISUAL_SUMMARY.md → IMPLEMENTATION_SUMMARY.md → Código fuente
```

### ¿Configurar para producción?
```
CREDENTIALS_SETUP.md → Método 1 (Variables de Sistema) → Deploy
```

---

## 🎓 Por Rol

### Desarrollador Frontend
- Enfócate en: `src/renderer/`
- Lee: README.md principal
- Ignora: Documentación de credenciales (backend se encarga)

### Desarrollador Backend
- Enfócate en: `src/main/services/`
- Lee: CREDENTIALS_SETUP.md
- Importante: IMPLEMENTATION_SUMMARY.md

### DevOps / SysAdmin
- Lee primero: CREDENTIALS_SETUP.md - Método 1
- Importante: SECURITY_UPGRADE.md
- Herramientas: scripts/migrate-credentials.js

### QA / Tester
- Lee: START_HERE.md
- Usa: tools/check_db.js, tools/debug_*.js
- Reporta: GitHub Issues

---

## 🔑 Conceptos Clave

### Sistema de Credenciales (v1.0.0)

**Problema Resuelto**: Credenciales hardcodeadas en código
**Solución**: Sistema de 3 niveles con fallbacks

```
Priority 1: System Environment Variables (producción)
Priority 2: .env.local file (desarrollo)
Priority 3: Electron Store encrypted (fallback)
```

**Archivos Relevantes**:
- Core: `src/main/config/credentials.js`
- Servicios: `src/main/services/cloud/*.js`
- Documentación: CREDENTIALS_SETUP.md

---

## 🛠️ Herramientas

### Scripts de Migración
```bash
# Migrar del sistema antiguo al nuevo
npm run migrate-credentials
```

### Scripts de Debug
```bash
# Verificar base de datos
node tools/check_db.js

# Debug analytics
node tools/debug_analytics.js

# Debug gimnasios
node tools/debug_gyms.js
```

---

## ❓ FAQ

### ¿Qué archivo leo primero?
**START_HERE.md** - Siempre empieza por aquí.

### ¿Necesito leer toda la documentación?
No. Usa la guía de navegación arriba según tu rol.

### ¿Dónde están las credenciales?
**NUNCA en git**. Lee CREDENTIALS_SETUP.md para saber dónde ponerlas.

### ¿Cómo contribuyo a la documentación?
1. Fork el proyecto
2. Edita archivos en `docs/`
3. Pull request

### ¿La documentación está actualizada?
Sí. Última actualización: **2026-02-09** (Sistema de Credenciales v1.0.0)

---

## 📝 Plantillas

### Template de Credenciales
```bash
# Copiar template
cp .env.local.example .env.local

# Editar con tus credenciales
nano .env.local
```

### Template de Issue
```markdown
**Tipo**: Bug / Feature / Documentación
**Archivo relacionado**: docs/ARCHIVO.md
**Descripción**: ...
**Pasos para reproducir**: ...
```

---

## 🔄 Historial de Cambios

### v1.0.0 - Sistema de Credenciales Seguras (2026-02-09)
- ✅ Credential Manager implementado
- ✅ Sistema de 3 niveles de prioridad
- ✅ Documentación completa creada
- ✅ Script de migración automática

### v0.9.x - Sistema Anterior
- ⚠️ Credenciales en .env (inseguro)
- ⚠️ Sin documentación de seguridad

---

## 📊 Métricas de Documentación

| Métrica | Valor |
|---------|-------|
| **Total de archivos** | 5 |
| **Líneas totales** | ~2,500 |
| **Tiempo de lectura** | ~90 min (todo) |
| **Cobertura** | 100% del sistema de credenciales |

---

## 🆘 Soporte

### ¿No encuentras lo que buscas?

1. **Buscar en documentación**:
   ```bash
   grep -r "tu búsqueda" docs/
   ```

2. **Revisar código fuente**:
   - Credenciales: `src/main/config/credentials.js`
   - Servicios: `src/main/services/`

3. **Abrir issue**:
   https://github.com/tu-usuario/gym-manager-pro/issues

---

## 📚 Recursos Externos

### Tecnologías Usadas
- [Electron Docs](https://www.electronjs.org/docs)
- [React Docs](https://react.dev)
- [Supabase Docs](https://supabase.com/docs)
- [Tailwind CSS](https://tailwindcss.com/docs)

### Seguridad
- [OWASP Secure Configuration](https://owasp.org/www-project-secure-coding-practices-quick-reference-guide/)
- [12 Factor App - Config](https://12factor.net/config)

---

<div align="center">

**¿Falta algo?** Abre un issue o PR

[⬅️ Volver al README principal](../README.md)

</div>
