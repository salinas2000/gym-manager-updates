import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    Monitor, Plus, Copy, Check, RefreshCcw, Trash2, PencilLine, X, Loader2,
    CircleAlert, ShieldCheck, Wifi, WifiOff, ExternalLink,
} from 'lucide-react';

const PANEL_URL = 'https://display.gymanagerpro.com';
const VERCEL_FALLBACK = 'https://gym-display-app.vercel.app';

export default function SettingsScreens() {
    const [devices, setDevices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState(null);

    const [pairOpen, setPairOpen] = useState(false);
    const [renamingId, setRenamingId] = useState(null);
    const [renamingValue, setRenamingValue] = useState('');
    const [confirmRevoke, setConfirmRevoke] = useState(null);

    const load = useCallback(async () => {
        setLoading(true); setErr(null);
        try {
            if (!window.api?.cloud?.display?.listDevices) {
                throw new Error('El API de pantallas no está disponible. Reinicia la aplicación.');
            }
            const res = await window.api.cloud.display.listDevices();
            if (!res?.success) throw new Error(res?.error || 'Error');
            setDevices(Array.isArray(res.data) ? res.data : []);
        } catch (e) {
            setErr(e.message || String(e));
            setDevices([]);
        } finally { setLoading(false); }
    }, []);

    useEffect(() => { load(); }, [load]);

    const handleRename = async (id) => {
        const name = renamingValue.trim();
        if (!name) { setRenamingId(null); return; }
        const res = await window.api.cloud.display.renameDevice(id, name);
        setRenamingId(null); setRenamingValue('');
        if (res.success) load();
        else setErr(res.error || 'Error al renombrar');
    };

    const handleRevoke = async (id) => {
        setConfirmRevoke(null);
        const res = await window.api.cloud.display.revokeDevice(id);
        if (res.success) load();
        else setErr(res.error || 'Error al revocar');
    };

    const safeDevices = Array.isArray(devices) ? devices : [];
    const active = safeDevices.filter(d => !d.revoked_at);
    const revoked = safeDevices.filter(d => d.revoked_at);

    return (
        <div className="space-y-6 animate-in fade-in zoom-in-95 duration-200">

            {/* HEADER + how it works */}
            <div className="bg-slate-900/50 rounded-2xl p-6 border border-white/5 shadow-xl glass-panel relative overflow-hidden">
                <div className="absolute top-0 right-0 p-32 bg-indigo-600/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
                <div className="flex items-start justify-between gap-4 mb-5">
                    <div>
                        <h3 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
                            <Monitor className="text-indigo-400" /> Pantallas del gimnasio
                        </h3>
                        <p className="text-sm text-slate-400 max-w-2xl">
                            Enseña rankings, PRs y quién está en clase ahora mismo en cualquier tele o
                            monitor que tengas en la sala. Solo necesitas un navegador — no hace falta
                            instalar nada.
                        </p>
                    </div>
                    <button
                        onClick={() => setPairOpen(true)}
                        className="shrink-0 bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg hover:shadow-indigo-500/20 transition-all"
                    >
                        <Plus size={18} /> Vincular pantalla
                    </button>
                </div>

                <ol className="text-sm text-slate-300 space-y-1.5 pl-5 list-decimal marker:text-indigo-400">
                    <li>En la tele, abre <a href={PANEL_URL} target="_blank" rel="noreferrer" className="text-indigo-400 hover:underline inline-flex items-center gap-1">{PANEL_URL} <ExternalLink size={12} /></a></li>
                    <li>Pulsa aquí "Vincular pantalla" y aparecerá un código de 8 caracteres</li>
                    <li>Escríbelo en la tele y confirma en este ordenador</li>
                    <li>Listo — la tele empieza a mostrar los datos del gimnasio</li>
                </ol>
            </div>

            {/* ERROR */}
            {err && (
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300 flex items-center gap-2">
                    <CircleAlert size={16} /> {err}
                    <button onClick={() => setErr(null)} className="ml-auto text-red-400 hover:text-red-300"><X size={16} /></button>
                </div>
            )}

            {/* ACTIVE DEVICES */}
            <div className="bg-slate-900/50 rounded-2xl border border-white/5 shadow-xl overflow-hidden">
                <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
                    <h4 className="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                        <ShieldCheck size={14} className="text-emerald-400" /> Pantallas activas
                        <span className="text-slate-500">({active.length})</span>
                    </h4>
                    <button onClick={load} disabled={loading} className="text-xs text-slate-400 hover:text-white flex items-center gap-1 transition-colors">
                        {loading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCcw size={12} />} Refrescar
                    </button>
                </div>

                {loading && !devices.length ? (
                    <div className="p-8 text-center text-slate-500 flex items-center justify-center gap-2">
                        <Loader2 size={16} className="animate-spin" /> Cargando…
                    </div>
                ) : active.length === 0 ? (
                    <div className="p-8 text-center">
                        <Monitor size={32} className="mx-auto text-slate-700 mb-2" />
                        <p className="text-slate-500 text-sm">Todavía no has vinculado ninguna pantalla.</p>
                        <button
                            onClick={() => setPairOpen(true)}
                            className="mt-3 text-indigo-400 hover:text-indigo-300 text-sm font-semibold"
                        >
                            Vincular la primera →
                        </button>
                    </div>
                ) : (
                    <ul className="divide-y divide-white/5">
                        {active.map(d => (
                            <li key={d.id} className="px-6 py-4 flex items-center gap-4 hover:bg-white/5 transition-colors">
                                <DeviceStatusDot lastSeenAt={d.last_seen_at} />
                                <div className="min-w-0 flex-1">
                                    {renamingId === d.id ? (
                                        <div className="flex items-center gap-2">
                                            <input
                                                autoFocus
                                                value={renamingValue}
                                                onChange={(e) => setRenamingValue(e.target.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') handleRename(d.id);
                                                    if (e.key === 'Escape') { setRenamingId(null); setRenamingValue(''); }
                                                }}
                                                maxLength={60}
                                                className="bg-slate-950 border border-indigo-500/50 rounded-lg px-3 py-1.5 text-white text-sm w-64 outline-none"
                                            />
                                            <button onClick={() => handleRename(d.id)} className="text-emerald-400 hover:text-emerald-300"><Check size={16} /></button>
                                            <button onClick={() => { setRenamingId(null); setRenamingValue(''); }} className="text-slate-500 hover:text-slate-300"><X size={16} /></button>
                                        </div>
                                    ) : (
                                        <>
                                            <p className="font-bold text-white truncate">{d.name}</p>
                                            <p className="text-xs text-slate-500">
                                                {formatLastSeen(d.last_seen_at)} · vinculada {formatDate(d.created_at)}
                                            </p>
                                        </>
                                    )}
                                </div>
                                {renamingId !== d.id && (
                                    <div className="flex items-center gap-1">
                                        <button
                                            title="Renombrar"
                                            onClick={() => { setRenamingId(d.id); setRenamingValue(d.name); }}
                                            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
                                        >
                                            <PencilLine size={16} />
                                        </button>
                                        <button
                                            title="Revocar"
                                            onClick={() => setConfirmRevoke(d)}
                                            className="p-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                )}
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            {/* REVOKED */}
            {revoked.length > 0 && (
                <details className="bg-slate-900/30 rounded-2xl border border-white/5 group">
                    <summary className="px-6 py-3 cursor-pointer text-sm text-slate-500 hover:text-slate-300 flex items-center gap-2">
                        <span className="opacity-70">🗄</span> Pantallas revocadas <span className="text-slate-600">({revoked.length})</span>
                    </summary>
                    <ul className="divide-y divide-white/5">
                        {revoked.map(d => (
                            <li key={d.id} className="px-6 py-3 flex items-center gap-3 text-sm">
                                <span className="w-2 h-2 rounded-full bg-slate-700" />
                                <span className="text-slate-400 line-through">{d.name}</span>
                                <span className="ml-auto text-xs text-slate-600">revocada {formatDate(d.revoked_at)}</span>
                            </li>
                        ))}
                    </ul>
                </details>
            )}

            {/* PAIRING MODAL */}
            {pairOpen && (
                <PairModal
                    onClose={() => { setPairOpen(false); load(); }}
                />
            )}

            {/* REVOKE CONFIRM */}
            {confirmRevoke && (
                <ConfirmRevoke
                    device={confirmRevoke}
                    onCancel={() => setConfirmRevoke(null)}
                    onConfirm={() => handleRevoke(confirmRevoke.id)}
                />
            )}
        </div>
    );
}

// ────────────────────────────────────────────────────────────
// PAIRING MODAL
// ────────────────────────────────────────────────────────────

function PairModal({ onClose }) {
    const [name, setName] = useState('');
    const [phase, setPhase] = useState('start'); // start | code | done | error
    const [code, setCode] = useState('');
    const [expiresAt, setExpiresAt] = useState(null);
    const [secondsLeft, setSecondsLeft] = useState(600);
    const [err, setErr] = useState(null);
    const [busy, setBusy] = useState(false);
    const [copied, setCopied] = useState(false);

    // Countdown
    useEffect(() => {
        if (phase !== 'code' || !expiresAt) return;
        const tick = () => {
            const ms = new Date(expiresAt).getTime() - Date.now();
            const s = Math.max(0, Math.floor(ms / 1000));
            setSecondsLeft(s);
            if (s === 0) setPhase('expired');
        };
        tick();
        const id = setInterval(tick, 1000);
        return () => clearInterval(id);
    }, [phase, expiresAt]);

    const generate = async () => {
        setBusy(true); setErr(null);
        const res = await window.api.cloud.display.pairStart(name.trim() || null);
        setBusy(false);
        if (!res.success) { setErr(res.error || 'Error'); setPhase('error'); return; }
        setCode(res.data.code);
        setExpiresAt(res.data.expires_at);
        setPhase('code');
    };

    const authorize = async () => {
        setBusy(true); setErr(null);
        const res = await window.api.cloud.display.pairAuthorize(code, name.trim() || null);
        setBusy(false);
        if (!res.success) { setErr(res.error || 'Error'); return; }
        setPhase('done');
    };

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(code);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch { /* ignore */ }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
            <div className="bg-slate-900 border border-white/10 rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <Monitor className="text-indigo-400" size={20} />
                        {phase === 'done' ? '¡Pantalla vinculada!' : 'Vincular pantalla'}
                    </h3>
                    <button onClick={onClose} className="text-slate-500 hover:text-white p-1 rounded-lg hover:bg-white/5 transition-colors">
                        <X size={18} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6">
                    {phase === 'start' && (
                        <div className="space-y-5">
                            <div>
                                <label className="text-sm font-semibold text-slate-300 block mb-2">
                                    Nombre de la pantalla <span className="text-slate-500 font-normal">(opcional)</span>
                                </label>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    maxLength={60}
                                    placeholder="Ej: TV sala grande"
                                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-indigo-500 outline-none"
                                />
                                <p className="text-xs text-slate-500 mt-2">
                                    Te ayuda a identificarla si tienes varias.
                                </p>
                            </div>
                            {err && (
                                <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                                    {err}
                                </div>
                            )}
                            <button
                                onClick={generate}
                                disabled={busy}
                                className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-4 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all"
                            >
                                {busy ? <><Loader2 size={16} className="animate-spin" /> Generando…</> : <>Generar código</>}
                            </button>
                        </div>
                    )}

                    {phase === 'code' && (
                        <div className="space-y-5">
                            <p className="text-sm text-slate-400">
                                Escribe este código en la tele. Cuando lo tengas, pulsa "Autorizar" abajo.
                            </p>
                            <div
                                onClick={copy}
                                className="cursor-pointer group bg-slate-950 border-2 border-dashed border-indigo-500/40 hover:border-indigo-500/70 rounded-xl px-6 py-8 text-center transition-colors"
                            >
                                <p className="text-xs uppercase tracking-widest text-slate-500 mb-3">Código de vinculación</p>
                                <p className="text-5xl font-black font-mono tracking-[0.3em] text-white select-all">
                                    {code}
                                </p>
                                <p className="text-xs text-slate-400 mt-4 flex items-center justify-center gap-1.5 group-hover:text-indigo-400 transition-colors">
                                    {copied ? <><Check size={12} /> Copiado</> : <><Copy size={12} /> Click para copiar</>}
                                </p>
                            </div>

                            <div className="flex items-center justify-between text-xs text-slate-500">
                                <span>Caduca en {formatMMSS(secondsLeft)}</span>
                                <span className={secondsLeft < 60 ? 'text-amber-400' : ''}>
                                    {secondsLeft < 60 ? '⚠ Poco tiempo' : 'Válido'}
                                </span>
                            </div>

                            <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                <div
                                    className={`h-full transition-all duration-1000 ${secondsLeft < 60 ? 'bg-amber-500' : 'bg-indigo-500'}`}
                                    style={{ width: `${(secondsLeft / 600) * 100}%` }}
                                />
                            </div>

                            {err && (
                                <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                                    {err}
                                </div>
                            )}

                            <button
                                onClick={authorize}
                                disabled={busy}
                                className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white px-4 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-500/20"
                            >
                                {busy ? <><Loader2 size={16} className="animate-spin" /> Autorizando…</> : <><Check size={16} /> Autorizar pantalla</>}
                            </button>
                            <p className="text-xs text-slate-500 text-center">
                                Al pulsar "Autorizar" la tele podrá acceder a los datos del gimnasio.
                            </p>
                        </div>
                    )}

                    {phase === 'expired' && (
                        <div className="text-center space-y-4 py-4">
                            <div className="w-16 h-16 rounded-full bg-amber-500/10 mx-auto flex items-center justify-center">
                                <CircleAlert className="text-amber-400" size={32} />
                            </div>
                            <h4 className="text-white font-bold">El código ha caducado</h4>
                            <p className="text-sm text-slate-400">Genera uno nuevo para vincular la pantalla.</p>
                            <button
                                onClick={() => { setPhase('start'); setCode(''); setErr(null); }}
                                className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2.5 rounded-xl font-bold"
                            >
                                Generar otro
                            </button>
                        </div>
                    )}

                    {phase === 'done' && (
                        <div className="text-center space-y-4 py-4">
                            <div className="w-16 h-16 rounded-full bg-emerald-500/10 mx-auto flex items-center justify-center animate-in zoom-in-50 duration-300">
                                <Check className="text-emerald-400" size={32} />
                            </div>
                            <h4 className="text-white font-bold text-lg">Todo listo</h4>
                            <p className="text-sm text-slate-400 max-w-sm mx-auto">
                                La pantalla ya está autorizada. En unos segundos empezará a mostrar los rankings, sala y récords en directo.
                            </p>
                            <button
                                onClick={onClose}
                                className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2.5 rounded-xl font-bold"
                            >
                                Cerrar
                            </button>
                        </div>
                    )}

                    {phase === 'error' && (
                        <div className="text-center space-y-4 py-4">
                            <div className="w-16 h-16 rounded-full bg-red-500/10 mx-auto flex items-center justify-center">
                                <CircleAlert className="text-red-400" size={32} />
                            </div>
                            <h4 className="text-white font-bold">No se pudo generar el código</h4>
                            <p className="text-sm text-red-300">{err}</p>
                            <button
                                onClick={() => { setPhase('start'); setErr(null); }}
                                className="bg-slate-800 hover:bg-slate-700 text-white px-6 py-2.5 rounded-xl font-bold"
                            >
                                Reintentar
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// ────────────────────────────────────────────────────────────
// REVOKE CONFIRM
// ────────────────────────────────────────────────────────────

function ConfirmRevoke({ device, onCancel, onConfirm }) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
            <div className="bg-slate-900 border border-red-500/20 rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6 animate-in zoom-in-95 duration-200">
                <div className="flex items-start gap-4 mb-4">
                    <div className="w-11 h-11 rounded-full bg-red-500/10 flex items-center justify-center shrink-0">
                        <Trash2 className="text-red-400" size={20} />
                    </div>
                    <div className="min-w-0">
                        <h3 className="font-bold text-white mb-1">Revocar "{device.name}"</h3>
                        <p className="text-sm text-slate-400">
                            La pantalla dejará de mostrar los datos del gimnasio. Puedes vincularla de nuevo cuando quieras.
                        </p>
                    </div>
                </div>
                <div className="flex justify-end gap-2">
                    <button onClick={onCancel} className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-sm font-semibold">
                        Cancelar
                    </button>
                    <button onClick={onConfirm} className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-bold">
                        Revocar
                    </button>
                </div>
            </div>
        </div>
    );
}

// ────────────────────────────────────────────────────────────
// HELPERS
// ────────────────────────────────────────────────────────────

function DeviceStatusDot({ lastSeenAt }) {
    if (!lastSeenAt) {
        return <span title="Nunca se ha conectado" className="w-2.5 h-2.5 rounded-full bg-slate-600 shrink-0" />;
    }
    const ageMs = Date.now() - new Date(lastSeenAt).getTime();
    const online = ageMs < 90_000; // <90s → online
    return (
        <span
            title={online ? 'Online' : 'Fuera de línea'}
            className={`w-2.5 h-2.5 rounded-full shrink-0 ${online ? 'bg-emerald-500 shadow-emerald-500/50 shadow-lg' : 'bg-slate-600'}`}
        />
    );
}

function formatLastSeen(ts) {
    if (!ts) return 'Nunca se ha conectado';
    const ageMs = Date.now() - new Date(ts).getTime();
    if (ageMs < 90_000) return 'Online ahora';
    if (ageMs < 3600_000) return `Vista hace ${Math.floor(ageMs / 60_000)} min`;
    if (ageMs < 86400_000) return `Vista hace ${Math.floor(ageMs / 3600_000)} h`;
    return `Vista ${formatDate(ts)}`;
}

function formatDate(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatMMSS(s) {
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${String(r).padStart(2, '0')}`;
}
