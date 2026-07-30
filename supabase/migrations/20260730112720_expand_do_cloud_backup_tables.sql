-- 2026-07-30 · Backups: completar el snapshot lógico do_cloud_backup().
--
-- Contexto: el snapshot diario (pg_cron jobid 3, 03:00 UTC) solo volcaba 14
-- tablas; faltaban catálogo de ejercicios, clases/horarios/eventos, entrenadores,
-- organizations, vínculos de móvil y consentimientos RGPD. Una reconstrucción
-- desde el snapshot habría perdido esas definiciones.
--
-- Esta versión vuelca 25 tablas. Se omiten a propósito las transitorias/
-- regenerables: push_subscriptions, cloud_remote_loads, gym_display_*,
-- global_notifications. Retención: últimas 14 copias.
--
-- Verificado en prod (SELECT public.do_cloud_backup()): el snapshot resultante
-- trae 7 clases, 358 horarios, 6 entrenadores, 117 vínculos, 104 consentimientos.

CREATE OR REPLACE FUNCTION public.do_cloud_backup()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.cloud_backups (payload)
  VALUES (jsonb_build_object(
    'taken_at', now(),
    -- Reservas + datos de socio
    'gym_class_bookings',            COALESCE((SELECT jsonb_agg(t) FROM gym_class_bookings t), '[]'::jsonb),
    'customer_rm_records',           COALESCE((SELECT jsonb_agg(t) FROM customer_rm_records t), '[]'::jsonb),
    'customer_profile_submissions',  COALESCE((SELECT jsonb_agg(t) FROM customer_profile_submissions t), '[]'::jsonb),
    'customer_workout_logs',         COALESCE((SELECT jsonb_agg(t) FROM customer_workout_logs t), '[]'::jsonb),
    'customer_weight_logs',          COALESCE((SELECT jsonb_agg(t) FROM customer_weight_logs t), '[]'::jsonb),
    'licenses',                      COALESCE((SELECT jsonb_agg(t) FROM licenses t), '[]'::jsonb),
    -- Árbol de entrenamiento
    'cloud_mesocycles',              COALESCE((SELECT jsonb_agg(t) FROM cloud_mesocycles t), '[]'::jsonb),
    'cloud_routines',                COALESCE((SELECT jsonb_agg(t) FROM cloud_routines t), '[]'::jsonb),
    'cloud_routine_items',           COALESCE((SELECT jsonb_agg(t) FROM cloud_routine_items t), '[]'::jsonb),
    'cloud_exercises',               COALESCE((SELECT jsonb_agg(t) FROM cloud_exercises t), '[]'::jsonb),
    -- Socios + finanzas
    'cloud_customers',               COALESCE((SELECT jsonb_agg(t) FROM cloud_customers t), '[]'::jsonb),
    'cloud_payments',                COALESCE((SELECT jsonb_agg(t) FROM cloud_payments t), '[]'::jsonb),
    'cloud_tariffs',                 COALESCE((SELECT jsonb_agg(t) FROM cloud_tariffs t), '[]'::jsonb),
    'cloud_memberships',             COALESCE((SELECT jsonb_agg(t) FROM cloud_memberships t), '[]'::jsonb),
    -- Catálogo de ejercicios
    'cloud_exercise_categories',     COALESCE((SELECT jsonb_agg(t) FROM cloud_exercise_categories t), '[]'::jsonb),
    'cloud_exercise_subcategories',  COALESCE((SELECT jsonb_agg(t) FROM cloud_exercise_subcategories t), '[]'::jsonb),
    'cloud_exercise_field_config',   COALESCE((SELECT jsonb_agg(t) FROM cloud_exercise_field_config t), '[]'::jsonb),
    -- Clases y horarios
    'cloud_gym_classes',             COALESCE((SELECT jsonb_agg(t) FROM cloud_gym_classes t), '[]'::jsonb),
    'cloud_gym_class_schedules',     COALESCE((SELECT jsonb_agg(t) FROM cloud_gym_class_schedules t), '[]'::jsonb),
    'gym_class_events',              COALESCE((SELECT jsonb_agg(t) FROM gym_class_events t), '[]'::jsonb),
    -- Entrenadores
    'cloud_trainers',                COALESCE((SELECT jsonb_agg(t) FROM cloud_trainers t), '[]'::jsonb),
    'cloud_trainer_schedules',       COALESCE((SELECT jsonb_agg(t) FROM cloud_trainer_schedules t), '[]'::jsonb),
    -- Organización + vínculos móvil + consentimientos RGPD
    'organizations',                 COALESCE((SELECT jsonb_agg(t) FROM organizations t), '[]'::jsonb),
    'mobile_client_links',           COALESCE((SELECT jsonb_agg(t) FROM mobile_client_links t), '[]'::jsonb),
    'mobile_consents',               COALESCE((SELECT jsonb_agg(t) FROM mobile_consents t), '[]'::jsonb)
  ));

  DELETE FROM public.cloud_backups
  WHERE id NOT IN (SELECT id FROM public.cloud_backups ORDER BY created_at DESC LIMIT 14);
END;
$function$;
