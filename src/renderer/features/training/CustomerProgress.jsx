import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Dumbbell, Calendar, Award, Loader2, TrendingUp, TrendingDown } from 'lucide-react';

// Epley estimated 1RM
const e1rm = (w, reps) => (w && reps ? Math.round(w * (1 + reps / 30)) : null);

function StatCard({ icon: Icon, label, value, accent = 'text-blue-400' }) {
    return (
        <div className="rounded-xl border border-white/10 bg-slate-900/50 p-4">
            <div className="flex items-center gap-2 text-slate-500">
                <Icon size={14} className={accent} />
                <span className="text-[11px] font-bold uppercase tracking-wider">{label}</span>
            </div>
            <p className="mt-1.5 text-2xl font-black text-white tabular-nums">{value}</p>
        </div>
    );
}

/**
 * Read-only view of a customer's logged workouts (from the mobile app).
 * Reads via the owner-admin Edge Function (cloud), so it works even though the
 * logs never live in the desktop's local SQLite.
 */
export default function CustomerProgress({ customerId }) {
    const { data, isLoading, isError } = useQuery({
        queryKey: ['workout-logs', customerId],
        enabled: !!customerId,
        queryFn: async () => {
            const lic = await window.api.license.getData();
            const gymId = lic?.data?.gym_id ?? lic?.gym_id;
            const [logsRes, exRes] = await Promise.all([
                window.api.cloud.getCustomerWorkoutLogs(gymId, customerId),
                window.api.training.getExercises(),
            ]);
            // IPC double-wraps: { success, data: <handlerResult> }. The handler
            // itself returns { success, data: [...] }. So the real array can be
            // 1, 2 or 3 levels deep depending on the path — pick the first array.
            const pickArray = (x) => {
                if (Array.isArray(x)) return x;
                if (x && typeof x === 'object') {
                    if (Array.isArray(x.data)) return x.data;
                    if (x.data && Array.isArray(x.data.data)) return x.data.data;
                }
                return [];
            };
            return { logs: pickArray(logsRes), exercises: pickArray(exRes) };
        },
    });

    const logs = data?.logs || [];
    const exercises = data?.exercises || [];
    const nameById = useMemo(() => new Map(exercises.map((e) => [e.id, e.name])), [exercises]);

    // Exercises that appear in the logs WITH weight (strength), most-logged first.
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

    // Per-date best set for the selected exercise.
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

    if (isLoading) {
        return (
            <div className="flex items-center justify-center gap-2 py-20 text-slate-400">
                <Loader2 className="size-6 animate-spin" /> Cargando entrenos del socio…
            </div>
        );
    }
    if (isError) {
        return <div className="py-20 text-center text-red-400">No se pudieron cargar los entrenos.</div>;
    }
    if (!logs.length) {
        return (
            <div className="py-20 text-center">
                <Dumbbell className="mx-auto mb-3 size-10 text-slate-700" />
                <p className="text-slate-400">Este socio aún no ha registrado entrenos en la app.</p>
            </div>
        );
    }

    return (
        <div className="space-y-5">
            {/* Resumen */}
            <div className="grid grid-cols-3 gap-3">
                <StatCard icon={Calendar} label="Días entrenados" value={summary.days} accent="text-blue-400" />
                <StatCard icon={Dumbbell} label="Series registradas" value={summary.sets} accent="text-orange-400" />
                <StatCard icon={Calendar} label="Último entreno" value={summary.last ? summary.last.slice(5).replace('-', '/') : '—'} accent="text-emerald-400" />
            </div>

            {/* Selector de ejercicio */}
            <div className="flex flex-wrap items-center gap-3">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Ejercicio</label>
                <select
                    value={exId ?? ''}
                    onChange={(e) => setPicked(Number(e.target.value))}
                    className="min-w-[220px] rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm font-semibold text-white outline-none focus:border-blue-500"
                >
                    {exerciseOptions.map((o) => (
                        <option key={o.id} value={o.id}>{o.name} ({o.count})</option>
                    ))}
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

            {/* Gráfica */}
            <div className="h-72 rounded-xl border border-white/10 bg-slate-900/40 p-4">
                {chart.length > 1 ? (
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chart} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                            <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                            <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} unit=" kg" width={48} />
                            <Tooltip
                                contentStyle={{ background: '#0f172a', border: '1px solid #ffffff20', borderRadius: 10, fontSize: 12 }}
                                labelStyle={{ color: '#e2e8f0' }}
                            />
                            <Line type="monotone" dataKey="maxW" name="Peso máx" stroke="#f97316" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                            <Line type="monotone" dataKey="best1rm" name="1RM est." stroke="#10b981" strokeWidth={2} strokeDasharray="4 3" dot={false} />
                        </LineChart>
                    </ResponsiveContainer>
                ) : (
                    <div className="flex h-full items-center justify-center text-sm text-slate-500">
                        Necesita al menos 2 sesiones de este ejercicio para ver la evolución.
                    </div>
                )}
            </div>

            {/* Sesiones */}
            <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">Sesiones de este ejercicio</p>
                <div className="max-h-64 space-y-1.5 overflow-y-auto pr-1">
                    {[...chart].reverse().map((c) => {
                        const sets = logs.filter((l) => l.exercise_id === exId && l.workout_date === c.date);
                        return (
                            <div key={c.date} className="rounded-lg border border-white/5 bg-slate-900/40 px-3 py-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-bold text-slate-300">{c.date.slice(5).replace('-', '/')}</span>
                                    <span className="text-xs font-bold text-orange-400">máx {c.maxW} kg</span>
                                </div>
                                <div className="mt-1 flex flex-wrap gap-1.5">
                                    {sets.sort((a, b) => a.set_number - b.set_number).map((s) => (
                                        <span key={s.id} className="rounded-md bg-slate-800/80 px-2 py-0.5 text-xs font-semibold text-slate-300 tabular-nums">
                                            {s.weight_kg ?? '—'}{s.weight_kg != null ? ' kg' : ''}{s.reps_done != null ? ` × ${s.reps_done}` : ''}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
