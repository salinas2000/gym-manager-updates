# 🛠️ Scripts - Gym Manager Pro

Scripts de utilidad y mantenimiento.

---

## 📋 Scripts Disponibles

### migrate-credentials.js

**Propósito**: Migrar del sistema antiguo (.env) al nuevo sistema seguro (.env.local)

**Uso**:
```bash
npm run migrate-credentials
```

**Qué hace**:
1. Detecta si existe `.env` antiguo
2. Verifica si fue commiteado a git
3. Crea `.env.local` con las mismas credenciales
4. Actualiza `.gitignore`
5. Opcionalmente elimina `.env` viejo
6. Provee instrucciones para limpiar git history

**Cuándo usarlo**:
- Primera vez que actualizas al sistema v1.0.0+
- Cuando migras de .env a .env.local
- Después de rotar credenciales expuestas

**Ejemplo de salida**:
```
🔐 Gym Manager Pro - Credential Migration Tool

⚠️  Found old .env file with potentially exposed credentials
🚨 SECURITY ALERT: .env was committed to git!
   You MUST rotate (change) all credentials

✅ Created .env.local
✅ Updated .gitignore
✅ Old .env deleted

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ MIGRATION COMPLETE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## 🔧 Agregar Nuevos Scripts

### Template de Script

```javascript
#!/usr/bin/env node

/**
 * Script Name
 *
 * Purpose: Brief description
 * Usage: node scripts/script-name.js
 */

const fs = require('fs');
const path = require('path');

async function main() {
    console.log('🔧 Starting script...');

    try {
        // Your logic here

        console.log('✅ Script completed successfully');
    } catch (error) {
        console.error('❌ Script failed:', error.message);
        process.exit(1);
    }
}

main();
```

### Registrar en package.json

```json
{
  "scripts": {
    "your-script": "node scripts/your-script.js"
  }
}
```

---

## 📚 Documentación

Ver: [docs/README.md](../docs/README.md)

---

## 🤝 Contribución

Al agregar un nuevo script:
1. Sigue el template de arriba
2. Agrega documentación en este README
3. Registra en package.json
4. Prueba en Windows, macOS y Linux

---

**[⬅️ Volver al README principal](../README.md)**
