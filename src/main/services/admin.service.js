const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const licenseService = require('./license.service');
const path = require('path');
const crypto = require('crypto');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

let supabase = null;
if (process.env.SUPABASE_URL && process.env.SUPABASE_KEY) {
    supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
}

class AdminService {
    /**
     * Helper to ensure only Master can call these methods.
     */
    checkMaster() {
        const data = licenseService.getLicenseData();
        if (!data || !data.is_master) {
            throw new Error('Acceso denegado: Se requiere licencia Master.');
        }
    }

    async getGlobalStats() {
        this.checkMaster();
        if (!supabase) throw new Error('Conexión con la nube no configurada.');

        // 1. Fetch Overview of all licenses
        const { data: gyms, error: gymError } = await supabase
            .from('licenses')
            .select('gym_id, gym_name, created_at, active')
            .eq('is_master', false);

        if (gymError) throw gymError;

        // 2. Fetch Global Counts
        const { count: totalCustomers } = await supabase.from('cloud_customers').select('*', { count: 'exact', head: true });
        const { count: totalPayments } = await supabase.from('cloud_payments').select('*', { count: 'exact', head: true });

        // 3. Aggregate Revenue (Using Supabase RPC or direct sum if data is small enough)
        // For robustness, let's fetch the sum directly
        const { data: revenueData, error: revError } = await supabase
            .from('cloud_payments')
            .select('amount');

        const totalRevenue = (revenueData || []).reduce((sum, p) => sum + (p.amount || 0), 0);

        return {
            totalGyms: gyms.length,
            totalCustomers: totalCustomers || 0,
            totalPayments: totalPayments || 0,
            totalRevenue: totalRevenue || 0,
            gyms
        };
    }

    async listGymsDetail() {
        this.checkMaster();
        if (!supabase) throw new Error('Conexión con la nube no configurada.');

        const { data: gyms, error } = await supabase
            .from('licenses')
            .select(`
                gym_id, 
                gym_name, 
                created_at, 
                hardware_id,
                active,
                app_version
            `)
            .eq('is_master', false)
            .order('created_at', { ascending: false });

        if (error) throw error;

        const gymsWithStatus = await Promise.all(gyms.map(async (gym) => {
            const { data: lastPayment } = await supabase
                .from('cloud_payments')
                .select('created_at')
                .eq('gym_id', gym.gym_id)
                .order('created_at', { ascending: false })
                .limit(1)
                .single();

            return {
                ...gym,
                last_sync: lastPayment ? lastPayment.created_at : gym.created_at
            };
        }));

        return gymsWithStatus;
    }

    async getGlobalBroadcast() {
        // No checkMaster here because regular clients need to read it too
        if (!supabase) return null;

        // Fetch the LATEST notification, regardless of "active"
        const { data, error } = await supabase
            .from('global_notifications')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (error && error.code !== 'PGRST116') console.error('Error fetching broadcast:', error);
        return data;
    }

    async updateGlobalBroadcast(notification) {
        this.checkMaster();
        if (!supabase) throw new Error('Conexión con la nube no configurada.');

        // Simply insert the new notification. We don't care about "active" state anymore.
        const { data, error } = await supabase
            .from('global_notifications')
            .insert([{
                message: notification.message,
                type: notification.type || 'info',
                active: true
            }])
            .select()
            .single();

        if (error) throw error;
        return data;
    }

