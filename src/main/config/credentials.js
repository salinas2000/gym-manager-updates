/**
 * Credential Management System
 *
 * Security Priority:
 * 1. System environment variables (most secure)
 * 2. User-configured .env.local file (git-ignored)
 * 3. Electron Store encrypted storage (fallback)
 *
 * NEVER commit credentials to git.
 */

const fs = require('fs');
const path = require('path');
const { app } = require('electron');

class CredentialManager {
    constructor() {
        this.credentials = null;
        this.configPath = null;
    }

    /**
     * Initialize and load credentials from available sources
     */
    init() {
        console.log('[CREDENTIALS] Initializing secure credential manager...');

        // Try loading from system environment first (most secure)
        const systemCreds = this.loadFromSystemEnv();
        if (this.isComplete(systemCreds)) {
            console.log('[CREDENTIALS] ✅ Loaded from SYSTEM ENVIRONMENT (most secure)');
            this.credentials = systemCreds;
            return true;
        }

        // Try loading from .env.local (git-ignored, user-configured)
        const localCreds = this.loadFromLocalEnv();
        if (this.isComplete(localCreds)) {
            console.log('[CREDENTIALS] ✅ Loaded from .env.local (secure)');
            this.credentials = localCreds;
            return true;
        }

        // Try loading from electron-store (encrypted storage)
        const storedCreds = this.loadFromStore();
        if (this.isComplete(storedCreds)) {
            console.log('[CREDENTIALS] ✅ Loaded from encrypted store');
            this.credentials = storedCreds;
            return true;
        }

        console.warn('[CREDENTIALS] ⚠️ No valid credentials found');
        console.warn('[CREDENTIALS] App will prompt user for configuration');
        return false;
    }

    /**
     * Load from system environment variables (Windows/Mac/Linux)
     */
    loadFromSystemEnv() {
        return {
            supabase: {
                url: process.env.GYM_SUPABASE_URL,
                key: process.env.GYM_SUPABASE_KEY
            },
            google: {
                clientId: process.env.GYM_GOOGLE_CLIENT_ID,
                clientSecret: process.env.GYM_GOOGLE_CLIENT_SECRET,
                projectId: process.env.GYM_GOOGLE_PROJECT_ID
            },
            github: {
                token: process.env.GYM_GITHUB_TOKEN
            }
        };
    }

    /**
     * Load from .env.local file (git-ignored)
     */
    loadFromLocalEnv() {
        try {
            // In development: project root
            // In production: userData directory
            let envPath;

            if (app.isPackaged) {
                // Production: Look in userData
                envPath = path.join(app.getPath('userData'), '.env.local');
            } else {
                // Development: Look in project root
                envPath = path.join(__dirname, '../../../.env.local');
            }

            if (!fs.existsSync(envPath)) {
                console.log('[CREDENTIALS] .env.local not found at:', envPath);
                return {};
            }

            console.log('[CREDENTIALS] Reading .env.local from:', envPath);
            const content = fs.readFileSync(envPath, 'utf-8');
            const parsed = this.parseEnvFile(content);

            return {
                supabase: {
                    url: parsed.SUPABASE_URL || parsed.GYM_SUPABASE_URL,
                    key: parsed.SUPABASE_KEY || parsed.GYM_SUPABASE_KEY
                },
                google: {
                    clientId: parsed.GOOGLE_CLIENT_ID || parsed.GYM_GOOGLE_CLIENT_ID,
                    clientSecret: parsed.GOOGLE_CLIENT_SECRET || parsed.GYM_GOOGLE_CLIENT_SECRET,
                    projectId: parsed.GOOGLE_PROJECT_ID || parsed.GYM_GOOGLE_PROJECT_ID
                },
                github: {
                    token: parsed.GH_TOKEN || parsed.GYM_GITHUB_TOKEN
                }
            };
        } catch (error) {
            console.error('[CREDENTIALS] Error reading .env.local:', error.message);
            return {};
        }
    }

    /**
     * Load from encrypted electron-store
     */
    loadFromStore() {
        try {
            const Store = require('electron-store');
            const store = new Store({
                name: 'credentials',
                encryptionKey: 'gym-manager-pro-secure-key' // In production, use machine-id
            });

            const creds = store.get('credentials');
            return creds || {};
        } catch (error) {
            console.error('[CREDENTIALS] Error reading from store:', error.message);
            return {};
        }
    }

