const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const licenseService = require('./license.service');
const path = require('path');
const crypto = require('crypto');
const z = require('zod');
const credentialManager = require('../../config/credentials');

// Initialize only if credentials are loaded (already init'd in main.js)
let supabase = null;
if (credentialManager.isLoaded()) {
    const creds = credentialManager.get();
    if (creds.supabase?.url && creds.supabase?.key) {
        supabase = createClient(creds.supabase.url, creds.supabase.key);
    }
}

// Validation Schemas
const createOrgSchema = z.object({
    name: z.string().min(1, "El nombre de la organización es obligatorio"),
    email: z.string().email("Correo electrónico inválido").nullable().optional(),
    templatePath: z.string().nullable().optional()
});

const updateOrgSchema = createOrgSchema.partial();

const createLicenseSchema = z.object({
    organizationId: z.string().min(1, "El ID de la organización es obligatorio"),
    monthsValidity: z.number().int().min(0).default(1),
    amount: z.number().int().min(1).max(50).default(1)
});

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
        //.eq('is_master', false)

        if (gymError) throw gymError;

        // 2. Fetch Global Counts (Graceful handling if tables are gone)
        let totalCustomers = 0;
        let totalPayments = 0;
        let totalRevenue = 0;

        try {
            const { count } = await supabase.from('cloud_customers').select('*', { count: 'exact', head: true });
            totalCustomers = count || 0;
        } catch (e) {
            console.warn('[AdminService] cloud_customers table not found or inaccessible.');
        }

        try {
            const { count } = await supabase.from('cloud_payments').select('*', { count: 'exact', head: true });
            totalPayments = count || 0;

            const { data: revenueData } = await supabase.from('cloud_payments').select('amount');
            totalRevenue = (revenueData || []).reduce((sum, p) => sum + (p.amount || 0), 0);
        } catch (e) {
            console.warn('[AdminService] cloud_payments table not found or inaccessible.');
        }

        // 3. Get Latest Version (from package.json as fallback)
        let latestVersion = '1.0.0';
        try {
            const packageJson = require('../../../../package.json');
            latestVersion = packageJson.version;
        } catch (e) {
            console.warn('[AdminService] Could not read package.json version');
        }

        return {
            totalGyms: gyms.length,
            activeGyms: gyms.filter(g => g.active).length,
            totalCustomers,
            totalPayments,
            totalRevenue,
            latestVersion,
            gyms
        };
    }

    async listGymsDetail() {
        this.checkMaster();
        if (!supabase) throw new Error('Conexión con la nube no configurada.');

        const { data: gyms, error } = await supabase
            .from('licenses')
            .select(`
                id,
                license_key,
                gym_id, 
                gym_name, 
                created_at, 
                hardware_id,
                active,
                app_version,
                expires_at
            `)
            //.eq('is_master', false) // Show all licenses including Master
            .order('created_at', { ascending: false });

        if (error) throw error;

        const gymsWithStatus = await Promise.all(gyms.map(async (gym) => {
            let lastSync = gym.created_at;
            try {
                const { data: lastPayment } = await supabase
                    .from('cloud_payments')
                    .select('created_at')
                    .eq('gym_id', gym.gym_id)
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .single();
                if (lastPayment) lastSync = lastPayment.created_at;
            } catch (e) {
                // Ignore missing table error
            }

            return {
                ...gym,
                last_sync: lastSync
            };
        }));

        return gymsWithStatus;
    }

    async deleteLicense(licenseKey) {
        this.checkMaster();
        if (!supabase) throw new Error('Conexión con la nube no configurada.');

        const { error } = await supabase
            .from('licenses')
            .delete()
            .eq('license_key', licenseKey);

        if (error) throw error;
        return { success: true };
    }



    /**
     * Creates a new Organization (Gym Tenant).
     */
    async createOrganization(name, email = null, templatePath = null) {
        const validation = createOrgSchema.safeParse({ name, email, templatePath });
        if (!validation.success) {
            throw new Error(validation.error.errors[0].message);
        }

        const validatedName = validation.data.name;
        const validatedEmail = validation.data.email;
        const validatedTemplatePath = validation.data.templatePath;

        this.checkMaster();
        if (!supabase) throw new Error('Conexión con la nube no configurada.');

        let publicUrl = null;

        // 1. Upload Template if provided
        if (validatedTemplatePath) {
            console.log('[AdminService] Uploading Organization Template:', validatedTemplatePath);
            if (!fs.existsSync(validatedTemplatePath)) throw new Error('Template file not found');

            const buffer = fs.readFileSync(validatedTemplatePath);
            const fileName = `templates/${Date.now()}_${path.basename(validatedTemplatePath).replace(/[^a-zA-Z0-9._-]/g, '')}`;

            const { error: uploadError } = await supabase.storage
                .from('org_assets')
                .upload(fileName, buffer, {
                    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    upsert: false
                });

            if (uploadError) {
                console.error('Template Upload Failed:', uploadError);
                throw new Error('Error subiendo plantilla: ' + uploadError.message);
            }

            const { data: urlData } = supabase.storage.from('org_assets').getPublicUrl(fileName);
            publicUrl = urlData.publicUrl;
            console.log('[AdminService] Template URL:', publicUrl);
        }

        // 2. Create Organization Record
        const { data, error } = await supabase
            .from('organizations')
            .insert([{
                name,
                contact_email: email,
                excel_template_url: publicUrl
            }])
            .select()
            .single();

        if (error) throw error;
        return data;
    }

    async updateOrganization(id, { name, email, templatePath }) {
        const validation = updateOrgSchema.safeParse({ name, email, templatePath });
        if (!validation.success) {
            throw new Error(validation.error.errors[0].message);
        }

        const validatedData = validation.data;
        this.checkMaster();
        if (!supabase) throw new Error('Conexión con la nube no configurada.');

        const updates = {};
        if (validatedData.name !== undefined) updates.name = validatedData.name;
        if (validatedData.email !== undefined) updates.contact_email = validatedData.email;

        // 1. Upload Template if provided (Overrides existing)
        if (validatedData.templatePath) {
            console.log('[AdminService] Uploading NEW Organization Template:', validatedData.templatePath);
            if (!fs.existsSync(validatedData.templatePath)) throw new Error('Template file not found');

            const buffer = fs.readFileSync(validatedData.templatePath);
            const fileName = `templates/${Date.now()}_${path.basename(validatedData.templatePath).replace(/[^a-zA-Z0-9._-]/g, '')}`;

            const { error: uploadError } = await supabase.storage
                .from('org_assets')
                .upload(fileName, buffer, {
                    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    upsert: false
                });

            if (uploadError) throw new Error('Error subiendo plantilla: ' + uploadError.message);

            const { data: urlData } = supabase.storage.from('org_assets').getPublicUrl(fileName);
            updates.excel_template_url = urlData.publicUrl;
        }

        const { data, error } = await supabase
            .from('organizations')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return data;
    }

    /**
     * Issues one or more new licenses for an existing Organization.
     * @param {string} organizationId
     * @param {number} monthsValidity - 0 for permanent, or number of months
     * @param {number} amount - Number of licenses to generate
     */
    async createLicense(organizationId, monthsValidity = 1, amount = 1) {
        const validation = createLicenseSchema.safeParse({ organizationId, monthsValidity, amount });
        if (!validation.success) {
            throw new Error(validation.error.errors[0].message);
        }

        const { organizationId: validatedOrgId, monthsValidity: vMonths, amount: vAmount } = validation.data;

        this.checkMaster();
        if (!supabase) throw new Error('Conexión con la nube no configurada.');

        // Verify Org exists
        const { data: org, error: orgError } = await supabase
            .from('organizations')
            .select('name')
            .eq('id', validatedOrgId)
            .single();

        if (orgError || !org) throw new Error('Organización no encontrada.');

        const licensesToInsert = [];
        let expirationDate = null;

        if (vMonths > 0) {
            const date = new Date();
            date.setMonth(date.getMonth() + vMonths);
            expirationDate = date.toISOString();
        }

        for (let i = 0; i < vAmount; i++) {
            const newKey = `GYM-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
            licensesToInsert.push({
                license_key: newKey,
                gym_id: organizationId, // Legacy: gym_id is org_id
                organization_id: organizationId,
                gym_name: org.name,
                is_master: false,
                active: true,
                app_version: '1.0.1',
                expires_at: expirationDate
            });
        }

        const { data, error } = await supabase
            .from('licenses')
            .insert(licensesToInsert)
            .select();

        if (error) throw error;
        // Return first one if amount=1, or full list
        return amount === 1 ? data[0] : data;
    }

    /**
     * Lists all Organizations.
     */
    async listOrganizations() {
        this.checkMaster();
        if (!supabase) throw new Error('Conexión con la nube no configurada.');

        const { data, error } = await supabase
            .from('organizations')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data;
    }

    // Legacy wrapper for compatibility if needed, or remove if unused in frontend
    async generateNewLicense(gymName) {
        // Deprecated: Auto-creates org + license
        const org = await this.createOrganization(gymName);
        return this.createLicense(org.id);
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

        let token = null;
        if (credentialManager.isLoaded()) {
            token = credentialManager.get().github?.token;
        }

        if (!token) {
            console.warn('[AdminService] GH_TOKEN no configurado. Releases desactivadas.');
            return []; // Return empty list instead of crashing
        }

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
            .list(`${gymId}/sys_backups`, {
                limit: 100,
                offset: 0,
                sortBy: { column: 'name', order: 'desc' }
            });

        console.log(`[AdminService] Searching backups in: training_files/${gymId}/sys_backups`);
        if (error) {
            console.error('[AdminService] ❌ ERROR LISTING BACKUPS (Check RLS/Permissions):', error);
            throw error;
        }
        console.log(`[AdminService] ✅ Found ${data?.length || 0} files. (Data: ${JSON.stringify(data)})`);

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
    async restoreRemoteBackup(gymId, backupFileName) {
        this.checkMaster();
        console.log(`🚀 [AdminService] RESTORING BACKUP for Gym: ${gymId} File: ${backupFileName}`);

        if (!gymId || !backupFileName) throw new Error('Parámetros inválidos');
        if (!supabase) throw new Error('Conexión con la nube no configurada.');

        const sourcePath = `${gymId}/sys_backups/${backupFileName}`;
        const targetPath = `${gymId}/remote_load/gym_manager.db`;

        // 1. Restore Database
        console.log('[AdminService] Restoring Database file...');
        const { data: dbData, error: dbError } = await supabase.storage.from('training_files').download(sourcePath);
        if (dbError) throw new Error('Error descargando DB: ' + dbError.message);

        const { error: uploadError } = await supabase.storage.from('training_files').upload(targetPath, dbData, { contentType: 'application/x-sqlite3', upsert: true });
        if (uploadError) throw new Error('Error subiendo DB a remote_load: ' + uploadError.message);

        // 2. Identify and Restore Companion Files (Templates)
        // Format: {TIMESTAMP}_gym_manager.db -> {TIMESTAMP}_template_config.json
        const timestampPrefix = backupFileName.replace('_gym_manager.db', '');

        const filesToRestore = [
            { suffix: '_template_config.json', target: 'template_config.json', type: 'application/json' },
            { suffix: '_org_template.xlsx', target: 'org_template.xlsx', type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }
        ];

        for (const fileDef of filesToRestore) {
            const companionName = `${timestampPrefix}${fileDef.suffix}`;
            const companionSource = `${gymId}/sys_backups/${companionName}`;
            const companionTarget = `${gymId}/remote_load/${fileDef.target}`;

            console.log(`[AdminService] Checking companion file: ${companionName}`);

            // Check existence first via list (to avoid download errors on missing legacy files)
            const { data: exists } = await supabase.storage.from('training_files').list(`${gymId}/sys_backups`, { search: companionName });

            if (exists && exists.length > 0) {
                console.log(`[AdminService] Restoring companion: ${companionName}`);
                const { data: fileData } = await supabase.storage.from('training_files').download(companionSource);
                if (fileData) {
                    await supabase.storage.from('training_files').upload(companionTarget, fileData, { contentType: fileDef.type, upsert: true });
                }
            } else {
                console.log(`[AdminService] Companion ${companionName} not found (Legacy backup?). Skipping.`);
            }
        }

        // 3. Register in DB (Triggers Client)
        const { error: logError } = await supabase
            .from('cloud_remote_loads')
            .insert([{
                gym_id: gymId,
                status: 'pending',
                created_at: new Date().toISOString()
            }]);

        if (logError) console.warn('[AdminService] Warning: Could not log to cloud_remote_loads', logError);

        return { success: true };
    }
}


module.exports = new AdminService();
