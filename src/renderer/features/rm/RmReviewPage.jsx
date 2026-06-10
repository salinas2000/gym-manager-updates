import React, { useState, useEffect, useCallback } from 'react';
import { Trophy, Check, X, Dumbbell, Clock3, RefreshCw, Hourglass } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

function fmtSecs(secs) {
    if (secs == null) return '—';
    const m = Math.floor(secs / 60);
    const s = Math.round(secs % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
}
function fmtDistance(m) {
    if (m == null) return '—';
    return m % 1000 === 0 ? `${m / 1000} km` : `${m} m`;
}
function recordLine(r) {
    if (r.kind === 'cardio') {
        const pace = r.duration_seconds && r.distance_m ? ` · ${fmtSecs(Math.round(r.duration_seconds / (r.distance_m / 1000)))}/km` : '';
        return `${fmtDistance(r.distance_m)} en ${fmtSecs(r.duration_seconds)}${pace}`;
    }
    return `${r.exercise_name || 'Ejercicio'} · ${r.weight_kg} kg`;
}

export default function RmReviewPage() {
    const toast = useToast();
    const [records, setRecords] = useState([]);
    const [loading, setLoading] = useState(true);
    const [busyId, setBusyId] = useState(null);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await window.api.cloud.getRmRecords(null, 'pending');
            setRecords(res?.success ? res.data : []);
        } catch (e) {
            console.error('getRmRecords', e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const review = async (id, status) => {
        setBusyId(id);
        try {
            const res = await window.api.cloud.reviewRmRecord(id, status);
            if (res?.success) {
                setRecords(prev => prev.filter(r => r.id !== id));
                toast.success(status === 'accepted' ? 'Récord aceptado' : 'Récord rechazado');
            } else {
                toast.error(res?.error || 'Error al revisar');
            }
        } catch (e) {
            toast.error('Error de red');
        } finally {
            setBusyId(null);
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
                        <Trophy className="text-amber-500" size={32} />
                        RM pendientes
                    </h1>
                    <p className="text-slate-400 mt-1">Récords que tus clientes han registrado y esperan tu validación.</p>
                </div>
                <button onClick={load} disabled={loading}
                    className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-slate-300 text-sm font-medium border border-white/10">
                    <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Actualizar
                </button>
            </div>

            {loading ? (
                <div className="text-center py-16 text-slate-500">Cargando...</div>
            ) : records.length === 0 ? (
                <div className="text-center py-20 bg-slate-900/30 rounded-2xl border border-white/5">
                    <Hourglass className="mx-auto text-slate-600 mb-4" size={44} />
                    <p className="text-slate-400 font-medium">No hay récords pendientes</p>
                    <p className="text-slate-500 text-sm mt-1">Cuando un cliente registre un RM, aparecerá aquí para que lo valides.</p>
                </div>
            ) : (
                <div className="space-y-2.5">
                    {records.map(r => (
                        <div key={r.id} className="flex items-center gap-4 bg-slate-900/40 border border-white/5 rounded-2xl p-4">
                            <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                                r.kind === 'cardio' ? 'bg-cyan-500/15 text-cyan-400' : 'bg-orange-500/15 text-orange-400'
                            }`}>
                                {r.kind === 'cardio' ? <Clock3 size={20} /> : <Dumbbell size={20} />}
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="text-white font-bold truncate">{r.customer_name}</p>
                                <p className="text-slate-300 text-sm truncate">{recordLine(r)}</p>
                                {r.note && <p className="text-slate-500 text-xs mt-0.5 truncate italic">{r.note}</p>}
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                                <button
                                    onClick={() => review(r.id, 'rejected')}
                                    disabled={busyId === r.id}
                                    className="px-3 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 text-sm font-bold flex items-center gap-1.5 disabled:opacity-50"
                                >
                                    <X size={15} /> Rechazar
                                </button>
                                <button
                                    onClick={() => review(r.id, 'accepted')}
                                    disabled={busyId === r.id}
                                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold flex items-center gap-1.5 shadow-lg shadow-emerald-500/20 disabled:opacity-50"
                                >
                                    <Check size={15} /> Aceptar
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
