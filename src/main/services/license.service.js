const Store = require('electron-store');
const { machineIdSync } = require('node-machine-id');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

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
    }

    /**
     * Checks if the current machine has a valid, stored license.
     * @returns {boolean}
     */
    isAuthenticated() {
        const licenseData = store.get('license');
        console.log('[LicenseService] Checking auth. Found data:', licenseData ? 'YES' : 'NO');
        if (licenseData) {
            console.log('[LicenseService] License Key:', licenseData.key);
            console.log('[LicenseService] Stored HW ID:', licenseData.hardware_id);
            console.log('[LicenseService] Current HW ID:', this.hardwareId);
        }

        if (!licenseData) return false;

        // Anti-tamper check: Ensure stored hardware ID matches current machine
        if (licenseData.hardware_id !== this.hardwareId) {
            console.warn('⚠️ License Hardware ID mismatch! Possible piracy attempt.');
            return false;
        }

        return true;
    }

    getLicenseData() {
        return store.get('license');
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

            if (license.expires_at && new Date(license.expires_at) < new Date()) {
                throw new Error('Esta licencia ha expirado.');
            }

            // 2. Hardware Binding Logic
            if (license.hardware_id) {
                // License is already bound to a machine
                if (license.hardware_id !== this.hardwareId) {
                    throw new Error('Esta licencia ya está en uso en otro dispositivo.');
                }
            } else {
                // First activation: Bind to this machine
                const { error: updateError } = await supabase
                    .from('licenses')
                    .update({ hardware_id: this.hardwareId })
                    .eq('id', license.id);

                if (updateError) {
                    throw new Error('Error al vincular la licencia al dispositivo.');
                }
            }

            // 3. Store locally (Encrypted)
            const localData = {
                key: license.license_key,
                gym_id: license.gym_id,
                gym_name: license.gym_name,
                hardware_id: this.hardwareId, // Store current ID to verify later
                activated_at: new Date().toISOString(),
                is_master: !!license.is_master // Persist master status
            };

            store.set('license', localData);

            // Also store gym_id globally for other services (unless master)
            if (!license.is_master) {
                store.set('gym_id', license.gym_id);
            }

            return localData;

        } catch (error) {
            console.error('Activation Error:', error);
            throw error; // Propagate meaningful error
        }
    }

    /**
     * Updates the reported version in the cloud.
     */
    async updateVersion(version) {
        if (!supabase) return;
        const lic = this.getLicenseData();
        if (!lic || lic.is_master) return; // Don't report admin versions

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
