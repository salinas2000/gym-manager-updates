# ⚡ EMPIEZA AQUÍ - Acción Inmediata

> **Tiempo estimado**: 15 minutos
> **Dificultad**: Fácil (copy-paste)

---

## 🚨 PASO 1: Rotar Credenciales (5 min)

### Supabase
1. Abre: https://supabase.com/dashboard → Selecciona tu proyecto → Settings → API
2. Click "Reset API Key" para la **publishable key**
3. Copia la nueva key (empieza con `eyJ...` o `sb_...`)

### Google OAuth
1. Abre: https://console.cloud.google.com/apis/credentials
2. Selecciona tu proyecto
3. Encuentra tu OAuth Client ID actual
4. Click "🗑️ Delete" → Confirmar
5. Click "Create Credentials" → "OAuth 2.0 Client ID"
6. Tipo: "Desktop app"
7. Nombre: "Gym Manager Pro"
8. Click "Create"
9. Copia el **Client ID** y **Client Secret**

### GitHub Token
1. Abre: https://github.com/settings/tokens
2. Encuentra tu token actual (Gym Manager Pro)
3. Click "Delete"
4. Click "Generate new token (classic)"
5. Nombre: "Gym Manager Pro - Updates"
6. Permisos: Solo marca ✅ `repo`
7. Click "Generate token"
8. Copia el nuevo token

---

## 💾 PASO 2: Configurar Nuevo Sistema (5 min)

### Opción A: Script Automático (Recomendado)
```bash
npm run migrate-credentials
```
Sigue las instrucciones en pantalla.

### Opción B: Manual
```bash
# 1. Crea .env.local
cp .env.local.example .env.local

# 2. Edita .env.local con tus NUEVAS credenciales
notepad .env.local  # Windows
nano .env.local     # Mac/Linux

# 3. Pega las NUEVAS credenciales que copiaste en Paso 1

# 4. Guarda y cierra
```

Tu `.env.local` debe verse así:
```env
SUPABASE_URL=https://tquffflabpmizsbsqbll.supabase.co
SUPABASE_KEY=eyJ...TU_NUEVA_KEY_AQUI

GOOGLE_CLIENT_ID=TU-NUEVO-CLIENT-ID.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=TU-NUEVO-CLIENT-SECRET
GOOGLE_PROJECT_ID=gym-app-486719

GH_TOKEN=ghp_TU_NUEVO_TOKEN_AQUI
```

---

## ✅ PASO 3: Verificar (2 min)

```bash
# Iniciar la app
npm run dev

# Busca esta línea en la consola:
# 🔐 SECURE CREDENTIALS STATUS
# ✅ Credentials loaded successfully
# ☁️ Supabase: ✅ Configured
```

Si ves ✅, perfecto. Si ves ❌, revisa que pegaste bien las credenciales.

---

## 🧹 PASO 4: Limpiar (3 min)

```bash
# 1. Elimina el .env viejo (YA NO LO NECESITAS)
rm .env  # Mac/Linux
del .env # Windows

# 2. (IMPORTANTE) Eliminar .env del historial de git
git filter-branch --force --index-filter "git rm --cached --ignore-unmatch .env" --prune-empty --tag-name-filter cat -- --all

# 3. Force push (si trabajas solo, si no, coordina con tu equipo)
git push origin --force --all

# 4. Commit el nuevo sistema
git add .
git commit -m "feat: implement secure credential management system

- Add credential manager with multi-level priority
- Support system env, .env.local, and encrypted store
- Remove hardcoded credentials from codebase
- Add comprehensive security documentation
"

git push
```

---

## 🎉 ¡LISTO!

Tu app ahora es mucho más segura. Las credenciales ya NO están en el código.

### ¿Qué cambió?

| Antes | Ahora |
|-------|-------|
| `.env` en el código | `.env.local` (git-ignored) |
| Credenciales en ASAR | Credenciales en tu sistema |
| Cualquiera puede extraerlas | Solo tú tienes acceso |
| ❌ Inseguro | ✅ Seguro |

---

## 📚 Siguientes Pasos

- Lee `CREDENTIALS_SETUP.md` para configuración de producción
- Lee `IMPLEMENTATION_SUMMARY.md` para detalles técnicos
- Considera implementar proxy backend (opcional)

---

## 🆘 Si Algo Sale Mal

**Problema**: La app no inicia
```bash
# Revisa los logs
# Windows: %APPDATA%\gym-manager-pro\logs\main.log
# Mac: ~/Library/Logs/gym-manager-pro/main.log

# Busca errores relacionados con credenciales
```

**Problema**: "Supabase credentials incomplete"
```bash
# Verifica que .env.local tiene SUPABASE_URL y SUPABASE_KEY
cat .env.local | grep SUPABASE

# Si está vacío, revisa el Paso 2
```

**Problema**: "Google Drive service not available"
```bash
# Esto es NORMAL si no configuraste Google OAuth
# Google Drive es OPCIONAL, la app funciona sin él
```

---

## ⏱️ Checklist Final

- [ ] Rotaste credenciales de Supabase
- [ ] Rotaste credenciales de Google OAuth
- [ ] Rotaste token de GitHub
- [ ] Creaste `.env.local` con NUEVAS credenciales
- [ ] Eliminaste `.env` viejo
- [ ] Limpiaste `.env` del historial de git
- [ ] Hiciste commit del nuevo sistema
- [ ] Verificaste que la app funciona (`npm run dev`)

---

**¡Felicidades!** 🎉 Tu app ahora es robusta y segura.
