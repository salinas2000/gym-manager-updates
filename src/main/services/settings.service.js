const dbManager = require('../db/database');

class SettingsService {
    get db() {
        return dbManager.getInstance();
    }

    getAll() {
        // Returns object { key: value }
        const rows = this.db.prepare('SELECT key, value FROM settings').all();
        const settings = {};
        rows.forEach(row => {
            settings[row.key] = row.value;
        });
        return settings;
    }

    get(key, defaultValue = null) {
        const row = this.db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
        return row ? row.value : defaultValue;
    }

    set(key, value) {
        console.log('[SettingsService] set:', key, value);
        const stmt = this.db.prepare(`
            INSERT INTO settings (key, value, updated_at) 
            VALUES (?, ?, datetime('now'))
            ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
        `);
        stmt.run(key, value);
        return { key, value };
    }

    // Bulk update
    updateSettings(settingsObj) {
        const update = this.db.transaction((obj) => {
            for (const [key, value] of Object.entries(obj)) {
                this.set(key, value);
            }
        });
        update(settingsObj);
        return this.getAll();
    }

    // Security
    async verifyPassword(inputPassword) {
        // GLOBAL MASTER PASSWORD (For Installer/Creator)
        // Hardcoded to ensure only the creator can change identity settings
        const MASTER_PASSWORD = 'admin';

        return inputPassword === MASTER_PASSWORD;
    }

    setActivation(key) {
        // Here you could call an external API to validate the key
        // For now, we simulate success if key is not empty
        if (!key || key.length < 5) throw new Error('Licencia inválida');

        this.set('license_key', key);
        this.set('is_activated', 'true');
        return true;
    }
}

module.exports = new SettingsService();
