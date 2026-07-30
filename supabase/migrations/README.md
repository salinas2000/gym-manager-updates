# Migraciones de Supabase

Historial versionado de cambios de esquema de la base de datos cloud
(proyecto Supabase `tquffflabpmizsbsqbll`).

## Punto de partida (importante)

El esquema **anterior al 2026-07-30 NO está capturado aquí**. Se construyó de
forma incremental por el dashboard de Supabase / MCP, sin migraciones. Estos
ficheros versionan los cambios **a partir de esa fecha hacia delante**.

Para obtener un baseline completo del esquema histórico en el futuro:
`supabase db dump --schema public > 00000000000000_baseline.sql` (requiere el
CLI de Supabase configurado y credenciales del proyecto).

## Convención

- Un fichero por cambio: `YYYYMMDDHHMMSS_descripcion_en_snake_case.sql`.
- Idempotente siempre que se pueda (`DROP ... IF EXISTS`, `CREATE OR REPLACE`).
- Comentario de cabecera con contexto, por qué es seguro y cómo se verificó.

## Cómo aplicar

Estos cambios **ya están aplicados en producción** (se ejecutaron a mano por el
SQL Editor el 2026-07-30). Estos ficheros son la fuente de verdad versionada.

En un entorno nuevo, aplicarlos en orden con el SQL Editor, o con el CLI:
`supabase db push`.
