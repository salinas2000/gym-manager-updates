const Store = require('electron-store');
const { machineIdSync } = require('node-machine-id');
const credentialManager = require('../../config/credentials');

// Encrypted store for license data
// SECURITY: We bind the encryption key to the machine ID. If someone copies the
// config file to another PC, decryption will fail because the key will differ.
let store;
try {
    const hwId = machineIdSync();
    console.log('[LicenseService] Hardware ID:', hwId);
    store = new Store({
        name: 'license_data',
        encryptionKey: `gym-manager-pro-${hwId}`,
        clearInvalidConfig: true,
    });
    console.log('[LicenseService] Store initialized with encrypted key.');
} catch (e) {
    console.error('[LicenseService] Store init failed, using fallback:', e);
    store = new Store({ name: 'license_data', clearInvalidConfig: true });
}

const LICENSE_OPS_TIMEOUT_MS = 15_000;

/**
 * Thin HTTP client for the license-ops Edge Function. Replaces every direct
 * supabase.from('licenses') call so the desktop never needs service_role for
 * license operations.
 */
async function callLicenseOps(op, args, bearerToken) {
    if (!credentialManager.isLoaded()) {
        return { _error: 'credentials_not_loaded' };
    }
    const creds = credentialManager.get();
    const url = creds?.supabase?.url;
    if (!url) return { _error: 'no_supabase_url' };

    const headers = { 'Content-Type': 'application/json' };
    if (bearerToken) headers['Authorization'] = `Bearer ${bearerToken}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), LICENSE_OPS_TIMEOUT_MS);
    try {
        const res = await fetch(`${url}/functions/v1/license-ops`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ op, ...args }),
            signal: controller.signal,
        });
        clearTimeout(timer);
        let body = null;
        try { body = await res.json(); } catch { /* non-json */ }
        if (!res.ok) {
            return { _error: body?.error || `HTTP ${res.status}`, _status: res.status };
        }
        return body || {};
    } catch (err) {
        clearTimeout(timer);
        return { _error: err.name === 'AbortError' ? 'timeout' : `network_${err.message}` };
    }
}

class LicenseService {
    constructor() {
        this.hardwareId = machineIdSync();
        this.LEASE_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 Days
        this.WARNING_THRESHOLD = 3 * 24 * 60 * 60 * 1000; // 3 Days
    }

    isAuthenticated() {
        const status = this.validateLease();
        if (!status.valid) {
            console.warn(`[LicenseService] Auth Failed: ${status.reason}`);
            return false;
        }
        return true;
    }

    validateLease() {
        const data = store.get('license');
        if (!data) return { valid: false, reason: 'NO_LICENSE' };

        if (data.hardware_id !== this.hardwareId) {
            return { valid: false, reason: 'HARDWARE_MISMATCH' };
        }

        const now = Date.now();

        if (data.last_known_time && now < (data.last_known_time - 10 * 60 * 1000)) {
            return { valid: false, reason: 'SYSTEM_CLOCK_TAMPERED' };
        }

        if (!data.last_known_time || now > data.last_known_time) {
            const last = data.last_known_time || 0;
            if (now - last > 60 * 60 * 1000) {
                data.last_known_time = now;
                store.set('license', data);
            }
        }

        if (data.lease_expires_at && now > data.lease_expires_at) {
            return { valid: false, reason: 'LEASE_EXPIRED' };
        }

        const timeLeft = (data.lease_expires_at || 0) - now;
        const warning = timeLeft < this.WARNING_THRESHOLD;

        return {
            valid: true,
            warning,
            daysLeft: Math.ceil(timeLeft / (24 * 60 * 60 * 1000)),
            message: warning ? `Conexión requerida en ${Math.ceil(timeLeft / (24 * 60 * 60 * 1000))} días` : 'Licencia Activa',
        };
    }

    getLicenseData() {
        const data = store.get('license');
        if (!data) return null;
        const status = this.validateLease();
        return { ...data, status };
    }

    getOwnerToken() {
        const data = store.get('license');
        return data?.owner_token || null;
    }

    /**
     * Activate a license. Calls the license-ops Edge Function which:
     *   - Validates the license_key exists and is active
     *   - Binds it to this hardware_id
     *   - Returns the gym_id, gym_name, is_master, owner_token
     */
    async activate(licenseKey) {
        const result = await callLicenseOps('activate', {
            license_key: licenseKey,
            hardware_id: this.hardwareId,
        });

        if (result._error) {
            const map = {
                license_not_found: 'Licencia no válida o no encontrada.',
                license_inactive: 'Esta licencia ha sido desactivada.',
                hardware_mismatch: 'Esta licencia ya está en uso en otro dispositivo.',
                hardware_bind_failed: 'Error al vincular la licencia al dispositivo.',
                timeout: 'Tiempo de espera agotado conectando con el servidor.',
                no_supabase_url: 'Configuración de conexión faltante.',
                credentials_not_loaded: 'Configuración de conexión faltante.',
            };
            throw new Error(map[result._error] || `Error: ${result._error}`);
        }

        const license = result.license;
        if (!license) throw new Error('Respuesta inválida del servidor de licencias.');

        const now = Date.now();
        const localData = {
            key: license.license_key,
            gym_id: license.gym_id,
            gym_name: license.gym_name,
            hardware_id: this.hardwareId,
            activated_at: new Date().toISOString(),
            is_master: !!license.is_master,
            lease_expires_at: now + this.LEASE_DURATION,
            last_known_time: now,
            // Owner-admin / owner-sync bearer. Encrypted by electron-store with
            // the hardware-bound key — extraction from a copied file fails.
            owner_token: license.owner_token || null,
            // Plan/tier + optional per-gym feature overrides (drives entitlements).
            plan: license.plan || 'pro',
            features: license.features || null,
        };

        store.set('license', localData);
        if (!license.is_master) store.set('gym_id', license.gym_id);

        return localData;
    }

    /**
     * Renew the lease if online. Refreshes owner_token from cloud on every call
     * so a cloud-side rotation propagates within one hour.
     */
    async renewLease() {
        console.log('[LicenseService] Attempting Lease Renewal...');
        const data = store.get('license');
        if (!data) return false;

        const result = await callLicenseOps('renew', {
            license_key: data.key,
            hardware_id: this.hardwareId,
        });

        if (result._error) {
            console.warn(`[LicenseService] Renewal failed: ${result._error}`);
            return false;
        }
        if (!result.active) {
            console.warn(`[LicenseService] License revoked in cloud: ${result.reason || 'unknown'}. Lease will NOT be renewed.`);
            return false;
        }

        const now = Date.now();
        data.lease_expires_at = now + this.LEASE_DURATION;
        data.last_known_time = now;
        if (result.owner_token && result.owner_token !== data.owner_token) {
            data.owner_token = result.owner_token;
            console.log('[LicenseService] 🔑 owner_token refreshed from cloud');
        }
        // Keep plan/features in sync so upgrades/downgrades from the master
        // panel apply on the next renewal (within ~10 min via the heartbeat).
        if (result.plan) data.plan = result.plan;
        if (result.features !== undefined) data.features = result.features || null;
        store.set('license', data);

        console.log('[LicenseService] Lease Renewed until:', new Date(data.lease_expires_at).toISOString());
        return true;
    }

    /**
     * Report the running app version to the cloud (telemetry).
     */
    async updateVersion(version) {
        const lic = this.getLicenseData();
        if (!lic || lic.is_master) return;
        const token = lic.owner_token;
        if (!token) return;
        const result = await callLicenseOps('reportVersion', {
            gym_id: lic.gym_id,
            version,
        }, token);
        if (result._error) {
            console.warn(`[LicenseService] Version report failed: ${result._error}`);
        }
    }

    /**
     * Deactivate the license locally (Logout).
     */
    deactivate() {
        store.delete('license');
        store.delete('gym_id');
    }
}

module.exports = new LicenseService();
