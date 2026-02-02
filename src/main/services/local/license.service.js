const Store = require('electron-store');
const { machineIdSync } = require('node-machine-id');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../../../.env') });

// Encrypted store for license data
// SECURITY: We bind the encryption key to the machine ID.
// If someone copies the config file to another PC, decryption will fail because the key will be different.
let store;
try {
    const hwId = machineIdSync();
    console.log('[LicenseService] Hardware ID:', hwId);
    store = new Store({
        name: 'license_data',
        encryptionKey: `gym-manager-pro-${hwId}`, // Dynamic Key = Strong Anti-Piracy
        clearInvalidConfig: true // If decryption fails (copied file), reset it.
    });
    console.log('[LicenseService] Store initialized with encrypted key.');
} catch (e) {
    console.error('[LicenseService] Store init failed, using fallback:', e);
    // Fallback if machineId fails (rare) or store is corrupt
    store = new Store({ name: 'license_data', clearInvalidConfig: true });
}

// Initialize Supabase only if env vars are present (to avoid crashes during build/test)
let supabase = null;
if (process.env.SUPABASE_URL && process.env.SUPABASE_KEY) {
    supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
}

class LicenseService {
    constructor() {
        this.hardwareId = machineIdSync();
        this.LEASE_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 Days
        this.WARNING_THRESHOLD = 3 * 24 * 60 * 60 * 1000; // 3 Days
    }

    /**
     * Checks if the current machine has a valid, stored license AND valid lease.
     * @returns {boolean}
     */
    isAuthenticated() {
        const status = this.validateLease();
        if (!status.valid) {
            console.warn(`[LicenseService] Auth Failed: ${status.reason}`);
            return false;
        }
        return true;
    }

    /**
     * Core validation logic: Checks Data Integrity, Time Tampering, and Lease Expiry.
     */
    validateLease() {
        const data = store.get('license');
        if (!data) return { valid: false, reason: 'NO_LICENSE' };

        // 1. Hardware Binding
        if (data.hardware_id !== this.hardwareId) {
            return { valid: false, reason: 'HARDWARE_MISMATCH' };
        }

        const now = Date.now();

        // 2. Anti-Time-Travel (Clock Rewind Protection)
        // If the current time is SIGNIFICANTLY in the past compared to last usage.
        // We allow 10 minutes of drift for legitimate clock syncs.
        if (data.last_known_time && now < (data.last_known_time - 10 * 60 * 1000)) {
            return { valid: false, reason: 'SYSTEM_CLOCK_TAMPERED' };
        }

        // Update Monotonic Time (Only moves forward)
        // We optimize writes: only write if diff > 1 hour to save IO, or if it's a critical action
        if (!data.last_known_time || now > data.last_known_time) {
            // We don't save immediately here to avoid IO spam, usually handled by other ops
            // But if it's the first time or check, we might assume it persists on 'renew' or 'activate'
            // For strictness, let's update in memory but persist only periodically or on specific events?
            // For now, let's persist it to ensure safety.
            // optimization: only update store if hour changed
            const last = data.last_known_time || 0;
            if (now - last > 60 * 60 * 1000) {
                data.last_known_time = now;
                store.set('license', data);
            }
        }

        // 3. Lease Expiry
        if (data.lease_expires_at && now > data.lease_expires_at) {
            return { valid: false, reason: 'LEASE_EXPIRED' };
        }

        // 4. Warning Check
        const timeLeft = (data.lease_expires_at || 0) - now;
        const warning = timeLeft < this.WARNING_THRESHOLD;

        return {
            valid: true,
            warning,
            daysLeft: Math.ceil(timeLeft / (24 * 60 * 60 * 1000)),
            message: warning ? `Conexión requerida en ${Math.ceil(timeLeft / (24 * 60 * 60 * 1000))} días` : 'Licencia Activa'
        };
    }

    getLicenseData() {
        const data = store.get('license');
        if (!data) return null;

        // Enrich with lease status
        const status = this.validateLease();
        return { ...data, status };
    }

    /**
     * Validates and activates a license key.
     * @param {string} licenseKey 
     * @returns {Promise<object>} License data on success
     * @throws {Error} Human-readable error message
     */
    async activate(licenseKey) {
        if (!supabase) throw new Error('Error de conexión con el servidor de licencias.');

        try {
            // 1. Check if license exists
            const { data: license, error } = await supabase
                .from('licenses')
                .select('*')
                .eq('license_key', licenseKey)
                .single();

            if (error || !license) {
                throw new Error('Licencia no válida o no encontrada.');
            }

            if (!license.active) {
                throw new Error('Esta licencia ha sido desactivada.');
            }

            // 2. Hardware Binding Logic
            if (license.hardware_id) {
                if (license.hardware_id !== this.hardwareId) {
                    throw new Error('Esta licencia ya está en uso en otro dispositivo.');
                }
            } else {
                const { error: updateError } = await supabase
                    .from('licenses')
                    .update({ hardware_id: this.hardwareId })
                    .eq('id', license.id);

                if (updateError) {
                    throw new Error('Error al vincular la licencia al dispositivo.');
                }
            }

            // 3. Store locally (Encrypted)
            const now = Date.now();
            const localData = {
                key: license.license_key,
                gym_id: license.gym_id,
                gym_name: license.gym_name,
                hardware_id: this.hardwareId,
                activated_at: new Date().toISOString(),
                is_master: !!license.is_master,
                // NEW: Security Fields
                lease_expires_at: now + this.LEASE_DURATION,
                last_known_time: now
            };

            store.set('license', localData);

            if (!license.is_master) {
                store.set('gym_id', license.gym_id);
            }

            return localData;

        } catch (error) {
            console.error('Activation Error:', error);
            throw error;
        }
    }

    /**
     * Attempts to renew the lease if online.
     * Silent operation - does not throw usually.
     */
    async renewLease() {
        console.log('[LicenseService] Attempting Lease Renewal...');
        const data = store.get('license');
        if (!data || !supabase) return false;

        try {
            // 1. Verify Status in Cloud
            const { data: cloudLic, error } = await supabase
                .from('licenses')
                .select('active')
                .eq('license_key', data.key)
                .single();

            if (error || !cloudLic) return false;

            // 2. If blocked in cloud, do NOT renew (let it expire locally)
            if (!cloudLic.active) {
                console.warn('[LicenseService] License revoked in cloud. Lease will NOT be renewed.');
                return false;
            }

            // 3. Renew!
            const now = Date.now();
            data.lease_expires_at = now + this.LEASE_DURATION;
            data.last_known_time = now;
            store.set('license', data);

            console.log('[LicenseService] Lease Renewed until:', new Date(data.lease_expires_at));
            return true;

        } catch (err) {
            console.error('[LicenseService] Lease renewal failed:', err);
            return false;
        }
    }

    /**
     * Updates the reported version in the cloud.
     */
    async updateVersion(version) {
        if (!supabase) return;
        const lic = this.getLicenseData();
        if (!lic || lic.is_master) return;

        try {
            await supabase
                .from('licenses')
                .update({ app_version: version })
                .eq('gym_id', lic.gym_id);
        } catch (e) {
            console.error('[LicenseService] Version report failed:', e);
        }
    }

    /**
     * Deactivates the license locally (Logout)
     */
    deactivate() {
        store.delete('license');
        store.delete('gym_id');
    }
}

module.exports = new LicenseService();
