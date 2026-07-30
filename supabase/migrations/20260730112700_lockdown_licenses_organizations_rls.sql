-- 2026-07-30 · Seguridad: cerrar RLS de licenses y organizations.
--
-- Contexto: estas tablas tenían políticas "Public Access" / "Enable * for all
-- users" (restos de desarrollo) que las dejaban legibles y escribibles por
-- cualquiera con la anon key (que viaja dentro de cada instalador). licenses
-- contiene las claves de licencia — el secreto que gatea las operaciones de
-- dueño y el bloqueo por impago.
--
-- Es seguro cerrarlas: el desktop usa la Edge Function license-ops, el móvil lee
-- la config vía la vista mobile_my_profile (SECURITY DEFINER), y el panel admin
-- usa la master key (service_role). service_role bypasea RLS.
--
-- Verificado en prod tras aplicar: como anon, SELECT count(*) devuelve 0 filas
-- en ambas tablas; la app sigue funcionando.

-- licenses
DROP POLICY IF EXISTS "Public Access" ON public.licenses;
DROP POLICY IF EXISTS "Enable insert for all users" ON public.licenses;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.licenses;
DROP POLICY IF EXISTS "Enable update for all users" ON public.licenses;

CREATE POLICY "Service Role Full Access" ON public.licenses
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- organizations (ya tenía "Service Role Full Access")
DROP POLICY IF EXISTS "Public Access" ON public.organizations;
DROP POLICY IF EXISTS "Enable insert for all users" ON public.organizations;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.organizations;
DROP POLICY IF EXISTS "Enable update for all users" ON public.organizations;
