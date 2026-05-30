import React, { createContext, useContext, useState, useEffect } from 'react';
import { useToast } from './ToastContext';

const NotificationContext = createContext();

export function NotificationProvider({ children }) {
    const [notifications, setNotifications] = useState([]);
    const [isDrawerOpen, setDrawerOpen] = useState(false);
    const { addToast } = useToast();

    useEffect(() => {
        // Listen for updater events from main process
        if (window.api?.on) {
            const cleanupStatus = window.api.on('updater:status', (statusData) => {
                handleUpdaterStatus(statusData);
            });

            const cleanupRemote = window.api.on('cloud:remote-load-pending', (data) => {
                console.log('🔔 [NotificationContext] Remote load signal received:', data);

                // 1. Show immediate Toast (User requested "automatic detection")
                if (addToast) addToast('Nueva versión de datos disponible. Abre notificaciones.', 'info', 6000);

                // 2. Add Persistent Notification with Action
                addNotification({
                    id: 'remote-load-pending',
                    type: 'update',
                    title: 'Actualización de Base de Datos',
                    message: 'El administrador ha enviado una versión recomendada de la base de datos.',
                    priority: 'high',
                    actionLabel: 'CARGAR AHORA',
                    onAction: async () => {
                        try {
                            const res = await window.api.cloud.applyRemoteLoad({
                                gym_id: data.gym_id,
                                load_id: data.load_id
                            });
                            if (res.success) {
                                addNotification({ id: 'apply-success', type: 'success', message: 'Base de Datos actualizada. Reiniciando...' });
                                setTimeout(() => window.location.reload(), 2000);
                            }
                        } catch (e) {
                            addNotification({ id: 'apply-error', type: 'error', message: 'Error al aplicar carga: ' + e.message });
                        }
                    }
                });
            });

            // --- Exercise Dataset Push (Phase 2) ---
            const cleanupExerciseDataset = window.api.cloud?.onExerciseDatasetPending?.((data) => {
                if (addToast) addToast('Te han enviado un dataset de ejercicios. Abre notificaciones.', 'info', 6000);
                addNotification({
                    id: `exercise-dataset-${data.load_id}`,
                    type: 'update',
                    title: 'Dataset de Ejercicios Recibido',
                    message: 'El administrador ha enviado un dataset de ejercicios. Se añadirán a tu biblioteca sin sobrescribir los existentes.',
                    priority: 'high',
                    actionLabel: 'CARGAR EJERCICIOS',
                    onAction: async () => {
                        try {
                            const stats = await window.api.cloud.applyExerciseDataset({
                                gym_id: data.gym_id,
                                load_id: data.load_id,
                                payload_path: data.payload_path,
                            });
                            const result = stats?.success ? stats.data : stats;
                            addNotification({
                                id: `exercise-dataset-applied-${data.load_id}`,
                                type: 'success',
                                message: `${result?.exercisesNew || 0} ejercicios nuevos añadidos, ${result?.exercisesSkipped || 0} ya existían.`,
                            });
                        } catch (e) {
                            addNotification({ id: `exercise-dataset-error-${data.load_id}`, type: 'error', message: 'Error al cargar dataset: ' + e.message });
                        }
                    }
                });
            });

            // --- Customer Dataset Push (Phase 2) ---
            const cleanupCustomerDataset = window.api.cloud?.onCustomerDatasetPending?.((data) => {
                if (addToast) addToast('Te han enviado un dataset de clientes. Abre notificaciones.', 'info', 6000);
                addNotification({
                    id: `customer-dataset-${data.load_id}`,
                    type: 'update',
                    title: 'Dataset de Clientes Recibido',
                    message: 'El administrador ha enviado un dataset de clientes. Se añadirán los nuevos respetando los emails existentes.',
                    priority: 'high',
                    actionLabel: 'CARGAR CLIENTES',
                    onAction: async () => {
                        try {
                            const stats = await window.api.cloud.applyCustomerDataset({
                                gym_id: data.gym_id,
                                load_id: data.load_id,
                                payload_path: data.payload_path,
                            });
                            const result = stats?.success ? stats.data : stats;
                            addNotification({
                                id: `customer-dataset-applied-${data.load_id}`,
                                type: 'success',
                                message: `${result?.imported || 0} clientes importados, ${result?.skipped || 0} saltados.`,
                            });
                        } catch (e) {
                            addNotification({ id: `customer-dataset-error-${data.load_id}`, type: 'error', message: 'Error al cargar clientes: ' + e.message });
                        }
                    }
                });
            });

            return () => {
                cleanupStatus();
                cleanupRemote();
                cleanupExerciseDataset?.();
                cleanupCustomerDataset?.();
            };
        }
    }, [addToast]);

    // ... rest of the file ...

    // Also check for initial status of License and Google Drive
    useEffect(() => {
        const checkInitialStatus = async () => {
            try {
                // License Status
                if (window.api?.license?.getData) {
                    const license = await window.api.license.getData();
                    if (license && license.active) {
                        addNotification({
                            id: 'license-status',
                            type: 'status',
                            title: 'Licencia Activa',
                            message: 'Tu suscripción Pro Suite está vigente.',
                            priority: 'low',
                            persistent: true
                        });
                    }
                }

                // Google Drive integration removed in v2.2.0
            } catch (err) {
                console.error('Error checking initial notification status:', err);
            }
        };

        checkInitialStatus();
    }, []);

    const handleUpdaterStatus = (data) => {
        const { status, info, error, progress } = data;

        // Map status to notification
        switch (status) {
            case 'available':
                addNotification({
                    id: 'update-available',
                    type: 'update',
                    title: 'Actualización Disponible',
                    message: `Versión ${info.version} lista para descargar.`,
                    info,
                    priority: 'high'
                });
                break;
            case 'downloading':
                updateNotification('update-available', {
                    message: `Descargando actualización: ${Math.round(progress)}%`,
                    progress
                });
                break;
            case 'downloaded':
                updateNotification('update-available', {
                    title: 'Actualización Descargada',
                    message: `La versión ${info.version} está lista para instalar.`,
                    readyToInstall: true
                });
                break;
            case 'error':
                // Silently log update errors (404, network issues) - don't bother the user
                console.warn('[Updater] Update check failed:', error);
                break;
            default:
                break;
        }
    };

    const addNotification = (notifOrMessage, type = 'info') => {
        // Support both object {message, type} and string "Message", "type" signatures
        let finalNotif;
        if (typeof notifOrMessage === 'string') {
            finalNotif = { message: notifOrMessage, type };
        } else {
            finalNotif = { ...notifOrMessage };
        }

        // Validate: No message, no notification
        if (!finalNotif.message || finalNotif.message.trim() === '') {
            console.warn('[NotificationContext] Blocked empty notification:', finalNotif);
            return;
        }

        setNotifications(prev => {
            // Generate unique ID if none provided
            const id = finalNotif.id || `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            const fullNotif = { ...finalNotif, id };

            // Check if it already exists (prevent duplicates for same ID)
            const exists = prev.find(n => n.id === id);
            if (exists) {
                return prev.map(n => n.id === id ? { ...n, ...fullNotif, timestamp: new Date() } : n);
            }
            return [{ ...fullNotif, timestamp: new Date() }, ...prev];
        });
    };

    const updateNotification = (id, updates) => {
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, ...updates } : n));
    };

    const removeNotification = (id) => {
        setNotifications(prev => prev.filter(n => n.id !== id));
    };

    const clearAll = () => {
        setNotifications(prev => prev.filter(n => n.persistent));
    };

    const unreadCount = notifications.filter(n => !n.read && n.type !== 'status').length;

    return (
        <NotificationContext.Provider value={{
            notifications,
            unreadCount,
            isDrawerOpen,
            setDrawerOpen,
            removeNotification,
            clearAll,
            addNotification
        }}>
            {children}
        </NotificationContext.Provider>
    );
}

export const useNotifications = () => {
    const context = useContext(NotificationContext);
    if (!context) throw new Error('useNotifications must be used within a NotificationProvider');
    return context;
};