    async generateNewLicense(gymName) {
        this.checkMaster();
        if (!supabase) throw new Error('Conexión con la nube no configurada.');

        const newKey = `GYM-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
        const newGymId = crypto.randomUUID();

        const { data, error } = await supabase
            .from('licenses')
            .insert([{
                license_key: newKey,
                gym_id: newGymId,
                gym_name: gymName,
                is_master: false,
                active: true,
                app_version: '1.0.1'
            }])
            .select()
            .single();

        if (error) throw error;
        return data;
    }

    async revokeLicense(gymId) {
        this.checkMaster();
        if (!supabase) throw new Error('Conexión con la nube no configurada.');

        const { error } = await supabase
            .from('licenses')
            .update({ active: false })
            .eq('gym_id', gymId);

        if (error) throw error;
        return { success: true };
    }

    async unbindHardware(gymId) {
        this.checkMaster();
        if (!supabase) throw new Error('Conexión con la nube no configurada.');

        const { error } = await supabase
            .from('licenses')
            .update({ hardware_id: null })
            .eq('gym_id', gymId);

        if (error) throw error;
        return { success: true };
    }

    async getGitHubReleases() {
        this.checkMaster();
        const token = process.env.GH_TOKEN;
        if (!token) throw new Error('GH_TOKEN no configurado en el servidor.');

        // Extract owner and repo from package.json or hardcoded
        const owner = 'salinas2000';
        const repo = 'gym-manager-updates';

        try {
            const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/releases`, {
                headers: {
                    'Authorization': `token ${token}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'User-Agent': 'Gym-Manager-Pro-Admin'
                }
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.message || 'Error al conectar con GitHub');
            }

            const releases = await response.json();
            return releases.map(r => ({
                version: r.tag_name.replace('v', ''),
                name: r.name,
                date: r.published_at,
                url: r.html_url,
                is_draft: r.draft,
                is_prerelease: r.prerelease,
                body: r.body
            }));
        } catch (error) {
            console.error('[AdminService] GitHub fetch failed:', error);
            throw error;
        }
    }

    async listGymBackups(gymId) {
        this.checkMaster();
        if (!supabase) throw new Error('Conexión con la nube no configurada.');

        const { data, error } = await supabase
            .storage
            .from('training_files')
            .list(`${gymId}/sys_backups/`, {
                limit: 100,
                offset: 0,
                sortBy: { column: 'name', order: 'desc' }
            });

        if (error) {
            console.error('[AdminService] listGymBackups failed:', error);
            throw error;
        }

        return data.map(file => ({
            name: file.name,
            size: file.metadata?.size,
            created_at: file.created_at,
            path: `${gymId}/sys_backups/${file.name}`
        }));
    }

    async getRemotePushStatus(gymId) {
        this.checkMaster();
        if (!supabase) throw new Error('Conexión con la nube no configurada.');

        const { data, error } = await supabase
            .storage
            .from('training_files')
            .list(`${gymId}/remote_load/`);

        if (error) return { hasPush: false };

        const hasPush = data && data.some(file => file.name === 'gym_manager.db');
        const file = hasPush ? data.find(f => f.name === 'gym_manager.db') : null;

        return {
            hasPush,
            lastPush: file ? file.created_at : null,
            size: file ? file.metadata?.size : 0
        };
    }

    async pushRemoteDatabase(gymId, localPath) {
        this.checkMaster();
        console.log(`🚀 [AdminService] STARTING PUSH for Gym: ${gymId} from ${localPath}`);

        if (!gymId) throw new Error('gymId es requerido');
        if (!localPath) throw new Error('localPath es requerido');

        if (!supabase) throw new Error('Conexión con la nube no configurada.');

        if (!fs.existsSync(localPath)) {
            console.error('[AdminService] File not found at:', localPath);
            throw new Error(`El archivo local no existe: ${localPath}`);
        }

        const fileBuffer = fs.readFileSync(localPath);
        const fileName = `${gymId}/remote_load/gym_manager.db`;
        console.log('[AdminService] Uploading to:', fileName);
        const { error: uploadError } = await supabase
            .storage
            .from('training_files')
            .upload(fileName, fileBuffer, {
                contentType: 'application/x-sqlite3',
                upsert: true
            });

        if (uploadError) throw uploadError;

        console.log('[AdminService] Upload successful for gym:', gymId);

        // 2. Register the push in the tracking table
        const { error: dbError } = await supabase
            .from('cloud_remote_loads')
            .insert([{
                gym_id: gymId,
                status: 'pending',
                created_at: new Date().toISOString()
            }]);

        if (dbError) {
            console.error('[AdminService] Error logging push to DB:', dbError);
            // We don't throw here to not break the success, but it's a warning
        }

        return { success: true, path: fileName };
    }

    async getPushHistory(gymId) {
        this.checkMaster();
        if (!supabase) throw new Error('Conexión con la nube no configurada.');

        const { data, error } = await supabase
            .from('cloud_remote_loads')
            .select('*')
            .eq('gym_id', gymId)
            .order('created_at', { ascending: false })
            .limit(10);

        if (error) throw error;
        return data;
    }
}


module.exports = new AdminService();
