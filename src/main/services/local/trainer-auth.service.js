/**
 * trainer-auth.service.js — Trainer-mode authentication and scoped data access.
 *
 * Manages a Supabase Auth session for trainers (email + password), persists it
 * encrypted (electron-store, machine-bound key) and provides a thin client
 * around the `trainer-data` Edge Function with automatic token refresh.
 *
 * SECURITY:
 *  - Tokens are stored in a separate, machine-encrypted store (a copy to a
 *    different PC will fail to decrypt — same pattern as license_data).
 *  - service_role NEVER leaves the cloud (handled inside trainer-data).
 *  - On a 401 the session is refreshed once; on failure it is wiped.
 */

const Store = require('electron-store');
const { machineIdSync } = require('node-machine-id');
const credentialManager = require('../../config/credentials');

let store;
try {
    const hwId = machineIdSync();
    store = new Store({
        name: 'trainer_session',
        encryptionKey: `gym-manager-pro-trainer-${hwId}`,
        clearInvalidConfig: true,
    });
} catch (e) {
    console.error('[TrainerAuth] Store init failed, using fallback:', e);
    store = new Store({ name: 'trainer_session', clearInvalidConfig: true });
}

const REQUEST_TIMEOUT_MS = 15_000;

function getCreds() {
    if (!credentialManager.isLoaded()) return null;
    const c = credentialManager.get();
    if (!c?.supabase?.url || !c?.supabase?.key) return null;
    return { url: c.supabase.url, anonKey: c.supabase.key };
}

async function httpJson(url, options) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
        const res = await fetch(url, { ...options, signal: controller.signal });
        const text = await res.text();
        let body = null;
        try { body = text ? JSON.parse(text) : null; } catch { body = { _raw: text }; }
        return { ok: res.ok, status: res.status, body };
    } catch (err) {
        return { ok: false, status: 0, body: { error: err?.message || String(err) } };
    } finally {
        clearTimeout(timer);
    }
}

// ----------------------------------------------------------------
// Session persistence
// ----------------------------------------------------------------

function getSession() { return store.get('session') || null; }
function setSession(session) { session ? store.set('session', session) : store.delete('session'); }
function clearSession() { store.delete('session'); store.delete('profile'); }
function getProfile() { return store.get('profile') || null; }
function setProfile(profile) { profile ? store.set('profile', profile) : store.delete('profile'); }
function isAuthenticated() { const s = getSession(); return !!(s && s.access_token); }

// ----------------------------------------------------------------
// Supabase Auth (REST — no supabase-js needed in main)
// ----------------------------------------------------------------

async function signIn(email, password) {
    const creds = getCreds();
    if (!creds) return { success: false, error: 'credentials_not_loaded' };
    if (!email || !password) return { success: false, error: 'email_and_password_required' };

    const r = await httpJson(`${creds.url}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: creds.anonKey },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
    });

    if (!r.ok) {
        return {
            success: false,
            error: r.body?.error_description || r.body?.msg || r.body?.error || `HTTP ${r.status}`,
        };
    }

    setSession({
        access_token: r.body.access_token,
        refresh_token: r.body.refresh_token,
        expires_at: r.body.expires_at,
        token_type: r.body.token_type,
        user_id: r.body.user?.id,
        email: r.body.user?.email,
    });

    // Verify they are actually an active trainer before keeping the session.
    const me = await callTrainerData('getMe', {});
    if (!me?.success) {
        clearSession();
        return { success: false, error: me?.error || 'Esta cuenta no tiene acceso de entrenador en ningún gimnasio.' };
    }
    setProfile(me.data);
    return { success: true, profile: me.data };
}

async function refreshSession() {
    const creds = getCreds();
    if (!creds) return false;
    const s = getSession();
    if (!s?.refresh_token) return false;

    const r = await httpJson(`${creds.url}/auth/v1/token?grant_type=refresh_token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: creds.anonKey },
        body: JSON.stringify({ refresh_token: s.refresh_token }),
    });
    if (!r.ok || !r.body?.access_token) {
        clearSession();
        return false;
    }
    setSession({
        access_token: r.body.access_token,
        refresh_token: r.body.refresh_token,
        expires_at: r.body.expires_at,
        token_type: r.body.token_type,
        user_id: r.body.user?.id ?? s.user_id,
        email: r.body.user?.email ?? s.email,
    });
    return true;
}

/**
 * Google OAuth flow for the desktop. Opens the system's DEFAULT BROWSER (the
 * one the user trusts and is already logged into) so Google's anti-phishing
 * checks pass and the user can just pick their account in one click.
 *
 * Pattern:
 *  1. Start a tiny loopback HTTP server on 127.0.0.1:OAUTH_PORT
 *  2. shell.openExternal(supabase_authorize_url) → user signs in in their browser
 *  3. Supabase redirects to http://localhost:OAUTH_PORT/callback#access_token=...
 *  4. The /callback page (served by us) grabs the URL fragment and POSTs it to /finalize
 *  5. We resolve and show a "Listo" page in the browser
 *  6. The Electron desktop receives the tokens and proceeds
 *
 * IMPORTANT: the redirect URL http://localhost:OAUTH_PORT/callback MUST be in
 * the Supabase "Redirect URLs" whitelist (Auth → URL Configuration).
 */
const OAUTH_PORT = 54323;
const OAUTH_REDIRECT = `http://localhost:${OAUTH_PORT}/callback`;

