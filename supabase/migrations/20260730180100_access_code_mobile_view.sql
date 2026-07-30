-- 2026-07-30 · PASO 2 de 2 — exponer access_code en la vista del perfil móvil.
--
-- Requiere haber aplicado antes 20260730180000_access_code_mobile.sql (la
-- columna cloud_customers.access_code).
--
-- Esta es la definición REAL de la vista vigente (obtenida con
-- pg_get_viewdef), con UNA sola línea añadida: `c.access_code`. No se toca nada
-- más — de esta vista depende toda la app móvil.
--
-- Es un CREATE OR REPLACE que solo AÑADE una columna al final del SELECT, que
-- es lo único que Postgres permite sin borrar la vista. Los consumidores
-- actuales no se ven afectados.

CREATE OR REPLACE VIEW public.mobile_my_profile AS
 SELECT c.local_id AS customer_id,
    c.first_name,
    c.last_name,
    c.email,
    c.phone,
    c.active,
    c.height_cm,
    c.weight_kg,
    c.birth_date,
    c.medical_info,
    c.gym_id,
    t.name AS tariff_name,
    t.amount AS tariff_amount,
    t.billing_months,
    t.color_theme,
    m.start_date AS membership_start,
    m.end_date AS membership_end,
    COALESCE(c.mobile_show_schedule, 1) AS mobile_show_schedule,
    COALESCE(lic.plan, 'pro'::text) AS gym_plan,
    lic.features AS gym_features,
    c.dni,
    c.address,
    c.auto_deactivated_at,
    COALESCE(lic.auto_deactivate_enabled, false) AS gym_auto_deactivate_enabled,
    COALESCE(lic.auto_deactivate_grace_days, 15) AS gym_auto_deactivate_grace_days,
    -- NUEVO: código de control de acceso. Va al final a propósito: CREATE OR
    -- REPLACE VIEW solo admite añadir columnas al final del SELECT.
    c.access_code
   FROM cloud_customers c
     JOIN mobile_client_links mcl ON mcl.gym_id = c.gym_id AND mcl.customer_local_id = c.local_id
     LEFT JOIN cloud_tariffs t ON t.gym_id = c.gym_id AND t.local_id = c.tariff_id
     LEFT JOIN LATERAL ( SELECT cloud_memberships.start_date,
            cloud_memberships.end_date
           FROM cloud_memberships
          WHERE cloud_memberships.gym_id = c.gym_id AND cloud_memberships.customer_id = c.local_id
          ORDER BY cloud_memberships.start_date DESC
         LIMIT 1) m ON true
     LEFT JOIN LATERAL ( SELECT l.plan,
            l.features,
            l.auto_deactivate_enabled,
            l.auto_deactivate_grace_days
           FROM licenses l
          WHERE l.gym_id::text = c.gym_id AND l.active
          ORDER BY l.created_at DESC
         LIMIT 1) lic ON true
  WHERE mcl.auth_user_id = auth.uid();
