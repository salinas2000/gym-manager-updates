import React, { useState, useEffect } from 'react';
import { X, Dumbbell, Save, Users, Timer, Power, Info } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

const DAY_NAMES = ['Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado', 'Domingo'];
const SLOT_DURATIONS = [
    { value: 30, label: '30 minutos' },
    { value: 60, label: '1 hora' },
    { value: 90, label: '1h 30 min' },
    { value: 120, label: '2 horas' },
];

/**
 * Configurar Horario del Gimnasio.
 *
 * Sólo define HORARIO DE APERTURA + AFORO. La asignación de entrenadores
 * NO se hace aquí — se gestiona desde la sección "Entrenadores" (cada
 * entrenador tiene su propio horario semanal) y la app móvil cruza
 * automáticamente las dos cosas para mostrar quién está de turno en cada
 * franja.
 */
export default function GymHoursModal({ isOpen, onClose, onSaved }) {
    const toast = useToast();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [enabled, setEnabled] = useState(true);
    const [maxCapacity, setMaxCapacity] = useState(30);
    const [duration, setDuration] = useState(60);
    const [days, setDays] = useState(() =>
        DAY_NAMES.map((name, i) => ({
            day_of_week: i,
            name,
            enabled: i < 5, // Mon-Fri by default
            start_time: '07:00',
            end_time: '22:00',
        }))
    );

    useEffect(() => {
        if (!isOpen) return;
        setLoading(true);
        window.api.classes.getGymHours().then((res) => {
            if (res?.success && res.data?.configured) {
                setEnabled(res.data.enabled !== false);
                setMaxCapacity(res.data.max_capacity || 30);
                setDuration(res.data.duration_minutes || 60);

                // Reconstruct days from existing shifts (back-compat) or from days field
                const dayHours = new Map(); // day_of_week → {start, end}
                if (Array.isArray(res.data.shifts) && res.data.shifts.length > 0) {
                    for (const shift of res.data.shifts) {
                        for (const d of shift.days) {
                            const existing = dayHours.get(d);
                            if (!existing) {
                                dayHours.set(d, { start: shift.start, end: shift.end });
                            } else {
                                if (shift.start < existing.start) existing.start = shift.start;
                                if (shift.end > existing.end) existing.end = shift.end;
                            }
                        }
                    }
                } else if (Array.isArray(res.data.days)) {
                    for (const d of res.data.days) {
                        dayHours.set(d.day_of_week, { start: d.start_time, end: d.end_time });
                    }
                }

                setDays((prev) => prev.map((d) => {
                    const found = dayHours.get(d.day_of_week);
                    return found
                        ? { ...d, enabled: true, start_time: found.start, end_time: found.end }
                        : { ...d, enabled: false };
                }));
            }
        }).catch(console.error).finally(() => setLoading(false));
    }, [isOpen]);

    if (!isOpen) return null;

    const updateDay = (idx, field, value) => {
        setDays((prev) => prev.map((d, i) => (i === idx ? { ...d, [field]: value } : d)));
    };

    const toggleAllWeekdays = () => {
        const allEnabled = days.slice(0, 5).every((d) => d.enabled);
        setDays((prev) => prev.map((d, i) => (i < 5 ? { ...d, enabled: !allEnabled } : d)));
    };

    const handleSave = async () => {
        const activeDays = days.filter((d) => d.enabled);

        // Solo exigimos días con horario si está activado
        if (enabled && activeDays.length === 0) {
            toast.error('Activa al menos un día o desactiva el gimnasio');
            return;
        }
        for (const d of activeDays) {
            if (d.start_time >= d.end_time) {
                toast.error(`${d.name}: la hora de cierre debe ser posterior a la de apertura`);
                return;
            }
        }

        setSaving(true);
        try {
            // Convertimos cada día activo en 1 shift sin instructors (los entrenadores
            // vienen aparte de la tabla trainers). Mantenemos el formato shifts para
            // que el backend genere los slots correctamente.
            const shifts = activeDays.map((d, i) => ({
                id: `day-${d.day_of_week}-${i}`,
                days: [d.day_of_week],
                start: d.start_time,
                end: d.end_time,
                instructors: [], // ya NO se asignan aquí
            }));

            const config = {
                enabled,
                max_capacity: maxCapacity,
                duration_minutes: duration,
                shifts,
            };
            const res = await window.api.classes.setGymHours(config);
            if (res?.success) {
                toast.success(enabled
                    ? `Horario configurado (${res.data?.total_slots || 0} franjas/semana)`
                    : 'Gimnasio desactivado en la app movil'
                );
                if (onSaved) onSaved();
                onClose();
            } else {
                toast.error(res?.error || 'Error al guardar el horario');
            }
        } catch (err) {
            toast.error(err.message || 'Error al guardar');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={onClose} />
            <div className="relative w-full max-w-2xl max-h-[90vh] bg-slate-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col">
                {/* Header */}
                <div className="relative bg-gradient-to-br from-slate-800 to-slate-900 p-6 border-b border-white/5">
                    <button onClick={onClose} className="absolute top-4 right-4 p-2 hover:bg-white/5 rounded-lg text-slate-400 hover:text-white transition-colors">
                        <X size={18} />
                    </button>
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center shadow-lg">
                            <Dumbbell size={22} className="text-white" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white">Configurar Horario del Gimnasio</h2>
                            <p className="text-sm text-slate-400 mt-0.5">
                                Define los días y horas en que el gimnasio está abierto.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-5">
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <div className="w-8 h-8 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
                        </div>
                    ) : (
                        <>
                            {/* Info banner */}
                            <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-4 flex items-start gap-3">
                                <Info size={16} className="text-blue-400 shrink-0 mt-0.5" />
                                <p className="text-xs text-slate-300 leading-relaxed">
                                    <strong className="text-blue-300">Los entrenadores se gestionan aparte.</strong> Crea cada entrenador en la sección "Entrenadores" con su horario semanal. La app móvil mostrará automáticamente quién está de turno en cada franja del gimnasio.
                                </p>
                            </div>

                            {/* Toggle visible en app */}
                            <div className={`rounded-xl p-4 border transition-colors ${enabled ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-slate-800/40 border-white/10'}`}>
                                <div className="flex items-center justify-between gap-4">
                                    <div className="flex-1">
                                        <p className="text-sm font-bold text-white">Visible en la app movil</p>
                                        <p className="text-xs text-slate-400 mt-0.5">
                                            {enabled
                                                ? 'Los clientes ven el horario del gimnasio y pueden reservar plaza'
                                                : 'Desactivado: el gimnasio NO aparece en la app movil de los clientes'}
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setEnabled((v) => !v)}
                                        className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${enabled ? 'bg-emerald-500' : 'bg-slate-600'}`}
                                    >
                                        <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${enabled ? 'translate-x-5' : 'translate-x-0.5'} self-center`} />
                                    </button>
                                </div>
                            </div>

                            <div className={`space-y-5 ${!enabled ? 'opacity-50 pointer-events-none' : ''}`}>
                                {/* Aforo + Duración */}
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="bg-slate-800/40 rounded-xl p-4 border border-white/5">
                                        <label className="flex items-center gap-1.5 text-[10px] uppercase font-bold text-slate-400 tracking-widest mb-2">
                                            <Users size={11} />
                                            Aforo maximo
                                        </label>
                                        <input
                                            type="number"
                                            min={1}
                                            max={500}
                                            value={maxCapacity}
                                            onChange={(e) => setMaxCapacity(parseInt(e.target.value) || 1)}
                                            className="w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-white text-center text-base font-bold focus:border-blue-500 outline-none"
                                        />
                                        <p className="text-[10px] text-slate-500 mt-1.5">personas a la vez</p>
                                    </div>
                                    <div className="bg-slate-800/40 rounded-xl p-4 border border-white/5">
                                        <label className="flex items-center gap-1.5 text-[10px] uppercase font-bold text-slate-400 tracking-widest mb-2">
                                            <Timer size={11} />
                                            Duracion por reserva
                                        </label>
                                        <select
                                            value={duration}
                                            onChange={(e) => setDuration(parseInt(e.target.value))}
                                            className="w-full bg-slate-900 border border-white/10 rounded-lg px-2 py-2 text-white text-sm font-medium focus:border-blue-500 outline-none appearance-none"
                                        >
                                            {SLOT_DURATIONS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
                                        </select>
                                        <p className="text-[10px] text-slate-500 mt-1.5">cada franja del calendario</p>
                                    </div>
                                </div>

                                {/* Días + horario */}
                                <div>
                                    <div className="flex items-center justify-between mb-3">
                                        <label className="text-xs uppercase font-bold text-slate-400 tracking-widest">
                                            Dias de apertura y horario
                                        </label>
                                        <button
                                            onClick={toggleAllWeekdays}
                                            className="text-xs font-medium text-blue-400 hover:text-blue-300 transition-colors"
                                        >
                                            {days.slice(0, 5).every((d) => d.enabled) ? 'Desactivar L-V' : 'Activar L-V'}
                                        </button>
                                    </div>
                                    <div className="space-y-2">
                                        {days.map((day, idx) => (
                                            <div
                                                key={day.day_of_week}
                                                className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${day.enabled
                                                    ? 'bg-slate-800/60 border-blue-500/20'
                                                    : 'bg-slate-800/20 border-white/5'}`}
                                            >
                                                <button
                                                    onClick={() => updateDay(idx, 'enabled', !day.enabled)}
                                                    className={`shrink-0 w-10 h-10 rounded-lg flex items-center justify-center transition-all ${day.enabled
                                                        ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-500/20'
                                                        : 'bg-slate-700/40 text-slate-500 hover:bg-slate-700'}`}
                                                >
                                                    <Power size={16} />
                                                </button>
                                                <div className="flex-1">
                                                    <p className={`font-medium ${day.enabled ? 'text-white' : 'text-slate-500'}`}>
                                                        {day.name}
                                                    </p>
                                                </div>
                                                {day.enabled && (
                                                    <div className="flex items-center gap-2">
                                                        <input
                                                            type="time"
                                                            value={day.start_time}
                                                            onChange={(e) => updateDay(idx, 'start_time', e.target.value)}
                                                            className="bg-slate-900 border border-white/10 rounded-lg px-2 py-1.5 text-white text-sm focus:border-blue-500 outline-none"
                                                        />
                                                        <span className="text-slate-500 text-sm">-</span>
                                                        <input
                                                            type="time"
                                                            value={day.end_time}
                                                            onChange={(e) => updateDay(idx, 'end_time', e.target.value)}
                                                            className="bg-slate-900 border border-white/10 rounded-lg px-2 py-1.5 text-white text-sm focus:border-blue-500 outline-none"
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Summary */}
                                <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-4">
                                    <p className="text-xs text-slate-400 mb-1">Resumen</p>
                                    {(() => {
                                        const active = days.filter((d) => d.enabled);
                                        const totalMins = active.reduce((acc, d) => {
                                            const [sh, sm] = d.start_time.split(':').map(Number);
                                            const [eh, em] = d.end_time.split(':').map(Number);
                                            return acc + Math.max(0, (eh * 60 + em) - (sh * 60 + sm));
                                        }, 0);
                                        const totalSlots = Math.floor(totalMins / duration);
                                        if (active.length === 0) {
                                            return <p className="text-sm text-slate-500">Sin días activos — el gimnasio aparecerá cerrado en la app móvil.</p>;
                                        }
                                        return (
                                            <p className="text-sm text-blue-300 font-medium">
                                                {active.length} dias abiertos · {totalSlots} franjas/semana de {duration} min · aforo {maxCapacity}
                                            </p>
                                        );
                                    })()}
                                </div>
                            </div>
                        </>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-white/5 bg-slate-900/50 flex justify-between items-center">
                    <button onClick={onClose} className="text-slate-400 hover:text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-white/5 transition-all">
                        Cancelar
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving || loading}
                        className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2 disabled:opacity-50 shadow-lg shadow-blue-500/20"
                    >
                        <Save size={14} />
                        {saving ? 'Guardando...' : 'Guardar horario'}
                    </button>
                </div>
            </div>
        </div>
    );
}
