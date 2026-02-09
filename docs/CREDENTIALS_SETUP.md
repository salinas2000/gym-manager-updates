# 🔐 Configuración Segura de Credenciales - Gym Manager Pro

## ⚠️ IMPORTANTE: Seguridad de Credenciales

**NUNCA** subas credenciales a Git. Este sistema implementa 3 métodos seguros para configurar las API keys necesarias.

---

## 📋 Credenciales Necesarias

### Requeridas (La app no funcionará sin estas):
- **SUPABASE_URL**: URL de tu proyecto Supabase
- **SUPABASE_KEY**: Publishable Key de Supabase

### Opcionales (Funciones específicas):
- **GOOGLE_CLIENT_ID**: Para integración con Google Drive
- **GOOGLE_CLIENT_SECRET**: Para integración con Google Drive
- **GOOGLE_PROJECT_ID**: ID del proyecto de Google Cloud
- **GH_TOKEN**: Para actualizaciones automáticas desde GitHub

---

## 🎯 Métodos de Configuración (Por Prioridad)

La aplicación busca credenciales en este orden:
1. **Variables de entorno del sistema** (más seguro)
2. **Archivo `.env.local`** (git-ignored)
3. **Electron Store encriptado** (configuración manual en la app)

---

## 🥇 MÉTODO 1: Variables de Entorno del Sistema (RECOMENDADO)

Este es el método **MÁS SEGURO** porque las credenciales están fuera del código.

### Windows

#### Opción A: PowerShell (Temporal - solo sesión actual)
```powershell
$env:GYM_SUPABASE_URL="https://tu-proyecto.supabase.co"
$env:GYM_SUPABASE_KEY="tu_publishable_key"
$env:GYM_GOOGLE_CLIENT_ID="tu-client-id.apps.googleusercontent.com"
$env:GYM_GOOGLE_CLIENT_SECRET="tu-client-secret"
$env:GYM_GOOGLE_PROJECT_ID="tu-project-id"
$env:GYM_GITHUB_TOKEN="ghp_tu_token"
```

#### Opción B: Variables Permanentes (Recomendado)
1. Presiona `Win + X` → "Sistema"
2. Clic en "Configuración avanzada del sistema"
3. Botón "Variables de entorno"
4. En "Variables de usuario", clic "Nueva"
5. Agregar cada variable:
   ```
   Nombre: GYM_SUPABASE_URL
   Valor: https://tu-proyecto.supabase.co
   ```
6. Reiniciar la terminal/app después de configurar

### macOS / Linux

#### Agregar a tu shell profile:
```bash
# Para Bash: Edita ~/.bashrc o ~/.bash_profile
# Para Zsh: Edita ~/.zshrc

export GYM_SUPABASE_URL="https://tu-proyecto.supabase.co"
export GYM_SUPABASE_KEY="tu_publishable_key"
export GYM_GOOGLE_CLIENT_ID="tu-client-id.apps.googleusercontent.com"
export GYM_GOOGLE_CLIENT_SECRET="tu-client-secret"
export GYM_GOOGLE_PROJECT_ID="tu-project-id"
export GYM_GITHUB_TOKEN="ghp_tu_token"
```

Luego ejecuta:
```bash
source ~/.zshrc  # o ~/.bashrc
```

---

## 🥈 MÉTODO 2: Archivo .env.local (Fácil y Seguro)

### Desarrollo (Desde código fuente):

1. Crea un archivo llamado `.env.local` en la **raíz del proyecto**:
   ```
   gym-manager-pro/
   ├── .env.local        ← Aquí
   ├── package.json
   ├── src/
   └── ...
   ```

2. Copia este contenido y completa tus credenciales:
   ```env
   # Gym Manager Pro - Credenciales Locales
   # Este archivo NO se sube a git

   # ===== SUPABASE (REQUERIDO) =====
   SUPABASE_URL=https://tu-proyecto.supabase.co
   SUPABASE_KEY=tu_supabase_publishable_key

   # ===== GOOGLE OAUTH (OPCIONAL) =====
   GOOGLE_CLIENT_ID=tu-client-id.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=tu-client-secret
   GOOGLE_PROJECT_ID=tu-project-id

   # ===== GITHUB (OPCIONAL) =====
   GH_TOKEN=ghp_tu_token
   ```

3. **VERIFICA** que `.env.local` esté en tu `.gitignore`:
   ```bash
   cat .gitignore | grep "env.local"
   # Debe mostrar: .env.local
   ```

### Producción (App compilada):

