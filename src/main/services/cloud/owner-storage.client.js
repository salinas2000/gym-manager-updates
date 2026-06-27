/**
 * owner-storage HTTP client.
 *
 * Replaces direct `this.supabase.storage.from(bucket).*` calls in
 * cloud.service.js. The Edge Function generates presigned upload/download
 * URLs (so file bytes stream straight to the storage backend, never through
 * the function) and performs server-side remove operations.
 */

const licenseService = require('../local/license.service');
const credentialManager = require('../../config/credentials');

const TIMEOUT_MS = 20_000;
const UPLOAD_TIMEOUT_MS = 60_000;

class OwnerStorageClient {
    async _call(op, args) {
        if (!credentialManager.isLoaded()) {
            return { success: false, error: 'credentials_not_loaded' };
        }
        const url = credentialManager.get()?.supabase?.url;
        if (!url) return { success: false, error: 'no_supabase_url' };
        const token = licenseService.getOwnerToken();
        if (!token) return { success: false, error: 'no_owner_token' };

        // Retry transient undici "fetch failed" hiccups (flaky networks / IPv6 /
        // AV intercepting TLS). The Edge Function ops are idempotent enough that
        // a retry is safe.
        let lastErr = 'network_error';
        for (let attempt = 1; attempt <= 3; attempt++) {
            const ctrl = new AbortController();
            const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
            try {
                const res = await fetch(`${url}/functions/v1/owner-storage`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`,
                    },
                    body: JSON.stringify({ op, ...args }),
                    signal: ctrl.signal,
                });
                clearTimeout(timer);
                let body = null;
                try { body = await res.json(); } catch { /* */ }
                if (!res.ok) {
                    return { success: false, error: body?.error || `HTTP ${res.status}`, status: res.status };
                }
                return body || { success: true };
            } catch (err) {
                clearTimeout(timer);
                lastErr = err.name === 'AbortError' ? 'timeout' : `network_${err.message}`;
                await new Promise((r) => setTimeout(r, 300 * attempt));
            }
        }
        return { success: false, error: lastErr };
    }

    /**
     * Upload a buffer to storage. The Edge Function issues a presigned URL,
     * then we PUT the bytes directly to that URL (so the file doesn't
     * stream through the function).
     *
     * @param {string} path - object path (Edge Function will scope to gym)
     * @param {Buffer|Uint8Array} buffer
     * @param {string} contentType
     * @param {object} [opts] - { bucket?: string, upsert?: boolean }
     * @returns {{ success: boolean, path?: string, error?: string }}
     */
    async upload(path, buffer, contentType, opts = {}) {
        const signRes = await this._call('signedUpload', {
            path,
            bucket: opts.bucket,
            upsert: opts.upsert ?? true,
        });
        if (!signRes?.success) return signRes || { success: false, error: 'signed_upload_failed' };

        // Node's fetch (undici) intermittently throws "fetch failed" on some
        // networks (IPv6 / proxy / AV) while streaming a sizeable request body
        // through Cloudflare — EVEN WHEN the bytes actually reach the server and
        // the object is created. So we (1) retry the PUT a few times, and (2) if
        // every attempt throws, VERIFY whether the object landed before failing.
        let lastErr = 'upload_failed';
        for (let attempt = 1; attempt <= 3; attempt++) {
            const ctrl = new AbortController();
            const timer = setTimeout(() => ctrl.abort(), UPLOAD_TIMEOUT_MS);
            try {
                const res = await fetch(signRes.url, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': contentType || 'application/octet-stream',
                        'x-upsert': (opts.upsert ?? true) ? 'true' : 'false',
                    },
                    body: buffer,
                    signal: ctrl.signal,
                });
                clearTimeout(timer);
                if (res.ok) return { success: true, path: signRes.path };
                let detail = '';
                try { detail = await res.text(); } catch { /* */ }
                lastErr = `upload_http_${res.status}: ${detail.substring(0, 200)}`;
                break; // a real HTTP error (not a socket glitch) — don't retry
            } catch (err) {
                clearTimeout(timer);
                lastErr = err.name === 'AbortError' ? 'upload_timeout' : `upload_network: ${err.message}`;
                // socket / "fetch failed" glitch — fall through and retry
            }
        }

        // Every PUT threw client-side. The upload often still succeeded, so
        // confirm the object exists before reporting failure.
        if (await this._objectExists(signRes.path, opts.bucket)) {
            return { success: true, path: signRes.path };
        }
        return { success: false, error: lastErr };
    }

    /**
     * Existence check via the Edge Function (signedDownload), NOT a direct CDN
     * request. On flaky networks the direct storage/CDN calls (and the upload
     * PUT) throw "fetch failed" in undici, but the Edge Function calls go through
     * fine — so we ask the function to sign a download URL: it succeeds if the
     * object exists and returns 404 if not. Retried to ride out transient blips.
     */
    async _objectExists(path, opts_bucket) {
        for (let attempt = 0; attempt < 4; attempt++) {
            const res = await this._call('signedDownload', {
                path,
                bucket: opts_bucket,
                expiresIn: 60,
            });
            if (res?.success) return true;          // function signed a URL → exists
            if (res?.status === 404) return false;  // confirmed not found
            await new Promise((r) => setTimeout(r, 400)); // transient — brief wait, retry
        }
        return false;
    }

    /**
     * Download an object as a Buffer. Two HTTPS round-trips: one to the
     * Edge Function for the signed URL, one to the storage backend.
     */
    async download(path, opts = {}) {
        const signRes = await this._call('signedDownload', {
            path,
            bucket: opts.bucket,
            expiresIn: opts.expiresIn,
        });
        if (!signRes?.success) return signRes || { success: false, error: 'signed_download_failed' };

        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
        try {
            const res = await fetch(signRes.url, { signal: ctrl.signal });
            clearTimeout(timer);
            if (!res.ok) return { success: false, error: `download_http_${res.status}` };
            const arrayBuffer = await res.arrayBuffer();
            return { success: true, data: Buffer.from(arrayBuffer), path: signRes.path };
        } catch (err) {
            clearTimeout(timer);
            return { success: false, error: err.name === 'AbortError' ? 'download_timeout' : `download_network: ${err.message}` };
        }
    }

    /**
     * Public URL for an object. This is a DETERMINISTIC string — no network call
     * needed — so we build it locally. Doing a round-trip to the Edge Function
     * here used to fail on flaky networks (undici "fetch failed") AFTER a video
     * had already uploaded fine, surfacing a bogus "no se pudo subir el vídeo".
     */
    async getPublicUrl(path, opts = {}) {
        const url = credentialManager.get()?.supabase?.url;
        if (!url) return { success: false, error: 'no_supabase_url' };
        const bucket = opts.bucket || 'training_files';
        return { success: true, bucket, path, url: `${url}/storage/v1/object/public/${bucket}/${path}` };
    }

    /**
     * Remove one or many objects.
     */
    async remove(paths, opts = {}) {
        const list = Array.isArray(paths) ? paths : [paths];
        return await this._call('remove', { paths: list, bucket: opts.bucket });
    }

    /**
     * List objects under a prefix. Returns { success, items: [...] }.
     */
    async list(prefix, options, opts = {}) {
        return await this._call('list', { prefix, options, bucket: opts.bucket });
    }
}

module.exports = new OwnerStorageClient();
