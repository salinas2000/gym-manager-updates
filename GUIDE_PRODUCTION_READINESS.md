# 🚀 Guía de Robustez y Preparación para Producción

Esta guía resume los análisis de robustez y establece pasos para mantener la aplicación estable en producción.

## 1. Sincronización de Esquemas (Regla de Oro)
Se detectó que el esquema local (`database.js`) evoluciona más rápido que el de la nube (`supabase_schema.sql`).
**Acción Requerida:** Cada vez que modifiques `database.js` añadiendo columnas, debes añadirlas manualmente a `supabase_schema.sql` y ejecutar el ALTER TABLE en Supabase.

### Columnas Críticas Añadidas en esta Auditoría:
- `mesocycles.drive_link`
- `exercises.notes`
- `exercises.custom_fields`
- `routine_items.custom_fields`

## 2. Testing Strategy
Actualmente tienes 91 tests pasando.
- **Smoke Tests**: El script `tests/smoke.test.js` actual usa mocks de Electron. Para mayor fidelidad, considera usar `electron-mocha` en el futuro.
- **CI**: Configurar GitHub Actions para ejecutar `npm test` en cada push.

## 3. Comandos de Verificación Rápida
Antes de cada release, ejecuta:
```bash
# 1. Verificar lógica y tests
npm test

# 2. Verificar construcción del frontend (detecta errores de importación)
npx vite build

# 3. Verificar sintaxis del proceso principal
node --check src/main/main.js
```

## 4. Logs en Producción
Los logs se guardan en `%USERPROFILE%\AppData\Roaming\Gym Manager Pro\logs\`.
- **Nivel Info**: Operaciones normales.
- **Nivel Error**: Fallos críticos.
Pide este archivo a los usuarios si reportan pantallas blancas o fallos de sincronización.
