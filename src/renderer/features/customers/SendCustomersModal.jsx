import React, { useState, useEffect } from 'react';
import { textIncludes } from '../../lib/text';
import { X, Send, Check, Search, Users, Building2, AlertTriangle } from 'lucide-react';
import { useGym } from '../../context/GymContext';
import { useToast } from '../../context/ToastContext';
import LoadingSpinner from '../../components/ui/LoadingSpinner';

export default function SendCustomersModal({ isOpen, onClose }) {
    const { customers } = useGym();
    const toast = useToast();

    const [step, setStep] = useState(1); // 1: select customers, 2: select gym, 3: confirm
    const [selectedIds, setSelectedIds] = useState(new Set());
    const [targetGymId, setTargetGymId] = useState('');
    const [gyms, setGyms] = useState([]);
    const [search, setSearch] = useState('');
    const [sending, setSending] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setStep(1);
            setSelectedIds(new Set());
            setTargetGymId('');
            setSearch('');
            // Load available gyms from admin
            window.api.admin.listGyms().then(res => {
                if (res.success && res.data) setGyms(res.data);
            }).catch(() => {});
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const safeCustomers = Array.isArray(customers) ? customers : [];
    const filtered = safeCustomers.filter(c =>
        textIncludes(c.first_name, search) ||
        textIncludes(c.last_name, search) ||
        textIncludes(c.email, search)
    );

    const toggleSelect = (id) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    const toggleAll = () => {
        if (selectedIds.size === filtered.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(filtered.map(c => c.id)));
        }
    };

    const selectedCustomers = safeCustomers.filter(c => selectedIds.has(c.id));

    const handleSend = async () => {
        if (!targetGymId || selectedIds.size === 0) return;
        setSending(true);
        try {
            const res = await window.api.cloud.sendCustomersToGym(targetGymId, Array.from(selectedIds));
            if (res.success && res.data?.success) {
                toast.success(`${res.data.sent} clientes enviados correctamente a ${targetGymId}`);
                onClose();
            } else {
                toast.error(res.error || 'Error al enviar clientes');
            }
        } catch (err) {
            toast.error(err.message || 'Error al enviar clientes');
        } finally {
            setSending(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={onClose} />
            <div className="relative w-full max-w-2xl max-h-[80vh] bg-slate-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col">

                {/* Header */}
                <div className="p-6 border-b border-white/5">
                    <button onClick={onClose} className="absolute top-4 right-4 p-2 hover:bg-white/5 rounded-lg text-slate-400 hover:text-white transition-colors">
                        <X size={18} />
                    </button>
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-blue-500/10 rounded-xl">
                            <Send size={20} className="text-blue-400" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white">Enviar Clientes a Gimnasio</h2>
                            <p className="text-sm text-slate-400">
                                {step === 1 && 'Selecciona los clientes que quieres enviar'}
                                {step === 2 && 'Elige el gimnasio destino'}
                                {step === 3 && 'Confirma el envio'}
                            </p>
                        </div>
                    </div>

                    {/* Steps indicator */}
                    <div className="flex items-center gap-2 mt-4">
                        {[1, 2, 3].map(s => (
                            <div key={s} className="flex items-center gap-2">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${step >= s ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-500'}`}>
                                    {step > s ? <Check size={14} /> : s}
                                </div>
                                {s < 3 && <div className={`w-12 h-0.5 ${step > s ? 'bg-blue-600' : 'bg-slate-800'}`} />}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {step === 1 && (
                        <div className="space-y-4">
                            <div className="flex items-center gap-3">
                                <div className="relative flex-1">
                                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                                    <input
                                        type="text"
                                        placeholder="Buscar cliente..."
                                        className="w-full bg-slate-800/50 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white placeholder:text-slate-600 focus:border-blue-500 outline-none"
                                        value={search}
                                        onChange={e => setSearch(e.target.value)}
                                    />
                                </div>
                                <button
                                    onClick={toggleAll}
                                    className="px-3 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs font-bold text-slate-300 transition-colors"
                                >
                                    {selectedIds.size === filtered.length ? 'Deseleccionar' : 'Seleccionar Todos'}
                                </button>
                            </div>

                            <p className="text-xs text-slate-500">{selectedIds.size} seleccionados de {safeCustomers.length}</p>

                            <div className="space-y-1 max-h-[400px] overflow-y-auto">
                                {filtered.map(c => (
                                    <button
                                        key={c.id}
                                        onClick={() => toggleSelect(c.id)}
                                        className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${selectedIds.has(c.id)
                                            ? 'bg-blue-500/10 border-blue-500/30'
                                            : 'bg-slate-800/30 border-white/5 hover:bg-slate-800/60'
                                            }`}
                                    >
                                        <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all ${selectedIds.has(c.id)
                                            ? 'bg-blue-600 border-blue-600'
                                            : 'border-slate-600'
                                            }`}>
                                            {selectedIds.has(c.id) && <Check size={12} className="text-white" />}
                                        </div>
                                        <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-300 flex-shrink-0">
                                            {(c.first_name || '?')[0]}{(c.last_name || '?')[0]}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-white">{c.first_name} {c.last_name}</p>
                                            <p className="text-xs text-slate-500 truncate">{c.email}</p>
                                        </div>
                                        <span className={`text-[9px] uppercase font-bold tracking-widest ${c.active ? 'text-emerald-400' : 'text-slate-600'}`}>
                                            {c.active ? 'Activo' : 'Inactivo'}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="space-y-4">
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">ID del Gimnasio Destino</label>
                                <input
                                    type="text"
                                    className="w-full glass-input text-white placeholder:text-slate-600 focus:border-blue-500"
                                    placeholder="GYM-XXXXXX"
                                    value={targetGymId}
                                    onChange={e => setTargetGymId(e.target.value.trim())}
                                />
                            </div>

                            {gyms.length > 0 && (
                                <>
                                    <p className="text-xs text-slate-500 uppercase font-bold tracking-widest">O selecciona un gimnasio registrado</p>
                                    <div className="space-y-2 max-h-[300px] overflow-y-auto">
                                        {gyms.map(gym => (
                                            <button
                                                key={gym.gym_id || gym.id}
                                                onClick={() => setTargetGymId(gym.gym_id || gym.id)}
                                                className={`w-full flex items-center gap-3 p-4 rounded-xl border transition-all text-left ${targetGymId === (gym.gym_id || gym.id)
                                                    ? 'bg-blue-500/10 border-blue-500/30'
                                                    : 'bg-slate-800/30 border-white/5 hover:bg-slate-800/60'
                                                    }`}
                                            >
                                                <div className="p-2 bg-slate-700 rounded-lg">
                                                    <Building2 size={16} className="text-slate-300" />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-bold text-white">{gym.gym_name || gym.name || gym.gym_id}</p>
                                                    <p className="text-xs text-slate-500 font-mono">{gym.gym_id || gym.id}</p>
                                                </div>
                                                {targetGymId === (gym.gym_id || gym.id) && (
                                                    <Check size={16} className="text-blue-400 ml-auto" />
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    {step === 3 && (
                        <div className="space-y-6">
                            <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-5">
                                <div className="flex items-center gap-3 mb-4">
                                    <Users size={20} className="text-blue-400" />
                                    <p className="text-white font-bold">{selectedIds.size} clientes</p>
                                </div>
                                <div className="space-y-1 max-h-32 overflow-y-auto">
                                    {selectedCustomers.map(c => (
                                        <p key={c.id} className="text-xs text-slate-300">{c.first_name} {c.last_name} - {c.email}</p>
                                    ))}
                                </div>
                            </div>

                            <div className="flex items-center gap-2 text-sm">
                                <Send size={16} className="text-slate-400" />
                                <span className="text-slate-400">Destino:</span>
                                <span className="text-white font-bold font-mono">{targetGymId}</span>
                            </div>

                            <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4 flex items-start gap-3">
                                <AlertTriangle size={16} className="text-amber-400 flex-shrink-0 mt-0.5" />
                                <p className="text-xs text-amber-300/80">
                                    Los datos de los clientes (incluyendo ficha medica) se enviaran a la base de datos cloud del gimnasio destino. Si ya existen, se actualizaran.
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-white/5 bg-slate-900/50 flex justify-between items-center">
                    <button
                        onClick={() => step > 1 ? setStep(step - 1) : onClose()}
                        className="text-slate-400 hover:text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-white/5 transition-all"
                    >
                        {step > 1 ? 'Atras' : 'Cancelar'}
                    </button>

                    {step < 3 ? (
                        <button
                            onClick={() => setStep(step + 1)}
                            disabled={(step === 1 && selectedIds.size === 0) || (step === 2 && !targetGymId)}
                            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-30 disabled:cursor-not-allowed text-white px-6 py-2 rounded-xl text-sm font-bold transition-all"
                        >
                            Siguiente
                        </button>
                    ) : (
                        <button
                            onClick={handleSend}
                            disabled={sending}
                            className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white px-6 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2"
                        >
                            {sending ? <LoadingSpinner size="sm" color="white" /> : <Send size={14} />}
                            {sending ? 'Enviando...' : 'Enviar Clientes'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
