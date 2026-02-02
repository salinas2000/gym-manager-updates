import React, { useState } from 'react';
import { Building2, ShieldCheck, X } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { useNotifications } from '../../../context/NotificationContext';

export function CreateModal({ isOpen, onClose, onSuccess, organizations }) {
    const { addNotification } = useNotifications();
    const [createMode, setCreateMode] = useState('org'); // 'org' | 'license'

    // Org States
    const [newOrgName, setNewOrgName] = useState('');
    const [newOrgEmail, setNewOrgEmail] = useState('');
    const [newOrgTemplate, setNewOrgTemplate] = useState('');

    // License States
    const [selectedOrgId, setSelectedOrgId] = useState('');
    const [monthsValidity, setMonthsValidity] = useState(1);

    const [generating, setGenerating] = useState(false);

    if (!isOpen) return null;

    const handleCreateOrg = async () => {
        if (!newOrgName.trim()) return;
        setGenerating(true);
        try {
            const result = await window.api.admin.createOrganization(newOrgName, newOrgEmail, newOrgTemplate);
            if (result.success) {
                addNotification('Organización creada exitosamente', 'success');
                // Reset form
                setNewOrgName('');
                setNewOrgEmail('');
                setNewOrgTemplate('');
                onSuccess(); // Refresh data
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            addNotification(error.message, 'error');
        } finally {
            setGenerating(false);
        }
    };

    const handleIssueLicense = async () => {
        if (!selectedOrgId) return;
        setGenerating(true);
        try {
            const result = await window.api.admin.generateLicense(selectedOrgId, monthsValidity);
            if (result.success) {
                addNotification('Licencia emitida exitosamente', 'success');
                // Reset form
                setSelectedOrgId('');
                setMonthsValidity(1);
                onSuccess(); // Refresh data
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            addNotification(error.message, 'error');
        } finally {
            setGenerating(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-slate-900 border border-white/10 p-0 rounded-3xl shadow-2xl max-w-md w-full animate-in zoom-in-95 duration-200 overflow-hidden flex flex-col relative">
                {/* Tabs */}
                <div className="flex border-b border-white/5">
                    <button
                        onClick={() => setCreateMode('org')}
                        className={cn(
                            "flex-1 py-4 text-sm font-bold transition-colors",
                            createMode === 'org' ? "bg-indigo-500/10 text-indigo-400 border-b-2 border-indigo-400" : "text-slate-500 hover:bg-white/5"
                        )}
                    >
                        1. Crear Empresa
                    </button>
                    <button
                        onClick={() => setCreateMode('license')}
                        className={cn(
                            "flex-1 py-4 text-sm font-bold transition-colors",
                            createMode === 'license' ? "bg-indigo-500/10 text-indigo-400 border-b-2 border-indigo-400" : "text-slate-500 hover:bg-white/5"
                        )}
                    >
                        2. Emitir Licencia
                    </button>
                </div>

                <div className="p-8">
                    {createMode === 'org' ? (
                        <>
                            <div className="flex items-center gap-3 mb-6">
                                <div className="p-3 bg-indigo-500/10 rounded-2xl text-indigo-400">
                                    <Building2 size={24} />
                                </div>
                                <h2 className="text-xl font-bold text-white">Nueva Organización</h2>
                            </div>

                            <div className="space-y-4 mb-8">
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Nombre Comercial</label>
                                    <input
                                        autoFocus
                                        type="text"
                                        value={newOrgName}
                                        onChange={(e) => setNewOrgName(e.target.value)}
                                        className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-indigo-500 outline-none transition-colors"
                                        placeholder="Ej: Gimnasio Iron Pumping"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Email Contacto (Opcional)</label>
                                    <input
                                        type="email"
                                        value={newOrgEmail}
                                        onChange={(e) => setNewOrgEmail(e.target.value)}
                                        className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-indigo-500 outline-none transition-colors"
                                        placeholder="admin@ejemplo.com"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Plantilla Excel (Opcional)</label>
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            readOnly
                                            value={newOrgTemplate ? 'Plantilla Seleccionada' : 'Predeterminada'}
                                            className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-slate-400 text-sm italic"
                                        />
                                        <button
                                            onClick={async () => {
                                                const path = await window.api.admin.selectTemplate();
                                                if (path) setNewOrgTemplate(path);
                                            }}
                                            className="px-4 bg-slate-800 hover:bg-slate-700 text-white rounded-xl border border-white/5 whitespace-nowrap"
                                        >
                                            Seleccionar
                                        </button>
                                    </div>
                                    {newOrgTemplate && <p className="text-[10px] text-emerald-400 mt-1 truncate">{newOrgTemplate}</p>}
                                </div>
                            </div>

                            <button
                                onClick={handleCreateOrg}
                                disabled={generating || !newOrgName.trim()}
                                className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold transition-all disabled:opacity-50 shadow-lg shadow-indigo-600/20"
                            >
                                {generating ? 'Creando...' : 'Crear Organización'}
                            </button>
                        </>
                    ) : (
                        <>
                            <div className="flex items-center gap-3 mb-6">
                                <div className="p-3 bg-emerald-500/10 rounded-2xl text-emerald-400">
                                    <ShieldCheck size={24} />
                                </div>
                                <h2 className="text-xl font-bold text-white">Emitir Licencia</h2>
                            </div>

                            <div className="space-y-4 mb-8">
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Seleccionar Empresa</label>
                                    <select
                                        value={selectedOrgId}
                                        onChange={(e) => setSelectedOrgId(e.target.value)}
                                        className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-emerald-500 outline-none transition-colors appearance-none"
                                    >
                                        <option value="">-- Seleccionar --</option>
                                        {organizations.map(org => (
                                            <option key={org.id} value={org.id}>{org.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Validez (Meses)</label>
                                    <input
                                        type="number"
                                        min="1"
                                        max="120"
                                        value={monthsValidity}
                                        onChange={(e) => setMonthsValidity(parseInt(e.target.value))}
                                        className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-emerald-500 outline-none transition-colors"
                                    />
                                </div>
                            </div>

                            <button
                                onClick={handleIssueLicense}
                                disabled={generating || !selectedOrgId}
                                className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold transition-all disabled:opacity-50 shadow-lg shadow-emerald-600/20"
                            >
                                {generating ? 'Generando...' : 'Emitir y Enviar'}
                            </button>
                        </>
                    )}
                </div>

                <button onClick={onClose} className="absolute top-4 right-4 text-slate-500 hover:text-white">
                    <X size={20} />
                </button>
            </div>
        </div>
    );
}
