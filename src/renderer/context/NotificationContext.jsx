import React, { createContext, useContext, useState, useEffect } from 'react';

const NotificationContext = createContext();

export function NotificationProvider({ children }) {
    const [notifications, setNotifications] = useState([]);
    const [isDrawerOpen, setDrawerOpen] = useState(false);

    useEffect(() => {
        // Listen for updater events from main process
        if (window.api?.on) {
            const cleanup = window.api.on('updater:status', (statusData) => {
                handleUpdaterStatus(statusData);
            });
            return cleanup;
        }
    }, []);

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

                // Google Drive Status
                if (window.api?.google?.getStatus) {
                    const googleRes = await window.api.google.getStatus();
                    if (googleRes.success && googleRes.data?.connected) {
                        const userEmail = googleRes.data.user?.email || 'Conectado';
                        addNotification({
                            id: 'google-status',
                            type: 'status',
                            title: 'Google Drive Conectado',
                            message: `Sincronizando con ${userEmail}`,
                            userEmail: googleRes.data.user?.email, // Extra metadata
                            priority: 'low',
                            persistent: true,
                            action: {
                                label: 'Configurar',
                                view: 'settings',
                                data: 'integrations' // Pass integrations tab
                            }
                        });
                    }
                }
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
                addNotification({
                    id: 'update-error',
                    type: 'error',
                    title: 'Error de Actualización',
                    message: error || 'No se pudo procesar la actualización.',
                    priority: 'medium'
                });
                break;
            default:
                break;
        }
    };

    const addNotification = (notif) => {
        setNotifications(prev => {
            // Check if it already exists (prevent duplicates for same ID)
            const exists = prev.find(n => n.id === notif.id);
            if (exists) {
                return prev.map(n => n.id === notif.id ? { ...n, ...notif, timestamp: new Date() } : n);
            }
            return [{ ...notif, timestamp: new Date() }, ...prev];
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
