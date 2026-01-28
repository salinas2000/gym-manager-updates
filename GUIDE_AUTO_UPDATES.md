# 🚀 Guía de Configuración: Auto-Actualizaciones con GitHub

Para que tus clientes reciban actualizaciones automáticas, necesitas alojar el código en GitHub. Sigue estos pasos sencillos.

## 1. Crear Repositorio en GitHub
1. Ve a [github.com/new](https://github.com/new).
2. Nombre del repositorio: `gym-manager-updates` (o el que quieras).
3. **Público** (gratis) o **Privado** (necesitas configurar un token extra, mejor empieza público si no hay datos sensibles en el código *source* - OJO: tus credenciales de Supabase deben estar en `.env` no en el código).
4. Crea el repositorio.

## 2. Configurar `package.json`
He modificado tu archivo `package.json`. Debes abrirlo y buscar donde dice `TU_USUARIO` y `TU_REPO` y poner tus datos reales.

Ejemplo:
```json
"repository": {
    "url": "https://github.com/salinas2000/gym-manager-updates.git"
},
"build": {
    "files": [
        "dist/**/*",
        "src/main/**/*",
        "src/preload/**/*",
        "package.json"
    ],
    "publish": [
        {
            "provider": "github",
            "owner": "salinas2000",
            "repo": "gym-manager-updates"
        }
    ]
}
```

> [!IMPORTANT]
> **No toques la sección "files"**. Es vital para que el instalador incluya todo el código necesario.

## 3. Subir tu Código (Primera Vez)
Abre una terminal en la carpeta de tu proyecto y ejecuta:

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/salinas2000/gym-manager-updates.git
git push -u origin main
```
*(Cambia la URL por la de tu repo nuevo)*

## 4. Publicar una Actualización (Workflow)

Cuando hagas mejoras y quieras lanzarlas a los usuarios:

1. **Sube la versión** en `package.json` (ej: de `1.0.0` a `1.0.1`).
2. Genera el instalador y publícalo:
   ```bash
   npm run build
   ```
   *(Esto creará un instalador `.exe` en la carpeta `dist`)*

3. Ve a tu repositorio en GitHub > **Releases** > **Draft a new release**.
4. Tag version: `v1.0.1` (Igual que en package.json pero con 'v').
5. Título: "Mejoras de Velocidad" (o lo que sea).
6. **MUY IMPORTANTE:** Arrastra **DOS ARCHIVOS** de la carpeta `dist/`:
   *   `Gym Manager Pro Setup 1.0.1.exe` (El instalador)
   *   `latest.yml` (INFORMACIÓN CRÍTICA PARA EL UPDATER)
7. Dale a **Publish release**.

> [!WARNING]
> Si no subes el archivo `latest.yml`, la app dará error 404 al buscar actualizaciones.

¡Listo! 🚀
La próxima vez que tus usuarios abran la app, verán la alerta de "Nueva versión disponible" y podrán descargarla e instalarla automáticamente.
