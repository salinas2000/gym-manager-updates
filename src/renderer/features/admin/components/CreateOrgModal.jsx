import React, { useState } from 'react';
import { Building2, X, Upload } from 'lucide-react';
import { useNotifications } from '../../../context/NotificationContext';

export function CreateOrgModal({ isOpen, onClose, onSuccess }) {
    const { addNotification } = useNotifications();
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [template, setTemplate] = useState('');
    const [loading, setLoading] = useState(false);

    if (!isOpen) return null;

    const handleCreate = async () => {
        if (!name.trim()) return;
        setLoading(true);
        try {
            const result = await window.api.admin.createOrganization(name, email, template);
            if (result.success) {
                addNotification('Empresa creada correctamente', 'success');
                onSuccess();
                onClose();
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            addNotification(error.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-slate-900 border border-white/10 p-0 rounded-3xl shadow-2xl max-w-md w-full animate-in zoom-in-95 duration-200 overflow-hidden flex flex-col relative">
                <div className="p-8">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-3 bg-indigo-500/10 rounded-2xl text-indigo-400">
                            <Building2 size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white">Nueva Empresa</h2>
                            <p className="text-slate-500 text-xs">Registra un nuevo centro en la red.</p>
                        </div>
                    </div>

                    <div className="space-y-4 mb-8">
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Nombre del Gimnasio</label>
                            <input
                                autoFocus
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-indigo-500 outline-none transition-colors"
                                placeholder="Ej: Elite Gym Center"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Email de Administración</label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-indigo-500 outline-none transition-colors"
                                placeholder="contacto@gym.com"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Plantilla Corporativa (.xlsx)</label>
                            <div className="flex gap-2">
                                <div className="flex-1 bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-slate-400 text-sm truncate italic">
                                    {template ? template.split(/[\\/]/).pop() : 'Predeterminada'}
                                </div>
                                <button
                                    onClick={async () => {
                                        const path = await window.api.admin.selectTemplate();
                                        if (path) setTemplate(path);
                                    }}
                                    className="p-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl border border-white/5 transition-colors"
                                    title="Seleccionar Archivo"
                                >
                                    <Upload size={18} />
                                </button>
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={handleCreate}
                        disabled={loading || !name.trim()}
                        className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold transition-all disabled:opacity-50 shadow-lg shadow-indigo-600/20 uppercase tracking-widest text-xs"
                    >
                        {loading ? 'Procesando...' : 'Confirmar Creación'}
                    </button>
                </div>

                <button onClick={onClose} className="absolute top-4 right-4 text-slate-500 hover:text-white transition-colors p-2">
                    <X size={20} />
                </button>
            </div>
        </div>
    );
}