async function signInWithGoogle(/* parentWindow unused, kept for signature */ _parentWindow) {
    const { shell } = require('electron');
    const http = require('http');
    const creds = getCreds();
    if (!creds) return { success: false, error: 'credentials_not_loaded' };

    const authUrl =
        `${creds.url}/auth/v1/authorize` +
        `?provider=google` +
        `&redirect_to=${encodeURIComponent(OAUTH_REDIRECT)}`;

    return await new Promise((resolve) => {
        let resolved = false;
        let server;
        let timeoutId;

        const done = (result) => {
            if (resolved) return;
            resolved = true;
            clearTimeout(timeoutId);
            try { server?.close(); } catch { /* */ }
            resolve(result);
        };

        const finalizeTokens = async (params) => {
            const error = params.get('error') || params.get('error_description');
            const accessToken = params.get('access_token');
            const refreshToken = params.get('refresh_token');
            const expiresAt = parseInt(params.get('expires_at') || '0', 10);

            if (error) return done({ success: false, error });
            if (!accessToken) return done({ success: false, error: 'no_token' });

            const userRes = await httpJson(`${creds.url}/auth/v1/user`, {
                headers: { apikey: creds.anonKey, Authorization: `Bearer ${accessToken}` },
            });

            setSession({
                access_token: accessToken,
                refresh_token: refreshToken,
                expires_at: expiresAt || null,
                token_type: 'bearer',
                user_id: userRes.body?.id,
                email: userRes.body?.email,
            });

            const me = await callTrainerData('getMe', {});
            if (!me?.success) {
                clearSession();
                return done({
                    success: false,
                    error: me?.error === 'not_a_trainer'
                        ? 'Esta cuenta de Google no tiene acceso de entrenador. Pide al jefe que te invite con este email.'
                        : (me?.error || 'No se pudo verificar el acceso de entrenador.'),
                });
            }
            setProfile(me.data);
            done({ success: true, profile: me.data });
        };

        server = http.createServer((req, res) => {
            const url = req.url || '';

            if (url.startsWith('/callback')) {
                // Page that grabs tokens from the URL fragment (only visible to the browser)
                // and POSTs them back to us at /finalize.
                res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
                res.end(`<!doctype html><html><head><title>Iniciando sesión…</title></head>
<body style="margin:0;font-family:system-ui,sans-serif;background:#0f172a;color:#e2e8f0;display:flex;align-items:center;justify-content:center;height:100vh;">
<div style="text-align:center;max-width:420px;padding:32px;">
  <div id="msg"><h1 style="margin:0 0 12px;background:linear-gradient(90deg,#22d3ee,#60a5fa);-webkit-background-clip:text;background-clip:text;color:transparent;">Iniciando sesión…</h1><p style="color:#94a3b8;">Validando con tu gimnasio.</p></div>
  <div id="ok" style="display:none;"><h1 style="margin:0 0 12px;color:#34d399;">✅ Listo</h1><p style="color:#94a3b8;">Ya puedes cerrar esta pestaña y volver al desktop.</p></div>
</div>
<script>
(async () => {
  const hash = location.hash.slice(1);
  const search = location.search.slice(1);
  const body = hash || search;
  try {
    await fetch('/finalize', { method: 'POST', headers: {'Content-Type':'application/x-www-form-urlencoded'}, body });
  } catch (e) {}
  document.getElementById('msg').style.display = 'none';
  document.getElementById('ok').style.display = 'block';
  setTimeout(() => { try { window.close(); } catch(e){} }, 1500);
})();
</script>
</body></html>`);
                return;
            }

            if (url.startsWith('/finalize') && req.method === 'POST') {
                let body = '';
                req.on('data', (chunk) => { body += chunk; if (body.length > 8192) req.destroy(); });
                req.on('end', async () => {
                    res.writeHead(204, { 'Access-Control-Allow-Origin': '*' });
                    res.end();
                    try {
                        await finalizeTokens(new URLSearchParams(body));
                    } catch (err) {
                        done({ success: false, error: err?.message || 'finalize_failed' });
                    }
                });
                return;
            }

            res.writeHead(404); res.end();
        });

        server.on('error', (err) => done({ success: false, error: `oauth_server: ${err?.message || 'failed'}` }));

        server.listen(OAUTH_PORT, '127.0.0.1', () => {
            // Time-out the whole flow after 5 minutes.
            timeoutId = setTimeout(() => done({ success: false, error: 'timeout', cancelled: true }), 5 * 60 * 1000);
            shell.openExternal(authUrl).catch((err) => done({ success: false, error: err?.message || 'browser_open_failed' }));
        });
    });
}

async function signOut() {
    const creds = getCreds();
    const s = getSession();
    if (creds && s?.access_token) {
        await httpJson(`${creds.url}/auth/v1/logout`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                apikey: creds.anonKey,
                Authorization: `Bearer ${s.access_token}`,
            },
        }).catch(() => {});
    }
    clearSession();
    return { success: true };
}

// ----------------------------------------------------------------
// Trainer-data Edge Function client
// ----------------------------------------------------------------

async function callTrainerData(op, args, opts = {}) {
    const creds = getCreds();
    if (!creds) return { success: false, error: 'credentials_not_loaded' };
    const s = getSession();
    if (!s?.access_token) return { success: false, error: 'not_authenticated' };

    const r = await httpJson(`${creds.url}/functions/v1/trainer-data`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            apikey: creds.anonKey,
            Authorization: `Bearer ${s.access_token}`,
        },
        body: JSON.stringify({ op, args: args || {} }),
    });

    if (r.status === 401 && !opts._retry) {
        const refreshed = await refreshSession();
        if (refreshed) return callTrainerData(op, args, { _retry: true });
        clearSession();
        return { success: false, error: 'session_expired' };
    }
    if (!r.ok) {
        return { success: false, error: r.body?.error || `HTTP ${r.status}`, status: r.status };
    }
    return r.body || { success: false, error: 'empty_response' };
}

module.exports = {
    isAuthenticated,
    getSession,
    getProfile,
    signIn,
    signInWithGoogle,
    signOut,
    refreshSession,
    callTrainerData,
};
