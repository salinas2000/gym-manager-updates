-- 2026-07-30 · Control de acceso: el código del socio llega a la app móvil.
--
-- El código se genera en el escritorio (customers.access_code) y viaja a la nube
-- con el sync normal de socios. El móvil lo mostrará al socio (texto + QR) para
-- que lo enseñe en recepción.
--
-- PASO 1 de 2 — solo la columna. Es seguro: añade una columna anulable y un
-- índice parcial. Nada deja de funcionar si el escritorio todavía no envía el
-- campo, ni si el móvil aún no lo lee.
--
-- PASO 2 (aparte, ver 20260730180100_..._view.sql): exponerlo en la vista
-- mobile_my_profile. Se hace en un fichero separado A PROPÓSITO: esa vista es de
-- la que depende toda la app móvil, así que hay que reescribirla con su
-- definición exacta, nunca con una sustitución automática de texto.

ALTER TABLE public.cloud_customers
    ADD COLUMN IF NOT EXISTS access_code TEXT;

-- Búsqueda por código dentro de un gimnasio. Útil también a futuro si un tótem
-- o un torno valida contra la nube en vez de contra el escritorio.
CREATE INDEX IF NOT EXISTS idx_cloud_customers_access_code
    ON public.cloud_customers (gym_id, access_code)
    WHERE access_code IS NOT NULL;
