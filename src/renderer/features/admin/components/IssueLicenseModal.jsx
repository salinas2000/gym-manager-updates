import React, { useState } from 'react';
import { ShieldCheck, X, Infinity as InfinityIcon, Layers } from 'lucide-react';
import { useNotifications } from '../../../context/NotificationContext';
import { cn } from '../../../lib/utils';

export function IssueLicenseModal({ isOpen, onClose, onSuccess, organizations }) {
    const { addNotification } = useNotifications();
    const [selectedOrgId, setSelectedOrgId] = useState('');
    const [monthsValidity, setMonthsValidity] = useState(1);
    const [isPermanent, setIsPermanent] = useState(false);
    const [amount, setAmount] = useState(1);
    const [loading, setLoading] = useState(false);

    if (!isOpen) return null;

    const handleIssue = async () => {
        if (!selectedOrgId) return;
        setLoading(true);
        try {
            // If permanent, validity = 0
            const validity = isPermanent ? 0 : monthsValidity;
            const result = await window.api.admin.createLicense(selectedOrgId, validity, amount);

            if (result.success) {
                const count = Array.isArray(result.data) ? result.data.length : 1;
                addNotification(`${count} Licencia(s) emitida(s) correctamente`, 'success');
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
                        <div className="p-3 bg-emerald-500/10 rounded-2xl text-emerald-400">
                            <ShieldCheck size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white">Emitir Licencias</h2>
                            <p className="text-slate-500 text-xs">Genera claves de acceso para una empresa.</p>
                        </div>
                    </div>

                    <div className="space-y-4 mb-8">
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Empresa Destino</label>
                            <select
                                autoFocus
                                value={selectedOrgId}
                                onChange={(e) => setSelectedOrgId(e.target.value)}
                                className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-emerald-500 outline-none transition-colors appearance-none scrollbar-hide"
                            >
                                <option value="">-- Seleccionar --</option>
                                {organizations.map(org => (
                                    <option key={org.id} value={org.id}>{org.name}</option>
                                ))}
                            </select>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Cantidad</label>
                                <div className="relative">
                                    <Layers className="absolute left-3 top-3.5 text-slate-600" size={16} />
                                    <input
                                        type="number"
                                        min="1"
                                        max="50"
                                        value={amount}
                                        onChange={(e) => setAmount(Number(e.target.value))}
                                        className="w-full bg-slate-950 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-white focus:border-emerald-500 outline-none transition-colors"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Duración</label>
                                <div className="flex bg-slate-950 rounded-xl p-1 border border-white/10">
                                    <button
                                        onClick={() => setIsPermanent(false)}
                                        className={cn(
                                            "flex-1 py-2 text-[10px] font-bold rounded-lg transition-all",
                                            !isPermanent ? "bg-emerald-500 text-white" : "text-slate-500 hover:text-slate-300"
                                        )}
                                    >
                                        TEMPORAL
                                    </button>
                                    <button
                                        onClick={() => setIsPermanent(true)}
                                        className={cn(
                                            "flex-1 py-2 text-[10px] font-bold rounded-lg transition-all flex items-center justify-center gap-1",
                                            isPermanent ? "bg-emerald-500 text-white" : "text-slate-500 hover:text-slate-300"
                                        )}
                                    >
                                        <InfinityIcon size={12} /> VITALICIA
                                    </button>
                                </div>
                            </div>
                        </div>

                        {!isPermanent && (
                            <div className="animate-in slide-in-from-top-2 duration-200">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Meses de Validez</label>
                                <input
                                    type="number"
                                    min="1"
                                    max="120"
                                    value={monthsValidity}
                                    onChange={(e) => setMonthsValidity(Number(e.target.value))}
                                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-emerald-500 outline-none transition-colors"
                                    placeholder="Ej: 12"
                                />
                            </div>
                        )}
                    </div>

                    <button
                        onClick={handleIssue}
                        disabled={loading || !selectedOrgId}
                        className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold transition-all disabled:opacity-50 shadow-lg shadow-emerald-600/20 uppercase tracking-widest text-xs"
                    >
                        {loading ? 'Generando...' : `Emitir ${amount} Licencia${amount > 1 ? 's' : ''}`}
                    </button>
                </div>

                <button onClick={onClose} className="absolute top-4 right-4 text-slate-500 hover:text-white transition-colors p-2">
                    <X size={20} />
                </button>
            </div>
        </div>
    );
}
