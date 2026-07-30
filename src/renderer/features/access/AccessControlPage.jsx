import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    ScanLine, CheckCircle2, XCircle, AlertTriangle, Users, DoorOpen,
    Loader2, RefreshCcw, KeyRound,
} from 'lucide-react';

/**
 * Control de acceso — pantalla de recepción.
 *
 * El socio teclea o escanea su código y se ve al instante si puede pasar. El
 * foco vuelve solo al input tras cada lectura para poder encadenar entradas sin
 * tocar el ratón (un lector de códigos actúa como teclado y envía Enter).
 */
export default function AccessControlPage() {
    const [code, setCode] = useState('');
    const [checking, setChecking] = useState(false);
    const [result, setResult] = useState(null);
    const [recent, setRecent] = useState([]);
    const [stats, setStats] = useState({ intentos: 0, permitidos: 0, denegados: 0, sociosUnicos: 0 });
    const [generating, setGenerating] = useState(false);
    const inputRef = useRef(null);
    const clearTimer = useRef(null);

    const refresh = useCallback(async () => {
        const [r, s] = await Promise.all([
            window.api.access.getRecent(25),
            window.api.access.getTodayStats(),
        ]);
        if (r?.success) setRecent(r.data || []);
        if (s?.success) setStats(s.data);
    }, []);

    useEffect(() => { refresh(); inputRef.current?.focus(); }, [refresh]);
    useEffect(() => () => clearTimeout(clearTimer.current), []);

    const submit = async (e) => {
        e?.preventDefault();
        const value = code.trim();
        if (!value || checking) return;
        setChecking(true);
        try {
            const res = await window.api.access.checkIn({ code: value });
            if (res?.success) {
                setResult(res.data);
                // El resultado se borra solo: la pantalla queda lista para el
                // siguiente socio sin que nadie tenga que pulsar nada.
                clearTimeout(clearTimer.current);
                clearTimer.current = setTimeout(() => setResult(null), 6000);
            } else {
                setResult({ allowed: false, message: res?.error || 'Error al validar', customer: null });
            }
            setCode('');
            refresh();
        } finally {
            setChecking(false);
            inputRef.current?.focus();
        }
    };

    const generarCodigos = async () => {
        setGenerating(true);
        try {
            const res = await window.api.access.backfillCodes();
            if (res?.success) {
                alert(`Códigos generados: ${res.data.generados} de ${res.data.total} socios sin código.`);
            }
        } finally { setGenerating(false); }
    };

    const ok = result?.allowed;
    const conDeuda = result?.reason === 'ok_con_deuda';

    return (
        <div className="p-8 space-y-6 animate-in fade-in duration-200">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-black text-white flex items-center gap-3">
                        <DoorOpen className="text-emerald-400" /> Control de acceso
                    </h1>
                    <p className="text-sm text-slate-400 mt-1">
                        El socio teclea o escanea su código y se comprueba si puede pasar.
                    </p>
                </div>
                <button
                    onClick={generarCodigos}
                    disabled={generating}
                    className="shrink-0 bg-slate-800 hover:bg-slate-700 text-slate-200 px-4 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 transition-colors disabled:opacity-50"
                >
                    {generating ? <Loader2 size={15} className="animate-spin" /> : <KeyRound size={15} />}
                    Generar códigos que falten
                </button>
            </div>

            {/* Métricas del día */}
            <div className="grid grid-cols-4 gap-3">
                <Stat icon={Users} label="Socios distintos" value={stats.sociosUnicos} color="text-blue-400" />
                <Stat icon={CheckCircle2} label="Accesos permitidos" value={stats.permitidos} color="text-emerald-400" />
                <Stat icon={XCircle} label="Denegados" value={stats.denegados} color="text-red-400" />
                <Stat icon={ScanLine} label="Lecturas hoy" value={stats.intentos} color="text-slate-400" />
            </div>

            {/* Lector */}
            <form onSubmit={submit} className="bg-slate-900/50 rounded-2xl p-6 border border-white/5 shadow-xl">
                <label className="text-xs uppercase font-bold text-slate-400 tracking-widest block mb-3">
                    Código del socio
                </label>
                <div className="flex gap-3">
                    <input
                        ref={inputRef}
                        value={code}
                        onChange={(e) => setCode(e.target.value.toUpperCase())}
                        placeholder="Ej. A7K2M9"
                        autoComplete="off"
                        spellCheck={false}
                        className="flex-1 bg-slate-950 border border-white/10 rounded-xl px-5 py-4 text-2xl font-mono font-bold tracking-[0.3em] text-white outline-none focus:border-emerald-500 transition-colors"
                    />
                    <button
                        type="submit"
                        disabled={checking || !code.trim()}
                        className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white px-8 rounded-xl font-bold flex items-center gap-2 transition-colors"
                    >
                        {checking ? <Loader2 size={18} className="animate-spin" /> : <ScanLine size={18} />}
                        Validar
                    </button>
                </div>

                {result && (
                    <div className={`mt-5 rounded-xl p-5 border flex items-center gap-4 animate-in fade-in zoom-in-95 duration-150 ${
                        !ok ? 'bg-red-500/10 border-red-500/30'
                            : conDeuda ? 'bg-amber-500/10 border-amber-500/30'
                                : 'bg-emerald-500/10 border-emerald-500/30'}`}>
                        {!ok ? <XCircle className="text-red-400 shrink-0" size={36} />
                            : conDeuda ? <AlertTriangle className="text-amber-400 shrink-0" size={36} />
                                : <CheckCircle2 className="text-emerald-400 shrink-0" size={36} />}
                        <div className="min-w-0">
                            <p className={`text-xl font-black ${!ok ? 'text-red-300' : conDeuda ? 'text-amber-300' : 'text-emerald-300'}`}>
                                {result.customer
                                    ? `${result.customer.first_name} ${result.customer.last_name || ''}`.trim()
                                    : 'Sin identificar'}
                            </p>
                            <p className="text-sm text-slate-400 mt-0.5">{result.message}</p>
                        </div>
                    </div>
                )}
            </form>

            {/* Historial */}
            <div className="bg-slate-900/50 rounded-2xl border border-white/5 shadow-xl overflow-hidden">
                <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
                    <h4 className="text-sm font-bold uppercase tracking-wider text-slate-300">Últimos accesos</h4>
                    <button onClick={refresh} className="text-xs text-slate-400 hover:text-white flex items-center gap-1 transition-colors">
                        <RefreshCcw size={12} /> Refrescar
                    </button>
                </div>
                {recent.length === 0 ? (
                    <p className="p-8 text-center text-slate-500 text-sm">Todavía no hay accesos registrados.</p>
                ) : (
                    <ul className="divide-y divide-white/5 max-h-80 overflow-y-auto">
                        {recent.map((r) => (
                            <li key={r.id} className="px-6 py-3 flex items-center gap-3 text-sm">
                                {r.allowed
                                    ? <CheckCircle2 size={15} className="text-emerald-500 shrink-0" />
                                    : <XCircle size={15} className="text-red-500 shrink-0" />}
                                <span className="text-white font-medium truncate flex-1">
                                    {r.first_name ? `${r.first_name} ${r.last_name || ''}`.trim() : (r.code_used || '—')}
                                </span>
                                <span className="text-slate-500 text-xs truncate">{r.reason}</span>
                                <span className="text-slate-600 text-xs tabular-nums shrink-0">
                                    {new Date(r.created_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                                </span>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
}

function Stat({ icon: Icon, label, value, color }) {
    return (
        <div className="bg-slate-900/50 rounded-xl p-4 border border-white/5">
            <div className="flex items-center gap-2 mb-1">
                <Icon size={13} className={color} />
                <span className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">{label}</span>
            </div>
            <p className="text-2xl font-black text-white tabular-nums">{value}</p>
        </div>
    );
}
