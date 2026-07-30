-- 2026-07-30 · Privacidad/RGPD: quitar lectura anon de gym_class_bookings.
--
-- Contexto: la política "anon reads class bookings" (SELECT, rol anon, USING
-- true) dejaba a cualquiera con la anon key leer TODAS las reservas de TODOS los
-- gimnasios (nombres/asistencia) — fuga de datos personales entre gimnasios.
--
-- Ya existía la política correcta y scopeada "Client reads gym booking counts"
-- (SELECT, rol authenticated, filtrada al gym del socio vía mobile_client_links).
-- Los hooks del móvil (use-classes.ts, use-attendance.ts) exigen session y
-- filtran por gym_id, así que solo usan la política authenticated. La de anon
-- era peso muerto e insegura.
--
-- Verificado en prod: usuario authenticated de un gym ve solo las reservas de su
-- gym (1207, no 1254 totales); anon ve 0.

DROP POLICY IF EXISTS "anon reads class bookings" ON public.gym_class_bookings;
