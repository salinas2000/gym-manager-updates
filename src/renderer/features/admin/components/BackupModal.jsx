import React, { useState } from 'react';
import { Database, X, Cloud, Send, RefreshCw, Plus } from 'lucide-react';
import { useNotifications } from '../../../context/NotificationContext';
import ConfirmationModal from '../../../components/ui/ConfirmationModal';

export function BackupModal({ gym, onClose, backups = [] }) {
    const { addNotification } = useNotifications();
    const [localBackups, setLocalBackups] = useState([]);
    const [loading, setLoading] = useState(false);
    const [generating, setGenerating] = useState(false);

    // Confirmation Modal State
    const [confirmModal, setConfirmModal] = useState({
        isOpen: false,
        backup: null
    });

    React.useEffect(() => {
        if (gym) {
            loadBackups();
        }
    }, [gym]);

    const loadBackups = async () => {
        setLoading(true);
        try {
            console.log('Fetching backups for:', gym.gym_id);
            const res = await window.api.admin.listBackups(gym.gym_id);
            if (res.success) {
                setLocalBackups(res.data);
            } else {
                addNotification('Error obteniendo backups: ' + res.error, 'error');
            }
        } catch (err) {
            console.error(err);
            addNotification('Error de conexión', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handlePushDB = async () => {
        setGenerating(true);
        // Simulating DB Push Logic as per original code context
        setTimeout(() => {
            addNotification('Carga de DB iniciada. El cliente será notificado.', 'success');
            setGenerating(false);
        }, 1500);
    };

    const confirmRestore = async () => {
        const bak = confirmModal.backup;
        if (!bak) return;

        try {
            addNotification('Enviando orden de restauración...', 'info');
            await window.api.admin.restoreBackup({ gymId: gym.gym_id, fileName: bak.name });
            addNotification('Orden enviada correctamente', 'success');
        } catch (e) {
            addNotification('Error al enviar: ' + e.message, 'error');
        } finally {
            setConfirmModal({ isOpen: false, backup: null });
        }
    };

    if (!gym) return null;

    return (
        <>
            <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                <div className="bg-slate-900 border border-white/10 p-6 rounded-3xl shadow-2xl max-w-4xl w-full h-[600px] flex flex-col animate-in zoom-in-95 duration-200">
                    <div className="flex justify-between items-start mb-6">
                        <div>
                            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                                <Database className="text-indigo-400" /> Gestión de Datos
                            </h2>
                            <p className="text-slate-400 font-mono text-sm mt-1">{gym.gym_name} ({gym.gym_id})</p>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400">
                            <X size={24} />
                        </button>
                    </div>

                    <div className="grid grid-cols-2 gap-8 flex-1">
                        {/* Column 1: Backups */}
                        <div className="bg-slate-950/30 rounded-2xl p-6 border border-white/5 flex flex-col">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-white font-bold flex items-center gap-2">
                                    <Cloud className="text-emerald-400" size={18} /> Copias en Nube
                                </h3>
                                <button onClick={loadBackups} disabled={loading} className="p-1 hover:bg-white/10 rounded">
                                    <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
                                </button>
                            </div>
                            <div className="space-y-3 overflow-y-auto custom-scrollbar flex-1">
                                {loading ? (
                                    <div className="text-center py-10 text-slate-500">Cargando...</div>
                                ) : localBackups.filter(b => b.name.endsWith('.db')).length > 0 ? (
                                    localBackups.filter(b => b.name.endsWith('.db')).map((bak, i) => (
                                        <div key={i} className="bg-slate-950/50 border border-white/5 p-3 rounded-xl flex items-center justify-between gap-2 group hover:border-indigo-500/30 transition-all">
                                            <div className="overflow-hidden">
                                                <div className="text-[10px] text-white font-mono truncate" title={bak.name}>
                                                    {bak.name.replace('_gym_manager.db', '').substring(0, 20)}...
                                                </div>
                                                <div className="flex gap-2 text-[9px] text-slate-500">
                                                    <span>{(bak.size / 1024 / 1024).toFixed(2)} MB</span>
                                                    <span>{new Date(bak.created_at).toLocaleDateString()} {new Date(bak.created_at).toLocaleTimeString()}</span>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => setConfirmModal({ isOpen: true, backup: bak })}
                                                className="p-2 bg-slate-800 hover:bg-indigo-600 text-slate-400 hover:text-white rounded-lg transition-colors"
                                                title="Restaurar esta versión en el Cliente"
                                            >
                                                <Send size={14} />
                                            </button>
                                        </div>
                                    ))
                                ) : (
                                    <p className="text-xs text-slate-500 italic">No hay copias de base de datos disponibles.</p>
                                )}
                            </div>
                        </div>

                        {/* Column 2: Remote Push */}
                        <div className="bg-slate-950/30 rounded-2xl p-6 border border-white/5 flex flex-col justify-center text-center">
                            <div className="bg-indigo-500/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-indigo-400">
                                <Send size={32} />
                            </div>
                            <h3 className="text-white font-bold mb-2">Carga Forzosa de DB</h3>
                            <p className="text-[10px] text-slate-400 mb-4 px-4">
                                Sube un archivo <code className="text-indigo-400">.db</code> para enviarlo a este gimnasio.
                                El cliente recibirá una notificación inmediata para aplicarlo.
                            </p>

                            <button
                                onClick={handlePushDB}
                                disabled={generating}
                                className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold transition-all shadow-lg shadow-indigo-600/20 text-xs flex items-center justify-center gap-2"
                            >
                                {generating ? <RefreshCw className="animate-spin" size={14} /> : <Plus size={14} />}
                                SUBIR Y ENVIAR DB
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <ConfirmationModal
                isOpen={confirmModal.isOpen}
                onClose={() => setConfirmModal({ isOpen: false, backup: null })}
                onConfirm={confirmRestore}
                title="¿Restaurar Copia Remota?"
                type="warning"
                confirmText="Sí, Enviar Orden"
            >
                Estás a punto de enviar una orden de restauración al gimnasio.
                <br /><br />
                <strong>Archivo:</strong> <span className="text-indigo-400 font-mono">{confirmModal.backup?.name}</span>
                <br /><br />
                Esto sobrescribirá la base de datos actual del cliente con esta copia.
                Si el cliente no tiene la app abierta, la restauración se aplicará en su próximo inicio.
            </ConfirmationModal>
        </>
    );
}
