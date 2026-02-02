import React, { useState } from 'react';
import { Settings } from 'lucide-react';

export function EditOrgModal({ org, onClose, onSuccess }) {
    const [name, setName] = useState(org.name || '');
    const [email, setEmail] = useState(org.contact_email || '');
    const [template, setTemplate] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSave = async () => {
        setLoading(true);
        try {
            const res = await window.api.admin.updateOrganization(org.id, { name, email, templatePath: template });
            if (res.success) {
                onSuccess();
            } else {
                alert('Error: ' + res.error);
            }
        } catch (e) {
            alert('Error: ' + e.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-slate-900 border border-white/10 p-6 rounded-3xl shadow-2xl max-w-md w-full animate-in zoom-in-95 duration-200">
                <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                    <Settings className="text-blue-400" /> Editar Organización
                </h3>

                <div className="space-y-4 mb-6">
                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Nombre</label>
                        <input
                            type="text"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-blue-500 outline-none"
                        />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Email</label>
                        <input
                            type="email"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-blue-500 outline-none"
                        />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Plantilla Excel</label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                readOnly
                                value={template ? 'Nueva Selección' : (org.excel_template_url ? 'Actual: Vinculada' : 'Predeterminada')}
                                className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-slate-400 text-sm italic"
                            />
                            <button
                                onClick={async () => {
                                    const path = await window.api.admin.selectTemplate();
                                    if (path) setTemplate(path);
                                }}
                                className="px-4 bg-slate-800 hover:bg-slate-700 text-white rounded-xl border border-white/5 whitespace-nowrap"
                            >
                                Cambiar
                            </button>
                        </div>
                        {template && <p className="text-[10px] text-emerald-400 mt-1 truncate">Nueva: {template}</p>}
                    </div>
                </div>

                <div className="flex gap-3 justify-end">
                    <button onClick={onClose} className="px-4 py-2 hover:bg-slate-800 text-slate-300 rounded-lg font-bold">Cancelar</button>
                    <button
                        onClick={handleSave}
                        disabled={loading}
                        className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold shadow-lg shadow-blue-600/20 disabled:opacity-50"
                    >
                        {loading ? 'Guardando...' : 'Guardar Cambios'}
                    </button>
                </div>
            </div>
        </div>
    );
}
