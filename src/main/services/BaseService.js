/**
 * Base Service Class
 * Provides common functionality for all services
 *
 * FIX: Created to eliminate duplication of getGymId() across 13 services
 */

class BaseService {
    /**
     * Get current gym ID from license service
     * Returns 'LOCAL_DEV' if no license is configured
     *
     * This method was duplicated across 13 services before refactoring
     */
    getGymId() {
        try {
            const licenseService = require('./local/license.service');
            const data = licenseService.getLicenseData();
            return data ? data.gym_id : 'LOCAL_DEV';
        } catch (e) {
            return 'LOCAL_DEV';
        }
    }

    /**
     * Parse local date without timezone issues
     * FIX: Prevents timezone shifting when parsing YYYY-MM-DD strings
     *
     * @param {string} dateString - Date in format YYYY-MM-DD
     * @returns {Date} Date object without timezone offset
     */
    parseLocalDate(dateString) {
        if (!dateString) return null;

        const [year, month, day] = dateString.split('-').map(Number);
        if (!year || !month || !day) return null;

        return new Date(year, month - 1, day);
    }

    /**
     * Format date to YYYY-MM-DD without timezone
     *
     * @param {Date} date - Date object
     * @returns {string} Date string in YYYY-MM-DD format
     */
    formatDateLocal(date) {
        if (!(date instanceof Date) || isNaN(date.getTime())) {
            return null;
        }

        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');

        return `${year}-${month}-${day}`;
    }
}

module.exports = BaseService;
