import React, { useEffect, useState } from 'react';
import { CloudDownload, RefreshCw } from 'lucide-react';
import ConfirmationModal from '../../../components/ui/ConfirmationModal';
import { useNotifications } from '../../../context/NotificationContext';

export default function RemoteRestoreHandler() {
    const { addNotification } = useNotifications();
    const [pendingLoad, setPendingLoad] = useState(null);
    const [isApplying, setIsApplying] = useState(false);

    useEffect(() => {
        // Subscribe to IPC event from Main Process (CloudService)
        const unsubscribe = window.api.cloud.onRemoteLoadPending((data) => {
            console.log('📡 [RemoteRestoreHandler] Signal Received:', data);
            setPendingLoad(data);
        });

        return () => {
            if (unsubscribe) unsubscribe();
        };
    }, []);

    const handleConfirm = async () => {
        if (!pendingLoad) return;
        setIsApplying(true);
        addNotification('Iniciando restauración remota...', 'info');

        try {
            const result = await window.api.cloud.applyRemoteLoad({
                loadId: pendingLoad.load_id,
                gymId: pendingLoad.gym_id
            });

            if (result.success) {
                addNotification('Base de datos actualizada correctamente. Reiniciando...', 'success');
                // The main process usually reloads the app, but we can force a UI refresh if needed
                setTimeout(() => window.location.reload(), 2000);
            } else {
                throw new Error(result.error || 'Error desconocido');
            }
        } catch (error) {
            console.error('Remote Restore Failed:', error);
            addNotification('Error al aplicar la actualización: ' + error.message, 'error');
            setIsApplying(false); // Only reset if failed, success implies reload
        }
    };

    const handleClose = () => {
        if (!isApplying) {
            setPendingLoad(null);
        }
    };

    if (!pendingLoad) return null;

    return (
        <ConfirmationModal
            isOpen={!!pendingLoad}
            onClose={handleClose}
            onConfirm={handleConfirm}
            title="Actualización de Datos Disponible"
            type="warning"
            confirmText={isApplying ? "Aplicando..." : "Actualizar Ahora"}
            cancelText="Posponer"
            showCancel={!isApplying}
        >
            <div className="flex flex-col gap-4">
                <div className="flex items-center gap-3 text-indigo-400 bg-indigo-500/10 p-4 rounded-xl">
                    <CloudDownload size={24} />
                    <p className="font-bold text-sm">El administrador ha enviado una nueva versión de la base de datos.</p>
                </div>

                <p className="text-sm text-slate-400">
                    Se detectó una solicitud de restauración enviada el: <br />
                    <span className="font-mono text-white">
                        {new Date(pendingLoad.timestamp).toLocaleString()}
                    </span>
                </p>

                <div className="text-xs bg-slate-950 p-3 rounded-lg border border-white/5 text-slate-500">
                    <strong>Nota:</strong> Al aceptar, la aplicación se reiniciará para aplicar los cambios.
                    Asegúrese de guardar cualquier trabajo pendiente.
                </div>
            </div>
        </ConfirmationModal>
    );
}
