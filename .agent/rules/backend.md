---
trigger: always_on
---

🔒 Reglas de Seguridad (IPC)
Zero Node in Renderer: Frontend ciego a la infraestructura. Usa window.api.

Validación Zod: Nada entra a SQLite sin pasar por un esquema Zod (especialmente strings de inputs de usuario).

💾 Patrón de Persistencia (Híbrido)
SQLite (Local - Síncrono):

Transacciones obligatorias para operaciones multi-tabla (db.transaction).

Migraciones: Al inicio, database.js verifica integridad de tablas locales.

Supabase (Nube - Asíncrono):

Identidad Compuesta: PK siempre es (gym_id, local_id).

Operaciones No Bloqueantes: El backup o sync nunca debe congelar la UI. Usar Promise.all o "Fire & Forget" controlados.

Excel & Storage:

Triangulación: Generar Buffer -> Subir a Storage -> Obtener URL Pública -> Abrir WhatsApp. No guardar archivos basura en disco local permanentemente.

☁️ Consistencia Cloud (La Regla de Oro)
⚠️ MIRROR RULE: Cualquier CREATE TABLE o ALTER TABLE en SQLite debe replicarse manualmente en supabase_schema.sql. Si rompes la simetría, rompes el Backup.