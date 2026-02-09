# 🔧 Tools - Gym Manager Pro

Herramientas de debugging y mantenimiento.

---

## 🛠️ Herramientas Disponibles

### check_db.js

**Propósito**: Verificar integridad de la base de datos

**Uso**:
```bash
node tools/check_db.js
```

**Qué verifica**:
- Conexión a la base de datos
- Existencia de tablas requeridas
- Integridad de datos
- Foreign keys
- Migraciones aplicadas

---

### debug_analytics.js

**Propósito**: Debug del sistema de analytics

**Uso**:
```bash
node tools/debug_analytics.js
```

**Qué hace**:
- Muestra métricas actuales
- Verifica consultas de analytics
- Detecta datos inconsistentes
- Prueba agregaciones

---

### debug_gyms.js

**Propósito**: Debug de gimnasios y multi-tenant

**Uso**:
```bash
node tools/debug_gyms.js
```

**Qué hace**:
- Lista todos los gimnasios
- Verifica gym_id en tablas
- Detecta datos huérfanos
- Muestra distribución de datos

---

## 🚀 Uso Rápido

```bash
# Verificar todo
node tools/check_db.js && \
node tools/debug_analytics.js && \
node tools/debug_gyms.js
```

---

## 🔍 Debugging Tips

### Base de Datos
```bash
# Ver estructura de BD
sqlite3 gym_manager.db ".schema"

# Ver datos de tabla
sqlite3 gym_manager.db "SELECT * FROM customers LIMIT 5"
```

### Logs
```bash
# Windows
type %APPDATA%\gym-manager-pro\logs\main.log

# macOS/Linux
tail -f ~/Library/Logs/gym-manager-pro/main.log
```

---

## 🤝 Contribución

Al agregar una nueva herramienta:
1. Nombra el archivo: `debug_nombre.js` o `check_nombre.js`
2. Agrega shebang: `#!/usr/bin/env node`
3. Documenta en este README
4. Maneja errores gracefully

---

**[⬅️ Volver al README principal](../README.md)**
