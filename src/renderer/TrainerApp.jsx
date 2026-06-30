import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import {
    Users, Search, LogOut, Loader2, Dumbbell, Calendar, Award, ChevronRight, ArrowLeft,
    Shield, TrendingUp, TrendingDown, AlertCircle,
} from 'lucide-react';
import { textIncludes } from './lib/text';

// IPC double-wrap unwrap.
function inner(res) {
    if (!res) return null;
    if (res && typeof res === 'object' && 'data' in res && res.success !== undefined) return res.data ?? null;
    return res;
}
function asArray(res) {
    const i = inner(res);
    if (Array.isArray(i)) return i;
    if (i && Array.isArray(i.data)) return i.data;
    return [];
}
const e1rm = (w, reps) => (w && reps ? Math.round(w * (1 + reps / 30)) : null);

// ──────────────────────────────────────────────────────────────────────
// Header
// ──────────────────────────────────────────────────────────────────────
function TitleBar({ onLogout }) {
    return (
        <div
            className="flex items-center justify-between border-b border-white/10 bg-slate-950/80 px-4 backdrop-blur"
            style={{ WebkitAppRegion: 'drag', height: 38 }}
        >
            <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
                <Shield size={14} className="text-cyan-400" />
                <span>Modo entrenador</span>
            </div>
            <div className="flex items-center gap-1" style={{ WebkitAppRegion: 'no-drag' }}>
                <button
                    onClick={onLogout}
                    className="flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold text-slate-400 hover:bg-white/5 hover:text-white"
                    title="Cerrar sesión"
                >
                    <LogOut size={13} /> Salir
                </button>
                <button onClick={() => window.api?.window?.minimize?.()} className="px-3 py-1 text-slate-400 hover:bg-white/5 hover:text-white">─</button>
                <button onClick={() => window.api?.window?.maximize?.()} className="px-3 py-1 text-slate-400 hover:bg-white/5 hover:text-white">▢</button>
                <button onClick={() => window.api?.window?.close?.()} className="px-3 py-1 text-slate-400 hover:bg-red-600 hover:text-white">✕</button>
            </div>
        </div>
    );
}