1. Navega a la carpeta `userData` de la aplicación:
   - **Windows**: `%APPDATA%\gym-manager-pro\`
   - **macOS**: `~/Library/Application Support/gym-manager-pro/`
   - **Linux**: `~/.config/gym-manager-pro/`

2. Crea el archivo `.env.local` ahí con el mismo formato de arriba

---

## 🥉 MÉTODO 3: Configuración Manual (Encriptada)

Si no configuras credenciales con los métodos anteriores, la app te pedirá ingresarlas manualmente al iniciar. Estas se guardan encriptadas en Electron Store.

**Ventajas**: Fácil de usar
**Desventajas**: Menos seguro que métodos 1 y 2

---

## 🔍 Verificar Configuración

Inicia la aplicación y revisa los logs:

### En Desarrollo:
```bash
npm run dev
```

Busca esta sección en la consola:
```
🔐 SECURE CREDENTIALS STATUS
✅ Credentials loaded successfully
☁️ Supabase: ✅ Configured
🔑 Google OAuth: ✅ Configured
🐙 GitHub Token: ℹ️ Optional (not configured)
```

### En Producción:
Revisa el archivo de logs:
- **Windows**: `%APPDATA%\gym-manager-pro\logs\main.log`
- **macOS**: `~/Library/Logs/gym-manager-pro/main.log`
- **Linux**: `~/.config/gym-manager-pro/logs/main.log`

---

## 🔑 Cómo Obtener Credenciales

### Supabase (REQUERIDO)

1. Ve a https://supabase.com/dashboard
2. Selecciona tu proyecto (o crea uno nuevo)
3. Ve a **Settings** → **API**
4. Copia:
   - **Project URL** → `SUPABASE_URL`
   - **anon/public key** → `SUPABASE_KEY`

### Google OAuth (OPCIONAL - Solo para Google Drive)

1. Ve a https://console.cloud.google.com
2. Crea un proyecto nuevo o selecciona uno existente
3. Habilita **Google Drive API**
4. Ve a **APIs & Services** → **Credentials**
5. Clic en **Create Credentials** → **OAuth 2.0 Client ID**
6. Tipo: **Desktop app**
7. Copia:
   - **Client ID** → `GOOGLE_CLIENT_ID`
   - **Client Secret** → `GOOGLE_CLIENT_SECRET`
   - **Project ID** (arriba) → `GOOGLE_PROJECT_ID`

### GitHub Token (OPCIONAL - Solo para actualizaciones automáticas)

1. Ve a https://github.com/settings/tokens
2. Clic en **Generate new token (classic)**
3. Nombre: `Gym Manager Pro - Updates`
4. Permisos: Solo marca `repo` (para acceso público a releases)
5. Copia el token generado → `GH_TOKEN`

---

## ❓ Problemas Comunes

### "⚠️ Credentials not loaded"
- **Causa**: No se encontraron credenciales en ningún método
- **Solución**: Verifica que las variables estén bien escritas (prefijo `GYM_` o archivo `.env.local`)

### "Google Drive service not available"
- **Causa**: Credenciales de Google no configuradas
- **Solución**: Es normal si no necesitas la integración con Drive. Configúralas solo si usas esa función.

### "Supabase credentials incomplete"
- **Causa**: Falta `SUPABASE_URL` o `SUPABASE_KEY`
- **Solución**: Estas son requeridas. Configúralas con alguno de los 3 métodos.

### Variables de entorno no se cargan en Windows
- **Causa**: No reiniciaste la terminal después de configurarlas
- **Solución**: Cierra completamente PowerShell/CMD y ábrelo de nuevo

---

## 🔒 Mejores Prácticas de Seguridad

✅ **HAZ ESTO**:
- Usa variables de entorno del sistema en producción
- Mantén `.env.local` fuera de git (ya configurado en `.gitignore`)
- Rota (cambia) las credenciales si las expones accidentalmente
- Usa diferentes credenciales para desarrollo y producción

❌ **NO HAGAS ESTO**:
- Subir `.env` o `.env.local` a git
- Compartir credenciales por email o chat
- Usar las mismas credenciales en múltiples proyectos
- Hardcodear credenciales en el código fuente

---

## 🆘 Soporte

Si tienes problemas con la configuración:
1. Revisa los logs de la aplicación
2. Verifica que las credenciales sean válidas en Supabase/Google
3. Prueba con el método más simple primero (Método 2: `.env.local`)

---

## 🔄 Migración desde el Sistema Anterior

Si usabas el `.env` antiguo:

1. **NO ELIMINES** tu `.env` todavía
2. Crea `.env.local` con el mismo contenido
3. Verifica que la app funciona con `.env.local`
4. Elimina `.env` del proyecto
5. Asegúrate de que `.env` esté en `.gitignore`

**IMPORTANTE**: Si ya subiste `.env` a git, debes:
1. **Rotar TODAS las credenciales** (crear nuevas en Supabase/Google)
2. Eliminar `.env` del historial de git:
   ```bash
   git filter-branch --force --index-filter \
   "git rm --cached --ignore-unmatch .env" \
   --prune-empty --tag-name-filter cat -- --all
   ```
3. Configurar las NUEVAS credenciales con los métodos seguros

---

💡 **TIP**: Para desarrollo en equipo, comparte un `.env.local.example` (sin credenciales reales) con la estructura de las variables necesarias.