    /**
     * Save credentials to encrypted store
     */
    saveToStore(credentials) {
        try {
            const Store = require('electron-store');
            const store = new Store({
                name: 'credentials',
                encryptionKey: 'gym-manager-pro-secure-key'
            });

            store.set('credentials', credentials);
            this.credentials = credentials;
            console.log('[CREDENTIALS] ✅ Saved to encrypted store');
            return true;
        } catch (error) {
            console.error('[CREDENTIALS] Failed to save to store:', error);
            return false;
        }
    }

    /**
     * Parse .env file content
     */
    parseEnvFile(content) {
        const result = {};
        const lines = content.split('\n');

        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) continue;

            const [key, ...valueParts] = trimmed.split('=');
            if (key && valueParts.length > 0) {
                result[key.trim()] = valueParts.join('=').trim();
            }
        }

        return result;
    }

    /**
     * Check if credentials object is complete
     */
    isComplete(creds) {
        if (!creds) return false;

        // FIX: Use !! to ensure boolean return value
        // Without !!, this would return the last truthy value (the key string) instead of true
        const hasSupabase = !!(creds.supabase?.url && creds.supabase?.key);
        const hasGoogle = !!(creds.google?.clientId && creds.google?.clientSecret);
        const hasGitHub = !!creds.github?.token;

        // Supabase is required, others are optional
        return hasSupabase;
    }

    /**
     * Get credentials (safe accessor)
     */
    get() {
        if (!this.credentials) {
            throw new Error('Credentials not initialized. Call init() first.');
        }
        return this.credentials;
    }

    /**
     * Check if credentials are loaded
     */
    isLoaded() {
        return this.credentials !== null && this.isComplete(this.credentials);
    }

    /**
     * Create template .env.local file for user
     */
    createTemplate() {
        const templatePath = app.isPackaged
            ? path.join(app.getPath('userData'), '.env.local.template')
            : path.join(__dirname, '../../../.env.local.template');

        const template = `# Gym Manager Pro - Secure Credentials
#
# INSTRUCCIONES:
# 1. Renombra este archivo a '.env.local' (quita el .template)
# 2. Completa los valores con tus credenciales reales
# 3. NUNCA subas este archivo a git
#
# Alternativamente, puedes configurar estas variables en tu sistema operativo
# con el prefijo GYM_ (ejemplo: GYM_SUPABASE_URL)

# ===== SUPABASE (REQUERIDO) =====
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_KEY=tu_supabase_publishable_key_aqui

# ===== GOOGLE OAUTH (OPCIONAL - Solo si usas Drive) =====
GOOGLE_CLIENT_ID=tu-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=tu-client-secret
GOOGLE_PROJECT_ID=tu-project-id

# ===== GITHUB (OPCIONAL - Solo para updates automáticos) =====
GH_TOKEN=ghp_tu_token_aqui
`;

        try {
            fs.writeFileSync(templatePath, template);
            console.log('[CREDENTIALS] ✅ Template created at:', templatePath);
            return templatePath;
        } catch (error) {
            console.error('[CREDENTIALS] Failed to create template:', error);
            return null;
        }
    }

    /**
     * Get configuration instructions for user
     */
    getInstructions() {
        const userDataPath = app.getPath('userData');

        return {
            title: 'Configuración de Credenciales',
            message: 'La aplicación necesita credenciales para funcionar correctamente.',
            options: [
                {
                    method: 'Sistema (Recomendado)',
                    description: 'Configura variables de entorno en tu sistema operativo',
                    variables: [
                        'GYM_SUPABASE_URL',
                        'GYM_SUPABASE_KEY',
                        'GYM_GOOGLE_CLIENT_ID (opcional)',
                        'GYM_GOOGLE_CLIENT_SECRET (opcional)',
                        'GYM_GITHUB_TOKEN (opcional)'
                    ],
                    platform: {
                        windows: 'Panel de Control > Sistema > Variables de entorno',
                        mac: 'Edita ~/.zshrc o ~/.bash_profile',
                        linux: 'Edita ~/.bashrc o /etc/environment'
                    }
                },
                {
                    method: 'Archivo Local',
                    description: `Crea un archivo .env.local en: ${userDataPath}`,
                    action: 'create_template'
                },
                {
                    method: 'Configuración Manual',
                    description: 'Ingresa las credenciales en la aplicación (se guardan encriptadas)',
                    action: 'manual_input'
                }
            ]
        };
    }
}

// Singleton instance
const credentialManager = new CredentialManager();

module.exports = credentialManager;
