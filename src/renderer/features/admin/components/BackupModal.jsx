import React, { useState } from 'react';
import { Database, X, Cloud, Send, RefreshCw, Plus } from 'lucide-react';
import { useNotifications } from '../../../context/NotificationContext';

export function BackupModal({ gym, onClose, backups = [] }) {
    const { addNotification } = useNotifications();
    const [generating, setGenerating] = useState(false);

    if (!gym) return null;

    const handlePushDB = async () => {
        setGenerating(true);
        // Simulating DB Push Logic as per original code context
        setTimeout(() => {
            addNotification('Carga de DB iniciada. El cliente será notificado.', 'success');
            setGenerating(false);
        }, 1500);
    };

    return (
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
                        <h3 className="text-white font-bold mb-4 flex items-center gap-2">
                            <Cloud className="text-emerald-400" size={18} /> Copias en Nube
                        </h3>
                        <div className="space-y-3 overflow-y-auto custom-scrollbar flex-1">
                            {backups.length > 0 ? (
                                backups.map((bak, i) => (
                                    <div key={i} className="bg-slate-950/50 border border-white/5 p-3 rounded-xl flex flex-col gap-1">
                                        <div className="text-[10px] text-white font-mono truncate">{bak.name}</div>
                                        <div className="flex justify-between items-center text-[9px] text-slate-500">
                                            <span>{(bak.size / 1024 / 1024).toFixed(2)} MB</span>
                                            <span>{new Date(bak.created_at).toLocaleDateString()}</span>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <p className="text-xs text-slate-500 italic">No hay sistemas de backup detectados (Simulación).</p>
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
    );
}
