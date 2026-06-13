import React, { useEffect, useState } from 'react';
import { X, Users, Activity, CalendarCheck, Trophy, Cloud, Lock, RefreshCw, Wifi } from 'lucide-react';
import { cn } from '../../../lib/utils';

function relTime(ts) {
    if (!ts) return 'nunca';
    const mins = (Date.now() - new Date(ts).getTime()) / 60000;
    if (mins < 1) return 'ahora mismo';
    if (mins < 60) return `hace ${Math.round(mins)} min`;
    const h = mins / 60;
    if (h < 24) return `hace ${Math.round(h)} h`;
    return `hace ${Math.round(h / 24)} d`;
}

function presence(gym) {
    if (gym.active === false) return { dot: 'bg-slate-600', text: 'text-slate-500', label: 'Desactivada' };
    if (!gym.last_seen) return { dot: 'bg-zinc-600', text: 'text-zinc-500', label: 'Nunca conectado' };
    const mins = (Date.now() - new Date(gym.last_seen).getTime()) / 60000;
    if (mins < 15) return { dot: 'bg-emerald-500', text: 'text-emerald-400', label: 'Online', pulse: true };
    return { dot: 'bg-slate-500', text: 'text-slate-400', label: `Offline · ${relTime(gym.last_seen)}` };
}

function MiniStat({ icon: Icon, label, value, color }) {
    return (
        <div className="bg-slate-950/50 border border-white/5 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1.5">
                <Icon size={14} className={color} />
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{label}</span>
            </div>
            <p className="text-2xl font-black text-white tabular-nums">{value}</p>
        </div>
    );
}

export function GymDetailModal({ gym, onClose }) {
    const [detail, setDetail] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!gym) return;
        let alive = true;
        setLoading(true);
        setDetail(null);
        window.api.admin.getGymDetail(gym.gym_id)
            .then((res) => { if (alive) setDetail(res?.success ? res.data : null); })
            .catch(() => { if (alive) setDetail(null); })
            .finally(() => { if (alive) setLoading(false); });
        return () => { alive = false; };
    }, [gym]);

    if (!gym) return null;
    const p = presence(gym);

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[80] flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl animate-in fade-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className="p-5 border-b border-white/10 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <div className="flex items-center gap-2">
                            <div className={cn('w-2 h-2 rounded-full', p.dot, p.pulse && 'animate-pulse')} />
                            <h2 className="text-lg font-black text-white truncate">{gym.gym_name || 'Sin nombre'}</h2>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                            <code className="text-[10px] text-indigo-400 font-mono bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/10">{gym.license_key}</code>
                            <span className={cn('text-[11px] font-bold', p.text)}>{p.label}</span>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-white shrink-0"><X size={20} /></button>
                </div>

                {/* Meta row */}
                <div className="px-5 py-3 border-b border-white/5 grid grid-cols-3 gap-3 text-xs">
                    <div>
                        <p className="text-[9px] uppercase tracking-widest text-slate-500 font-bold mb-0.5">Versión</p>
                        <p className="font-mono text-white">v{gym.app_version || '—'}</p>
                    </div>
                    <div>
                        <p className="text-[9px] uppercase tracking-widest text-slate-500 font-bold mb-0.5">Expira</p>
                        <p className="text-white">{gym.expires_at ? new Date(gym.expires_at).toLocaleDateString() : 'Vitalicia'}</p>
                    </div>
                    <div className="min-w-0">
                        <p className="text-[9px] uppercase tracking-widest text-slate-500 font-bold mb-0.5">Hardware</p>
                        <p className="font-mono text-slate-400 truncate flex items-center gap-1">
                            {gym.hardware_id ? <><Lock size={10} /> {gym.hardware_id.substring(0, 10)}…</> : <span className="text-orange-400">sin activar</span>}
                        </p>
                    </div>
                </div>

                {/* Cloud stats */}
                <div className="p-5">
                    {loading ? (
                        <div className="py-8 flex justify-center"><RefreshCw className="animate-spin text-indigo-500" size={24} /></div>
                    ) : !detail ? (
                        <p className="py-6 text-center text-sm text-slate-500">No se pudo cargar la información del gimnasio.</p>
                    ) : (
                        <>
                            <div className="grid grid-cols-2 gap-3">
                                <MiniStat icon={Users} label="Clientes" value={detail.customers} color="text-blue-400" />
                                <MiniStat icon={CalendarCheck} label="Reservas próximas" value={detail.upcomingBookings} color="text-violet-400" />
                                <MiniStat icon={Trophy} label="RM pendientes" value={detail.rmPending} color="text-amber-400" />
                                <MiniStat icon={Activity} label="Último entreno" value={relTime(detail.lastActivity)} color="text-emerald-400" />
                            </div>
                            <div className="mt-3 flex items-center gap-2 text-[11px] text-slate-500">
                                <Cloud size={13} /> Última sincronización: <span className="text-slate-300 font-medium">{relTime(detail.lastSync)}</span>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
