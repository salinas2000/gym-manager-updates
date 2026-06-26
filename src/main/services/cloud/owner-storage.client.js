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
            return { success: false, error: err.name === 'AbortError' ? 'timeout' : `network_${err.message}` };
        }
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
     * Best-effort existence check via a public HEAD, retried a few times to ride
     * out the same flaky sockets. Used to confirm an upload that the PUT couldn't
     * confirm because undici threw on the response.
     */
    async _objectExists(path, opts_bucket) {
        for (let i = 0; i < 3; i++) {
            try {
                const pub = await this.getPublicUrl(path, { bucket: opts_bucket });
                if (pub?.success && pub.url) {
                    const ctrl = new AbortController();
                    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
                    const res = await fetch(pub.url, { method: 'HEAD', signal: ctrl.signal });
                    clearTimeout(timer);
                    if (res.ok) return true;
                    if (res.status === 404) return false;
                }
            } catch { /* transient — retry */ }
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
     * Get a public URL for an object. Only useful if the bucket policy
     * actually allows public read (the Edge Function just formats the URL).
     */
    async getPublicUrl(path, opts = {}) {
        return await this._call('publicUrl', { path, bucket: opts.bucket });
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
