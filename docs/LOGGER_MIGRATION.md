# 📋 Logger Migration Guide

**Objetivo**: Reemplazar 310 `console.log/warn/error` statements con Winston logger estructurado

**Estado**: 🟡 En progreso

---

## ✅ Completado

### 1. Logger Creado ✅
- ✅ `src/main/utils/logger.js` con Winston
- ✅ Niveles: error, warn, info, debug
- ✅ Transports: Console + Files (error.log, combined.log)
- ✅ Formato colorizado para consola
- ✅ Formato JSON para archivos
- ✅ Método `createModuleLogger()` para child loggers

### 2. Database.js - Críticos Reemplazados ✅
- ✅ Agregado `const logger = require('../utils/logger').createModuleLogger('DATABASE')`
- ✅ Reemplazados console en `init()` method
- ✅ SQL verbose solo en development

---

## 🎯 Patrón de Migración

### Antes
```javascript
console.log('[MODULE] Message');
console.warn('[MODULE] Warning:', data);
console.error('[MODULE] Error:', error);
```

### Después
```javascript
// Al principio del archivo:
const logger = require('../utils/logger').createModuleLogger('MODULE_NAME');

// En el código:
logger.info('Message');
logger.warn('Warning', { data });
logger.error('Error', { error: error.message, stack: error.stack });
```

---

## 📊 Progreso por Archivo

### Alta Prioridad (Errores Críticos)
| Archivo | console.error | Estado |
|---------|---------------|--------|
| database.js | 11 | 🟡 Parcial |
| handlers.js | 15+ | ⏳ Pendiente |
| cloud.service.js | 10+ | ⏳ Pendiente |

### Media Prioridad (Servicios)
| Archivo | Total console | Estado |
|---------|---------------|--------|
| training.service.js | 30+ | ⏳ Pendiente |
| excel.service.js | 20+ | ⏳ Pendiente |
| template.service.js | 15+ | ⏳ Pendiente |
| admin.service.js | 15+ | ⏳ Pendiente |
| customer.service.js | 5+ | ⏳ Pendiente |
| payment.service.js | 5+ | ⏳ Pendiente |

### Baja Prioridad (Otros)
- seed.service.js
- inventory.service.js
- google.service.js
- analytics.service.js

---

## 🔧 Script de Migración Rápida

Para automatizar los reemplazos simples:

```bash
# Backup del archivo primero
cp file.js file.js.bak

# Reemplazos básicos (ajustar según patrón)
sed -i "s/console\.log('\[MODULE\]/logger.info('/g" file.js
sed -i "s/console\.warn('\[MODULE\]/logger.warn('/g" file.js
sed -i "s/console\.error('\[MODULE\]/logger.error('/g" file.js
```

**Nota**: Revisar manualmente después del reemplazo automático para ajustar contextos.

---

## 📝 Checklist Archivo por Archivo

### database.js (52 console statements)
- [x] Agregar import de logger
- [x] Reemplazar init() console statements
- [ ] Reemplazar console.error en migraciones (11 instancias)
- [ ] Reemplazar console.log en migrations (30+ instancias)
- [ ] Reemplazar console.warn en warnings (10+ instancias)

### handlers.js
- [ ] Agregar import de logger
- [ ] Reemplazar export handlers errors
- [ ] Reemplazar IPC handlers logs
- [ ] Reemplazar validation errors

### Services (cada uno)
- [ ] Agregar import: `const logger = require('../utils/logger').createModuleLogger('SERVICE_NAME')`
- [ ] Reemplazar console.error
- [ ] Reemplazar console.warn
- [ ] Reemplazar console.log

---

## 🎯 Beneficios

**Antes**:
- 310 console statements dispersos
- Sin niveles de logging
- No se pueden filtrar por módulo
- No se persisten en archivos
- Difícil de debuggear en producción

**Después**:
- Logger centralizado
- 4 niveles (error, warn, info, debug)
- Filtrado por módulo
- Logs persistidos en archivos (error.log, combined.log)
- Rotación automática (5MB, 5 archivos)
- Formato JSON para parsing
- Fácil debugging en producción

---

## 🚀 Siguiente Paso

1. **Terminar database.js** (reemplazar los 41 console restantes)
2. **Migrar handlers.js** (crítico - maneja IPC)
3. **Migrar cloud.service.js** (crítico - sync)
4. **Migrar servicios restantes** (medio)

**Estimado**: 2-3 horas para completar migración completa

---

## 🧪 Testing

Después de cada migración:
```bash
npm test  # Asegurar 71/71 passing
npm run dev  # Verificar logs en consola
```

Verificar archivos de log:
- `%APPDATA%/gym-manager-pro/logs/error.log`
- `%APPDATA%/gym-manager-pro/logs/combined.log`
