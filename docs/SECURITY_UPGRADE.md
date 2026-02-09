# 🚨 ACCIÓN INMEDIATA REQUERIDA - Actualización de Seguridad

## ⚠️ TUS CREDENCIALES ESTÁN EXPUESTAS

Las siguientes credenciales fueron encontradas en el archivo `.env` y **deben ser rotadas inmediatamente**:

- ✅ Supabase URL y Key
- ✅ Google OAuth Client ID y Secret
- ✅ GitHub Token

---

## 📋 PASOS INMEDIATOS (15 minutos)

### 1. Rotar Credenciales (5 min)

#### Supabase
```
1. Ve a: https://supabase.com/dashboard/project/tquffflabpmizsbsqbll/settings/api
2. Clic en "Reset API Key" para la publishable key
3. Copia la NUEVA key
```

#### Google OAuth
```
1. Ve a: https://console.cloud.google.com/apis/credentials
2. Selecciona tu proyecto
3. Encuentra tu OAuth Client ID actual
4. Click en "Delete"
5. Crea uno nuevo: "Create Credentials" → "OAuth 2.0 Client ID" → "Desktop app"
6. Copia el NUEVO Client ID y Secret
```

#### GitHub Token
```
1. Ve a: https://github.com/settings/tokens
2. Encuentra y revoca el token actual (empieza con ghp_...)
3. Create new token (classic) con permisos 'repo'
4. Copia el NUEVO token
```

---

### 2. Migrar al Sistema Seguro (5 min)

```bash
# Ejecuta el script de migración automática
npm run migrate-credentials

# El script te guiará paso a paso:
# - Creará .env.local con tus credenciales
# - Verificará .gitignore
# - Te ayudará a eliminar el .env viejo
```

**O manualmente**:
```bash
# 1. Crea .env.local con las NUEVAS credenciales
cp .env.local.example .env.local
# Edita .env.local y pega las nuevas keys

# 2. Elimina el .env viejo
rm .env

# 3. Verifica que funciona
npm run dev
```

---

### 3. Limpiar Git (5 min)

Si ya hiciste commits con el .env:

```bash
# Eliminar .env del historial de git
git filter-branch --force --index-filter \
"git rm --cached --ignore-unmatch .env" \
--prune-empty --tag-name-filter cat -- --all

# Force push (¡CUIDADO! Coordina con tu equipo si lo hay)
git push origin --force --all

# Opcional: Limpiar refs locales
git for-each-ref --format="delete %(refname)" refs/original | git update-ref --stdin
git reflog expire --expire=now --all
git gc --prune=now --aggressive
```

---

## ✅ Verificación

Después de migrar, verifica que todo funcione:

```bash
# 1. Inicia la app
npm run dev

# 2. Busca esta línea en la consola:
# "🔐 SECURE CREDENTIALS STATUS"
# "✅ Credentials loaded successfully"

# 3. Prueba funcionalidad crítica:
# - Carga de datos (Supabase)
# - Subida a Drive (Google)
# - Auto-updates (GitHub)
```

---

## 📖 Documentación Completa

Para configuración avanzada y producción:
- **CREDENTIALS_SETUP.md** - Guía completa de configuración
- **.env.local.example** - Template de credenciales

---

## 🔒 ¿Qué Cambió?

### Antes (INSEGURO):
```
.env → Incluido en el código → Expuesto en ASAR → ❌ Cualquiera puede extraerlo
```

### Ahora (SEGURO):
```
Sistema operativo → Variables de entorno → Solo disponible en runtime → ✅ Seguro
.env.local → Git-ignored → Solo en tu máquina → ✅ Seguro
Electron Store → Encriptado → Solo en userData → ✅ Seguro
```

---

## ❓ Preguntas Frecuentes

**P: ¿Necesito hacer esto si no publiqué la app aún?**
R: Sí, es mejor prevenir. Las credenciales pueden filtrarse de muchas maneras.

**P: ¿Mis usuarios necesitan configurar credenciales?**
R: No. Solo tú (desarrollador). Las credenciales de Supabase/Google son para la app, no para cada usuario.

**P: ¿Puedo seguir usando .env en desarrollo?**
R: No recomendado. Usa `.env.local` que NO se sube a git.

**P: ¿Qué pasa si mi equipo ya clonó el repo con el .env?**
R: Todos deben:
1. Borrar su copia local del .env
2. Crear su propio .env.local
3. Hacer `git pull --force` después de que limpies el historial

---

## 🆘 ¿Necesitas Ayuda?

Si algo sale mal:
1. No entres en pánico
2. Las credenciales viejas están inválidas (después de rotarlas)
3. Crea `.env.local` con las nuevas credenciales
4. La app debería funcionar igual que antes

---

## 🎯 Prioridad de Acciones

| Acción | Urgencia | Tiempo |
|--------|----------|--------|
| Rotar credenciales | 🔴 CRÍTICO | 5 min |
| Migrar a .env.local | 🟠 ALTA | 5 min |
| Limpiar git history | 🟡 MEDIA | 5 min |
| Configurar producción | 🟢 BAJA | 30 min |

---

**Última actualización**: 2026-02-09
**Versión del sistema**: 1.0.0 (Secure Credentials)
