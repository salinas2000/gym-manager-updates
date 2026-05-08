-- Migración: Permitir distintos tipos de "remote_load" (BD completa vs dataset parcial)
--
-- Antes: cada fila en cloud_remote_loads disparaba un reemplazo total de la BD del gimnasio receptor.
-- Ahora: la fila lleva un payload_type que decide qué hacer en el cliente.
--
-- payload_type:
--   'full_db'           — comportamiento actual (sustituir gym_manager.db)
--   'exercise_dataset'  — cargar JSON aditivo de ejercicios (no destructivo)
--
-- payload_path:
--   ruta dentro del bucket "training_files" (sin el bucket); ej. "{gymId}/exercise_dataset/2026-05-08T15-23-00.json"
--
-- Compatibilidad: las filas existentes quedan con payload_type='full_db' por defecto.

ALTER TABLE cloud_remote_loads
    ADD COLUMN IF NOT EXISTS payload_type TEXT NOT NULL DEFAULT 'full_db';

ALTER TABLE cloud_remote_loads
    ADD COLUMN IF NOT EXISTS payload_path TEXT;

CREATE INDEX IF NOT EXISTS idx_cloud_remote_loads_gym_status
    ON cloud_remote_loads (gym_id, status);