// ──────────────────────────────────────────────────────────────────────
// Progress panel (reused logic from CustomerProgress, scoped to trainer API)
// ──────────────────────────────────────────────────────────────────────
function ProgressView({ customer }) {
    const { data, isLoading, isError } = useQuery({
        queryKey: ['trainer:workouts', customer.local_id],
        queryFn: async () => {
            const [logsRes, exRes] = await Promise.all([
                window.api.trainer.getCustomerWorkoutLogs(customer.local_id),
                window.api.trainer.getExercises(),
            ]);
            return { logs: asArray(logsRes), exercises: asArray(exRes) };
        },
    });

    const logs = data?.logs || [];
    const exercises = data?.exercises || [];
    const nameById = useMemo(() => new Map(exercises.map((e) => [e.id ?? e.local_id, e.name])), [exercises]);

    const exerciseOptions = useMemo(() => {
        const count = new Map();
        for (const l of logs) {
            if (l.weight_kg == null) continue;
            count.set(l.exercise_id, (count.get(l.exercise_id) || 0) + 1);
        }
        return [...count.keys()]
            .map((id) => ({ id, name: nameById.get(id) || `Ejercicio #${id}`, count: count.get(id) }))
            .sort((a, b) => b.count - a.count);
    }, [logs, nameById]);

    const [picked, setPicked] = useState(null);
    const exId = picked ?? exerciseOptions[0]?.id ?? null;

    const summary = useMemo(() => {
        const days = new Set(logs.map((l) => l.workout_date));
        const last = logs.reduce((m, l) => (l.workout_date > m ? l.workout_date : m), '');
        return { days: days.size, last, sets: logs.length };
    }, [logs]);

    const chart = useMemo(() => {
        if (!exId) return [];
        const byDate = new Map();
        for (const l of logs) {
            if (l.exercise_id !== exId || l.weight_kg == null) continue;
            const cur = byDate.get(l.workout_date) || { date: l.workout_date, maxW: 0, best1rm: 0 };
            if (l.weight_kg > cur.maxW) cur.maxW = l.weight_kg;
            const est = e1rm(l.weight_kg, l.reps_done);
            if (est && est > cur.best1rm) cur.best1rm = est;
            byDate.set(l.workout_date, cur);
        }
        return [...byDate.values()]
            .sort((a, b) => a.date.localeCompare(b.date))
            .map((d) => ({ ...d, label: d.date.slice(5).replace('-', '/') }));
    }, [logs, exId]);

    const pr = chart.length ? Math.max(...chart.map((c) => c.maxW)) : 0;
    const delta = chart.length > 1 ? chart[chart.length - 1].maxW - chart[0].maxW : 0;

    if (isLoading) return <div className="flex items-center justify-center gap-2 py-16 text-slate-400"><Loader2 className="size-5 animate-spin" /> Cargando…</div>;
    if (isError) return <div className="py-16 text-center text-red-400">No se pudieron cargar los datos.</div>;
    if (!logs.length) return (
        <div className="py-16 text-center">
            <Dumbbell className="mx-auto mb-3 size-10 text-slate-700" />
            <p className="text-slate-400">Este socio aún no ha registrado entrenos en la app.</p>
        </div>
    );

    return (
        <div className="space-y-5">
            <div className="grid grid-cols-3 gap-3">
                {[
                    { icon: Calendar, label: 'Días entrenados', value: summary.days, accent: 'text-blue-400' },
                    { icon: Dumbbell, label: 'Series registradas', value: summary.sets, accent: 'text-orange-400' },
                    { icon: Calendar, label: 'Último entreno', value: summary.last ? summary.last.slice(5).replace('-', '/') : '—', accent: 'text-emerald-400' },
                ].map((s) => (
                    <div key={s.label} className="rounded-xl border border-white/10 bg-slate-900/50 p-4">
                        <div className="flex items-center gap-2 text-slate-500">
                            <s.icon size={14} className={s.accent} />
                            <span className="text-[11px] font-bold uppercase tracking-wider">{s.label}</span>
                        </div>
                        <p className="mt-1.5 text-2xl font-black text-white tabular-nums">{s.value}</p>
                    </div>
                ))}
            </div>

            <div className="flex flex-wrap items-center gap-3">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Ejercicio</label>
                <select
                    value={exId ?? ''}
                    onChange={(e) => setPicked(Number(e.target.value))}
                    className="min-w-[240px] rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm font-semibold text-white outline-none focus:border-cyan-500"
                >
                    {exerciseOptions.map((o) => (<option key={o.id} value={o.id}>{o.name} ({o.count})</option>))}
                </select>
                {chart.length > 0 && (
                    <div className="ml-auto flex items-center gap-3">
                        <span className="flex items-center gap-1.5 rounded-lg bg-amber-500/10 px-2.5 py-1 text-sm font-bold text-amber-400">
                            <Award size={15} /> PR {pr} kg
                        </span>
                        {chart.length > 1 && (
                            <span className={`flex items-center gap-1 text-sm font-bold ${delta >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                {delta >= 0 ? <TrendingUp size={15} /> : <TrendingDown size={15} />}
                                {delta > 0 ? '+' : ''}{delta} kg
                            </span>
                        )}
                    </div>
                )}
            </div>

            <div className="h-72 rounded-xl border border-white/10 bg-slate-900/40 p-4">
                {chart.length > 1 ? (
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chart} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                            <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                            <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} unit=" kg" width={48} />
                            <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #ffffff20', borderRadius: 10, fontSize: 12 }} labelStyle={{ color: '#e2e8f0' }} />
                            <Line type="monotone" dataKey="maxW" name="Peso máx" stroke="#06b6d4" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                            <Line type="monotone" dataKey="best1rm" name="1RM est." stroke="#10b981" strokeWidth={2} strokeDasharray="4 3" dot={false} />
                        </LineChart>
                    </ResponsiveContainer>
                ) : (
                    <div className="flex h-full items-center justify-center text-sm text-slate-500">
                        Necesita al menos 2 sesiones de este ejercicio para ver la evolución.
                    </div>
                )}
            </div>
        </div>
    );
}

function PlansView({ customer }) {
    const { data, isLoading } = useQuery({
        queryKey: ['trainer:plans', customer.local_id],
        queryFn: async () => asArray(await window.api.trainer.getCustomerMesocycles(customer.local_id)),
    });
    if (isLoading) return <div className="flex items-center justify-center gap-2 py-12 text-slate-400"><Loader2 className="size-4 animate-spin" /> Cargando planes…</div>;
    if (!data?.length) return (
        <div className="py-12 text-center text-sm text-slate-500">
            <AlertCircle className="mx-auto mb-2 size-8 text-slate-700" />
            Este cliente aún no tiene tablas de entrenamiento.
        </div>
    );
    return (
        <div className="space-y-2">
            {data.map((m) => (
                <div key={m.local_id} className="flex items-center justify-between rounded-xl border border-white/5 bg-slate-900/40 p-3">
                    <div>
                        <p className="font-bold text-white">{m.name}</p>
                        <p className="text-xs text-slate-500">
                            {m.start_date} → {m.end_date || 'Indefinido'} · {m.status || '—'}
                        </p>
                    </div>
                </div>
            ))}
        </div>
    );
}

// ──────────────────────────────────────────────────────────────────────
// Client detail
// ──────────────────────────────────────────────────────────────────────
function ClientDetail({ customer, onBack }) {
    const [tab, setTab] = useState('progress');
    const name = `${customer.first_name || ''} ${customer.last_name || ''}`.trim();
    return (
        <div className="flex h-full flex-col">
            <div className="flex items-center gap-3 border-b border-white/10 bg-slate-950/60 px-5 py-4">
                <button onClick={onBack} className="rounded-lg p-2 text-slate-400 hover:bg-white/5 hover:text-white">
                    <ArrowLeft size={18} />
                </button>
                <div className="flex size-11 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 text-base font-black text-white">
                    {name.charAt(0).toUpperCase() || '?'}
                </div>
                <div className="min-w-0 flex-1">
                    <h2 className="truncate text-lg font-black text-white">{name || 'Sin nombre'}</h2>
                    <p className="truncate text-xs text-slate-500">{customer.email || '—'} {customer.phone ? `· ${customer.phone}` : ''}</p>
                </div>
            </div>
            <div className="flex gap-1 border-b border-white/10 px-5">
                {[['progress', 'Progreso'], ['plans', 'Tablas']].map(([v, label]) => (
                    <button
                        key={v}
                        onClick={() => setTab(v)}
                        className={`-mb-px border-b-2 px-4 py-3 text-sm font-bold transition-colors ${tab === v ? 'border-cyan-500 text-white' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
                    >
                        {label}
                    </button>
                ))}
            </div>
            <div className="flex-1 overflow-y-auto p-5">
                {tab === 'progress' ? <ProgressView customer={customer} /> : <PlansView customer={customer} />}
            </div>
        </div>
    );
}

// ──────────────────────────────────────────────────────────────────────
// Clients list
// ──────────────────────────────────────────────────────────────────────
function ClientsList({ clients, onPick }) {
    const [search, setSearch] = useState('');
    const filtered = useMemo(() =>
        (clients || [])
            .filter((c) => textIncludes(`${c.first_name} ${c.last_name}`, search))
            .sort((a, b) => `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`))
    , [clients, search]);
    return (
        <div className="flex h-full flex-col">
            <div className="space-y-3 border-b border-white/10 p-5">
                <h2 className="text-xl font-black text-white">Mis clientes</h2>
                <div className="relative">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                        value={search} onChange={(e) => setSearch(e.target.value)}
                        placeholder="Buscar cliente…"
                        className="w-full rounded-lg border border-white/10 bg-slate-900 py-2 pl-9 pr-3 text-sm text-white outline-none focus:border-cyan-500"
                    />
                </div>
                <p className="text-xs text-slate-500">{filtered.length} cliente{filtered.length === 1 ? '' : 's'}</p>
            </div>
            <div className="flex-1 overflow-y-auto p-3">
                {filtered.length === 0 ? (
                    <div className="py-12 text-center">
                        <Users className="mx-auto mb-3 size-10 text-slate-700" />
                        <p className="text-sm text-slate-500">
                            {clients?.length === 0 ? 'Aún no te han asignado clientes.' : 'Sin coincidencias.'}
                        </p>
                        {clients?.length === 0 && (
                            <p className="mt-1 text-xs text-slate-600">Pide al jefe que te asigne clientes desde su panel.</p>
                        )}
                    </div>
                ) : filtered.map((c) => (
                    <button
                        key={c.local_id}
                        onClick={() => onPick(c)}
                        className="mb-1 flex w-full items-center gap-3 rounded-lg border border-transparent p-3 text-left transition hover:border-white/10 hover:bg-white/5"
                    >
                        <div className="flex size-10 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500/30 to-blue-600/30 text-sm font-black text-cyan-300">
                            {(c.first_name || '?').charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-bold text-white">{c.first_name} {c.last_name}</p>
                            <p className="truncate text-xs text-slate-500">{c.email || c.phone || '—'}</p>
                        </div>
                        <ChevronRight size={16} className="text-slate-600" />
                    </button>
                ))}
            </div>
        </div>
    );
}

// ──────────────────────────────────────────────────────────────────────
// Root
// ──────────────────────────────────────────────────────────────────────
export default function TrainerApp() {
    const [picked, setPicked] = useState(null);

    const { data: profile } = useQuery({
        queryKey: ['trainer:profile'],
        queryFn: async () => inner(await window.api.trainer.getProfile()) || null,
    });

    const { data: clients, isLoading } = useQuery({
        queryKey: ['trainer:clients'],
        queryFn: async () => asArray(await window.api.trainer.getMyClients()),
    });

    const onLogout = async () => {
        if (!window.confirm('¿Cerrar sesión?')) return;
        await window.api.trainer.signOut();
    };

    return (
        <div className="flex h-screen flex-col bg-slate-950 text-white">
            <TitleBar onLogout={onLogout} />
            <div className="flex items-center gap-2 border-b border-white/10 bg-slate-900/40 px-5 py-3">
                <div className="flex size-9 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 font-black">
                    {(profile?.full_name || profile?.email || '?').charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                    <p className="truncate text-sm font-bold">{profile?.full_name || profile?.email || 'Entrenador'}</p>
                    <p className="truncate text-xs text-slate-400">{profile?.gym_name || 'Mi gimnasio'}</p>
                </div>
            </div>

            <div className="grid flex-1 min-h-0 grid-cols-[360px_1fr]">
                <aside className="border-r border-white/10 bg-slate-950/60">
                    {isLoading ? (
                        <div className="flex h-full items-center justify-center gap-2 text-slate-400">
                            <Loader2 className="size-5 animate-spin" /> Cargando clientes…
                        </div>
                    ) : (
                        <ClientsList clients={clients} onPick={setPicked} />
                    )}
                </aside>
                <main className="min-w-0">
                    {picked ? (
                        <ClientDetail customer={picked} onBack={() => setPicked(null)} />
                    ) : (
                        <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-slate-500">
                            <Users size={40} className="text-slate-700" />
                            <p className="font-bold">Selecciona un cliente</p>
                            <p className="max-w-sm text-sm text-slate-600">
                                Verás su progreso (gráfica de evolución por ejercicio) y sus tablas de entrenamiento actuales.
                            </p>
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
}
