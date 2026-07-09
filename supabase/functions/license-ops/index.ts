import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

/**
 * license-ops — Edge Function for the license lifecycle.
 * activate / renew / reportVersion / reportSettings. The desktop must NEVER
 * touch the licenses table directly (needs service_role). Auth: license_key +
 * hardware_id on activate; owner_token bearer on reportVersion/reportSettings.
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-client-info, apikey',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

function getServiceKey(): string {
  const legacy = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (legacy) return legacy;
  const json = Deno.env.get('SUPABASE_SECRET_KEYS');
  if (json) {
    try {
      const parsed = JSON.parse(json);
      const stack: unknown[] = [parsed];
      while (stack.length) {
        const v = stack.pop();
        if (typeof v === 'string') return v;
        if (v && typeof v === 'object') stack.push(...Object.values(v));
      }
    } catch { /* ignore */ }
  }
  return '';
}

function getSupabase() {
  return createClient(Deno.env.get('SUPABASE_URL')!, getServiceKey());
}

// Best-effort "last seen" stamp for the master panel presence. NEVER allowed
// to affect the caller's result.
// deno-lint-ignore no-explicit-any
async function stampLastSeen(supabase: any, column: string, value: string) {
  try {
    await supabase.from('licenses').update({ last_seen: new Date().toISOString() }).eq(column, value);
  } catch { /* presence is best-effort; ignore */ }
}

// Valida owner_token y devuelve la fila de licencia, o una Response de error.
// deno-lint-ignore no-explicit-any
async function authOwner(supabase: any, req: Request, gym_id: string) {
  const callerToken = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!callerToken) return json({ error: 'missing_bearer' }, 401);
  const { data: license } = await supabase
    .from('licenses')
    .select('id, gym_id, is_master')
    .eq('owner_token', callerToken)
    .maybeSingle();
  if (!license) return json({ error: 'invalid_owner_token' }, 403);
  if (!license.is_master && license.gym_id !== gym_id) return json({ error: 'gym_mismatch' }, 403);
  return license;
}

// ===========================================================================
// OPERATIONS
// ===========================================================================

// deno-lint-ignore no-explicit-any
async function opActivate(args: any) {
  const { license_key, hardware_id } = args || {};
  if (!license_key || !hardware_id) return json({ error: 'license_key_and_hardware_required' }, 400);

  const supabase = getSupabase();
  const { data: license, error } = await supabase
    .from('licenses')
    .select('id, license_key, gym_id, gym_name, hardware_id, active, is_master, owner_token, app_version, plan, features')
    .eq('license_key', license_key)
    .maybeSingle();

  if (error) return json({ error: error.message }, 500);
  if (!license) return json({ error: 'license_not_found' }, 404);
  if (!license.active) return json({ error: 'license_inactive' }, 403);

  if (license.hardware_id && license.hardware_id !== hardware_id) {
    return json({ error: 'hardware_mismatch' }, 403);
  }
  if (!license.hardware_id) {
    const { error: updErr } = await supabase
      .from('licenses')
      .update({ hardware_id })
      .eq('id', license.id);
    if (updErr) return json({ error: 'hardware_bind_failed', detail: updErr.message }, 500);
  }

  await stampLastSeen(supabase, 'id', license.id);

  return json({
    success: true,
    license: {
      license_key: license.license_key,
      gym_id: license.gym_id,
      gym_name: license.gym_name,
      is_master: !!license.is_master,
      owner_token: license.owner_token,
      plan: license.plan || 'pro',
      features: license.features || null,
    },
  });
}

// deno-lint-ignore no-explicit-any
async function opRenew(args: any) {
  const { license_key, hardware_id } = args || {};
  if (!license_key || !hardware_id) return json({ error: 'license_key_and_hardware_required' }, 400);

  const supabase = getSupabase();
  const { data: license, error } = await supabase
    .from('licenses')
    .select('active, owner_token, hardware_id, plan, features')
    .eq('license_key', license_key)
    .maybeSingle();

  if (error) return json({ error: error.message }, 500);
  if (!license) return json({ active: false, reason: 'license_not_found' }, 404);
  if (!license.active) return json({ active: false, reason: 'license_revoked' }, 200);
  if (license.hardware_id && license.hardware_id !== hardware_id) {
    return json({ active: false, reason: 'hardware_mismatch' }, 403);
  }

  await stampLastSeen(supabase, 'license_key', license_key);

  return json({
    active: true,
    owner_token: license.owner_token,
    plan: license.plan || 'pro',
    features: license.features || null,
  });
}

// deno-lint-ignore no-explicit-any
async function opReportVersion(args: any, req: Request) {
  const { gym_id, version } = args || {};
  if (!gym_id || !version) return json({ error: 'gym_id_and_version_required' }, 400);

  const supabase = getSupabase();
  const license = await authOwner(supabase, req, gym_id);
  if (license instanceof Response) return license;

  const { error } = await supabase.from('licenses').update({ app_version: version, last_seen: new Date().toISOString() }).eq('gym_id', gym_id);
  if (error) return json({ error: error.message }, 500);
  return json({ success: true });
}

// Sube la config de auto-baja del escritorio a la fila de licencia, para que la
// app móvil (vista mobile_my_profile) la refleje. Autenticado por owner_token.
// deno-lint-ignore no-explicit-any
async function opReportSettings(args: any, req: Request) {
  const { gym_id, auto_deactivate_enabled, auto_deactivate_grace_days } = args || {};
  if (!gym_id) return json({ error: 'gym_id_required' }, 400);

  const supabase = getSupabase();
  const license = await authOwner(supabase, req, gym_id);
  if (license instanceof Response) return license;

  // deno-lint-ignore no-explicit-any
  const patch: Record<string, any> = {};
  if (typeof auto_deactivate_enabled === 'boolean') patch.auto_deactivate_enabled = auto_deactivate_enabled;
  if (Number.isInteger(auto_deactivate_grace_days)) {
    patch.auto_deactivate_grace_days = Math.min(365, Math.max(0, auto_deactivate_grace_days));
  }
  if (Object.keys(patch).length === 0) return json({ error: 'nothing_to_update' }, 400);

  const { error } = await supabase.from('licenses').update(patch).eq('gym_id', gym_id);
  if (error) return json({ error: error.message }, 500);
  return json({ success: true });
}

// ===========================================================================
// ROUTER
// ===========================================================================

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  // deno-lint-ignore no-explicit-any
  let body: any = {};
  try { body = await req.json(); }
  catch { return json({ error: 'invalid_json' }, 400); }

  switch (body?.op) {
    case 'activate':       return await opActivate(body);
    case 'renew':          return await opRenew(body);
    case 'reportVersion':  return await opReportVersion(body, req);
    case 'reportSettings': return await opReportSettings(body, req);
    default: return json({ error: 'unknown_op', received: body?.op }, 400);
  }
});
