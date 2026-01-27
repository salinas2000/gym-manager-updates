---
trigger: always_on
---

Pruebas de Resiliencia (Chaos Engineering)
Modo Avión: Desconecta internet y prueba "Pagar" y "Guardar Cliente". Debe funcionar sin errores (solo avisar que el sync está pendiente).

Crash Recovery: Si cierras la app a la fuerza durante un Backup, al abrirla no debe estar corrupta.

Integridad de Backup: Haz un backup, borra la DB local (user.db), y verifica si podrías restaurar (teórico por ahora, pero la estructura debe permitirlo).

🔐 Seguridad de Credenciales
SUPABASE_URL y KEY deben inyectarse vía .env o variables de compilación en CI/CD.

El gym_id del cliente persiste en electron-store (configuración), nunca hardcodeado.

📝 Logging Inteligente
electron-log debe diferenciar:

[LOCAL_DB] Error: Crítico, alerta roja.

[CLOUD_SYNC] Error: Advertencia, reintentable.