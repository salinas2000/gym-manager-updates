const { createClient } = require('@supabase/supabase-js');
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
        const { data, error } = await supabase
            .from('global_notifications')
            .select('*')
            .eq('active', true)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (error && error.code !== 'PGRST116') console.error('Error fetching broadcast:', error);
        return data;
    }

    async updateGlobalBroadcast(notification) {
        this.checkMaster();
        if (!supabase) throw new Error('Conexión con la nube no configurada.');

        // Deactivate old notifications
        await supabase.from('global_notifications').update({ active: false }).eq('active', true);

        // If active is false, we just stop here (effectively cleared)
        if (notification.active === false) return { success: true };

        // Insert new one
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
}


module.exports = new AdminService();
