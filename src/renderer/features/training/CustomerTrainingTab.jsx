import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Calendar, ChevronRight, Plus, AlertCircle, CheckCircle, Clock, Download, Trash2, FileSpreadsheet, Cloud, CloudOff } from 'lucide-react';
import ConfirmationModal from '../../components/ui/ConfirmationModal';

export default function CustomerTrainingTab({ customerId, onNewMesocycle, onSelectMesocycle, readOnly = false, onNavigate }) {

    const queryClient = useQueryClient();
    const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', children: null, onConfirm: () => { }, type: 'info' });
    const [isGoogleConnected, setIsGoogleConnected] = useState(false);

    // Check Google Status
    // Check Google Status
    React.useEffect(() => {
        const checkStatus = async () => {
            const res = await window.api.google.getStatus();
            setIsGoogleConnected(res.success && res.data.connected);
        };
        checkStatus();
    }, []);

    // Helper to open modal
    const requestConfirm = ({ title, message, type = 'info', confirmText, onConfirm }) => {
        setConfirmModal({
            isOpen: true,
            title,
            children: message,
            type,
            confirmText,
            onConfirm
        });
    };

    // Fetch Mesocycles
    const { data: mesocycles = [], isLoading } = useQuery({
        queryKey: ['mesocycles', customerId],
        queryFn: async () => {
            const res = await window.api.training.getMesocycles(customerId);
            return res.success ? res.data : [];
        },
        enabled: !!customerId
    });

    // Delete Mutation
    const deleteMutation = useMutation({
        mutationFn: async (mesoId) => {
            return await window.api.training.deleteMesocycle(mesoId);
        },
        onSuccess: () => {
            // Invalidate and refetch
            queryClient.invalidateQueries(['mesocycles', customerId]);
        }
    });

    // --- AUTO-SYNC DRIVE LINKS ---
    // Check validity of all drive links when list loads
    const driveLinksFingerprint = mesocycles.map(m => m.drive_link || '').join('|');

    React.useEffect(() => {
        if (!customerId || !isGoogleConnected) return; // Don't sync if disconnected
        const toCheck = mesocycles.filter(m => m.drive_link);
        if (toCheck.length === 0) return;

        // Run checks in background
        Promise.all(toCheck.map(m => window.api.training.validateDriveLink(m.id, m.drive_link)))
            .then(results => {
                // If any link was invalid (results[i] === false), refresh
                if (results.some(res => res === false)) {
                    console.log('Sync: Found broken links. Refreshing...');
                    queryClient.invalidateQueries(['mesocycles', customerId]);
                }
            });
    }, [customerId, driveLinksFingerprint, queryClient, isGoogleConnected]);


    const getStatusConfig = (status) => {
        switch (status) {
            case 'active': return { color: 'border-l-emerald-500', badge: 'bg-emerald-500/10 text-emerald-400', icon: CheckCircle, label: 'Activo' };
            case 'future': return { color: 'border-l-blue-500', badge: 'bg-blue-500/10 text-blue-400', icon: Clock, label: 'Futuro' };
            case 'expired': return { color: 'border-l-slate-600', badge: 'bg-slate-700/50 text-slate-400', icon: Calendar, label: 'Finalizado' };
            default: return { color: 'border-l-slate-600', badge: 'bg-slate-800 text-slate-400', icon: Calendar, label: 'Archivado' };
        }
    };

    const handleExport = async (meso, e) => {
        e.stopPropagation();
        try {
            const fullMesoRes = await window.api.training.getMesocycle(meso.id);
            if (!fullMesoRes.success) return alert('Error al obtener datos del ciclo');

            const fullMeso = fullMesoRes.data;
            const exportData = {
                ...fullMeso,
                isTemplate: false,
                customerId: customerId,
                routines: fullMeso.routines
            };

            const result = await window.api.training.exportRoutine(exportData);

            if (result.success) {
                // Success feedback
                // alert('Rutina exportada correctamente en: ' + result.filePath);
            } else if (!result.cancelled) {
                alert('Error al exportar: ' + result.error);
            }
        } catch (err) {
            console.error(err);
            alert('Error inesperado al exportar.');
        }
    };

    const handleNewMesocycle = () => {
        // Check if there's an active mesocycle
        // Prioritize the one that ends later if multiple exist
        const activeMesocycles = mesocycles
            .filter(m => m.status === 'active')
            .sort((a, b) => {
                const dateA = a.end_date ? new Date(a.end_date) : new Date('9999-12-31');
                const dateB = b.end_date ? new Date(b.end_date) : new Date('9999-12-31');
                return dateB - dateA;
            });

        const activeMesocycle = activeMesocycles[0];

        if (activeMesocycle) {
            requestConfirm({
                title: 'Nuevo Mesociclo',
                message: (
                    <div className="space-y-3">
                        <p>⚠️ <strong>Ya existe un mesociclo activo:</strong> "{activeMesocycle.name}"</p>
                        <p className="text-sm text-slate-400">
                            Fecha: {new Date(activeMesocycle.start_date).toLocaleDateString()} - {activeMesocycle.end_date ? new Date(activeMesocycle.end_date).toLocaleDateString() : 'Indefinido'}
                        </p>
                        <p>¿Deseas crear uno nuevo? (Puedes crearlo como una excepción si las fechas coinciden).</p>
                    </div>
                ),
                type: 'warning',
                onConfirm: onNewMesocycle
            });
            return;
        }

        onNewMesocycle();
    };

    const handleDelete = async (meso, e) => {
        e.stopPropagation();

        requestConfirm({
            title: 'Eliminar Mesociclo',
            message: `¿Estás seguro de que deseas eliminar "${meso.name}"? Esta acción borrará todas las rutinas y ejercicios asociados.`,
            type: 'danger',
            confirmText: 'Eliminar Definitivamente',
            onConfirm: async () => {
                try {
                    await deleteMutation.mutateAsync(meso.id);
                } catch (err) {
                    console.error('Error deleting mesocycle:', err);
                    alert('Error al eliminar el mesociclo. Por favor, intenta de nuevo.');
                }
            }
        });
    };

    if (!customerId) return <div className="text-slate-500 p-4">Selecciona un cliente para ver su historial.</div>;

    return (
        <div className="flex flex-col h-full relative">
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <Calendar className="text-blue-400" />
                    Historial de Mesociclos
                </h3>
                {!readOnly && (
                    <button
                        onClick={handleNewMesocycle}
                        className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl flex items-center gap-2 font-bold transition-all shadow-lg shadow-blue-900/20"
                    >
                        <Plus size={18} />
                        Nuevo Mesociclo
                    </button>
                )}
            </div>

            <div className="flex-1 overflow-y-auto pr-2 space-y-4">
                {isLoading ? (
                    <div className="text-slate-500 text-center py-10">Cargando historial...</div>
                ) : mesocycles.length === 0 ? (
                    <div className="text-center py-12 bg-slate-900/30 rounded-2xl border border-dashed border-white/5">
                        <AlertCircle className="mx-auto text-slate-600 mb-2" size={32} />
                        <p className="text-slate-500 font-medium">Este cliente no tiene planes de entrenamiento.</p>
                        {!readOnly ? (
                            <button onClick={handleNewMesocycle} className="text-blue-400 hover:text-blue-300 text-sm mt-2 font-bold">
                                Crear el primero
                            </button>
                        ) : (
                            <p className="text-slate-600 text-sm mt-2">No existen más mesociclos.</p>
                        )}
                    </div>
                ) : (
                    mesocycles.map(meso => {
                        const style = getStatusConfig(meso.status);
                        return (
                            <div
                                key={meso.id}
                                onClick={() => onSelectMesocycle(meso)}
                                className={`bg-slate-900/50 rounded-xl p-4 border border-white/5 border-l-4 ${style.color} hover:bg-slate-800 transition-all cursor-pointer group flex items-center justify-between`}
                            >
                                <div>
                                    <div className="flex items-center gap-3 mb-1">
                                        <h4 className="font-bold text-white text-lg">{meso.name}</h4>
                                        <span className={`text-xs px-2 py-0.5 rounded-full flex items-center gap-1 font-bold uppercase tracking-wider ${style.badge}`}>
                                            <style.icon size={10} />
                                            {style.label}
                                        </span>
                                    </div>
                                    <p className="text-sm text-slate-400 flex items-center gap-2">
                                        <Calendar size={14} />
                                        {new Date(meso.start_date).toLocaleDateString()}
                                        {' -> '}
                                        {meso.end_date ? new Date(meso.end_date).toLocaleDateString() : 'Indefinido'}
                                    </p>
                                </div>
                                <div className="flex items-center gap-2">
                                    {!readOnly && (
                                        <button
                                            onClick={(e) => handleDelete(meso, e)}
                                            className="p-2 hover:bg-red-700 bg-slate-800/50 rounded-full text-red-400 hover:text-white transition-colors border border-white/5"
                                            title="Eliminar Mesociclo"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    )}
                                    <button
                                        onClick={(e) => handleExport(meso, e)}
                                        className="p-2 hover:bg-emerald-600 bg-slate-800/50 rounded-full text-emerald-400 hover:text-white transition-colors border border-white/5"
                                        title="Exportar a Excel"
                                    >
                                        <FileSpreadsheet size={18} />
                                    </button>
                                    <UploadButton
                                        meso={meso}
                                        requestConfirm={requestConfirm} // Pass confirm handler
                                        isGoogleConnected={isGoogleConnected}
                                        onNavigate={onNavigate}
                                        onUpload={async () => {
                                            const res = await window.api.training.uploadToDrive(meso.id);
                                            if (res.success) return res.data;
                                            throw new Error(res.error);
                                        }}
                                    />
                                    <div className="bg-slate-950 p-2 rounded-full text-slate-500 group-hover:text-white group-hover:bg-blue-600 transition-all">
                                        <ChevronRight size={20} />
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            <ConfirmationModal
                isOpen={confirmModal.isOpen}
                title={confirmModal.title}
                onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                onConfirm={confirmModal.onConfirm}
                type={confirmModal.type}
                confirmText={confirmModal.confirmText || 'Confirmar'}
            >
                {confirmModal.children}
            </ConfirmationModal>
        </div>
    );
}

// Subcomponent for handling upload state locally
function UploadButton({ meso, onUpload, requestConfirm, isGoogleConnected, onNavigate }) {
    // Initialize state based on persisted link
    const [status, setStatus] = React.useState(meso.drive_link ? 'success' : 'idle');
    const [link, setLink] = React.useState(meso.drive_link || null);
    const [errorMessage, setErrorMessage] = React.useState('');

    const handleClick = async (e) => {
        e.stopPropagation();

        // 0. CHECK CONNECTION (Always first)
        if (!isGoogleConnected) {
            requestConfirm({
                title: 'Sincronización Desactivada',
                message: (
                    <div className="space-y-2">
                        <p>No se puede verificar ni subir archivos porque Google Drive está desconectado.</p>
                        <p className="text-sm text-slate-400">Ve a Configuración -&gt; Integraciones para activarlo.</p>
                    </div>
                ),
                type: 'warning',
                confirmText: 'Ir a Configuración',
                onConfirm: () => {
                    if (onNavigate) onNavigate('settings', 'integrations');
                }
            });
            return;
        }

        // --- VALIDATION AND OPEN LOGIC ---
        if (status === 'success' && link) {
            setStatus('uploading'); // Show spinner while checking
            try {
                const isValid = await window.api.training.validateDriveLink(meso.id, link);
                if (isValid) {
                    window.open(link, '_blank');
                    setStatus('success');
                } else {
                    setErrorMessage('El archivo fue eliminado de Drive.');
                    setLink(null);
                    setStatus('idle'); // Allow re-upload
                }
            } catch (err) {
                console.error(err);
                // On network error, maybe just try opening? 
                window.open(link, '_blank');
                setStatus('success');
            }
            return;
        }

        if (status === 'uploading') return;

        // Use the custom modal instead of window.confirm
        requestConfirm({
            title: 'Subir a Google Drive',
            message: `¿Deseas subir la rutina de "${meso.name}" y generar un link para compartir?`,
            type: 'info',
            confirmText: 'Subir Rutina',
            onConfirm: async () => {
                setStatus('uploading');
                setErrorMessage('');
                try {
                    const url = await onUpload();
                    setLink(url);
                    setStatus('success');
                } catch (err) {
                    console.error(err);
                    setErrorMessage(err.message);
                    setStatus('error');
                    setTimeout(() => setStatus('idle'), 5000);
                }
            }
        });
    };

    if (status === 'uploading') {
        return (
            <div className="p-2 bg-slate-800/50 rounded-full border border-white/5 cursor-wait">
                <div className="w-[18px] h-[18px] border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    // DISCONNECTED STATE (Prioritize over Success)
    if (!isGoogleConnected) {
        return (
            <button
                onClick={handleClick}
                className="p-2 bg-slate-800/30 text-slate-500 rounded-full border border-white/5 hover:bg-slate-800 hover:text-slate-300 transition-all"
                title="Sin conexión a Drive (Click para activar)"
            >
                <CloudOff size={18} />
            </button>
        );
    }

    if (status === 'success') {
        return (
            <button
                onClick={handleClick}
                className="p-2 bg-green-500/20 text-green-400 rounded-full border border-green-500/50 hover:bg-green-500 hover:text-white transition-all"
                title="Abrir en Drive (Subida Completada)"
            >
                <CheckCircle size={18} />
            </button>
        );
    }

    return (
        <button
            onClick={handleClick}
            className={`p-2 rounded-full border border-white/5 transition-colors ${status === 'error' ? 'bg-red-500/20 text-red-400 hover:bg-red-500 hover:text-white' :
                'bg-slate-800/50 text-blue-400 hover:bg-blue-600 hover:text-white'
                }`}
            title={status === 'error' ? "Error al subir (Click para reintentar)" : "Subir a Google Drive"}
        >
            {status === 'error' ? <AlertCircle size={18} /> : <Cloud size={18} />}
        </button>
    );
}
