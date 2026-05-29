import React, { useState, useEffect } from 'react';
import { X, Dumbbell, Save, Users, User, Timer, Plus, UserPlus } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

const DAY_NAMES = ['Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado', 'Domingo'];
const SLOT_DURATIONS = [
    { value: 30, label: '30 minutos' },
    { value: 60, label: '1 hora' },
    { value: 90, label: '1h 30 min' },
    { value: 120, label: '2 horas' },
];

/**
 * Modal for configuring the gym open hours.
 * Hides the "you must create a class called Gimnasio" complexity behind
 * a clean UI: just toggle the days the gym is open and set open/close time.
 */
export default function GymHoursModal({ isOpen, onClose, onSaved }) {
    const toast = useToast();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [maxCapacity, setMaxCapacity] = useState(30);
    const [duration, setDuration] = useState(60);
    // shifts: Array<{ id, days: number[], start: 'HH:MM', end: 'HH:MM', instructors: string[] }>
    // Cada turno define ALA VEZ horario de apertura Y entrenadores asignados.
    const [shifts, setShifts] = useState([]);

    useEffect(() => {
        if (!isOpen) return;
        setLoading(true);
        window.api.classes.getGymHours().then((res) => {
            if (res?.success && res.data?.configured) {
                setMaxCapacity(res.data.max_capacity || 30);
                setDuration(res.data.duration_minutes || 60);
                setShifts(Array.isArray(res.data.shifts) ? res.data.shifts : []);
            }
        }).catch(console.error).finally(() => setLoading(false));
    }, [isOpen]);

    if (!isOpen) return null;

    const handleSave = async () => {
        if (shifts.length === 0) {
            toast.error('Añade al menos un turno para definir el horario del gimnasio');
            return;
        }

        // Validate shifts
        for (const sh of shifts) {
            if (sh.days.length === 0) {
                toast.error('Cada turno debe tener al menos un día seleccionado');
                return;
            }
            if (sh.start >= sh.end) {
                toast.error('Hora de fin debe ser posterior a la de inicio');
                return;
            }
        }

        setSaving(true);
        try {
            const config = {
                max_capacity: maxCapacity,
                duration_minutes: duration,
                shifts: shifts.map((s) => ({
                    id: s.id,
                    days: s.days,
                    start: s.start,
                    end: s.end,
                    instructors: s.instructors.map((x) => x.trim()).filter(Boolean),
                })),
            };
            const res = await window.api.classes.setGymHours(config);
            if (res?.success) {
                toast.success(`Horario configurado (${res.data?.total_slots || 0} franjas de 1h)`);
                if (onSaved) onSaved();
                onClose();
            } else {
                toast.error(res?.error || 'Error al guardar el horario');
            }
        } catch (err) {
            toast.error(err.message || 'Error al guardar el horario');
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
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 p-2 hover:bg-white/5 rounded-lg text-slate-400 hover:text-white transition-colors"
                    >
                        <X size={18} />
                    </button>
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center shadow-lg">
                            <Dumbbell size={22} className="text-white" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white">Configurar Horario del Gimnasio</h2>
                            <p className="text-sm text-slate-400 mt-0.5">
                                Define cuando esta abierto el gimnasio. Tus clientes lo veran en la app movil para reservar.
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
                            {/* Grid: 2 fields side-by-side */}
                            <div className="grid grid-cols-2 gap-3">
                                {/* Capacity */}
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

                                {/* Slot duration */}
                                <div className="bg-slate-800/40 rounded-xl p-4 border border-white/5">
                                    <label className="flex items-center gap-1.5 text-[10px] uppercase font-bold text-slate-400 tracking-widest mb-2">
                                        <Timer size={11} />
                                        Duracion de cada franja
                                    </label>
                                    <select
                                        value={duration}
                                        onChange={(e) => setDuration(parseInt(e.target.value))}
                                        className="w-full bg-slate-900 border border-white/10 rounded-lg px-2 py-2 text-white text-sm font-medium focus:border-blue-500 outline-none appearance-none"
                                    >
                                        {SLOT_DURATIONS.map(d => (
                                            <option key={d.value} value={d.value}>{d.label}</option>
                                        ))}
                                    </select>
                                    <p className="text-[10px] text-slate-500 mt-1.5">duracion por reserva</p>
                                </div>
                            </div>

                            {/* Turnos de entrenadores */}
                            <div className="bg-slate-800/40 rounded-xl p-4 border border-white/5">
                                <div className="flex items-center justify-between mb-3">
                                    <label className="flex items-center gap-2 text-xs uppercase font-bold text-slate-400 tracking-widest">
                                        <User size={12} />
                                        Turnos de entrenadores
                                        {shifts.length > 0 && (
                                            <span className="text-[10px] text-blue-400 normal-case tracking-normal font-medium ml-1">
                                                ({shifts.length})
                                            </span>
                                        )}
                                    </label>
                                    <button
                                        onClick={() => setShifts((prev) => [
                                            ...prev,
                                            {
                                                id: `shift-${Date.now()}-${prev.length}`,
                                                days: [0, 1, 2, 3, 4],
                                                start: prev.length === 0 ? '07:00' : '14:00',
                                                end: prev.length === 0 ? '14:00' : '22:00',
                                                instructors: [''],
                                            },
                                        ])}
                                        className="inline-flex items-center gap-1.5 bg-blue-600/15 hover:bg-blue-600/25 border border-blue-500/30 text-blue-300 px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
                                    >
                                        <Plus size={12} />
                                        Añadir turno
                                    </button>
                                </div>

                                <p className="text-[10px] text-slate-500 mb-3">
                                    Define qué entrenadores trabajan en cada franja del día (mañana/tarde/noche). Cada cliente verá el entrenador correspondiente al reservar.
                                </p>

                                {shifts.length === 0 ? (
                                    <div className="text-center py-4 text-slate-500">
                                        <UserPlus size={28} className="mx-auto mb-1.5 text-slate-600" />
                                        <p className="text-xs">Sin turnos configurados</p>
                                        <p className="text-[10px] text-slate-600 mt-0.5">
                                            Ej. Turno mañana 07:00-14:00 con Juan; tarde 14:00-22:00 con María
                                        </p>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {shifts.map((shift, sidx) => (
                                            <div key={shift.id} className="bg-slate-900/60 rounded-lg border border-white/10 p-3 space-y-2.5">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-xs font-bold text-white">Turno {sidx + 1}</span>
                                                    <button
                                                        onClick={() => setShifts((prev) => prev.filter((_, i) => i !== sidx))}
                                                        className="p-1 hover:bg-red-500/15 rounded text-slate-500 hover:text-red-400 transition-colors"
                                                        title="Eliminar turno"
                                                    >
                                                        <X size={12} />
                                                    </button>
                                                </div>

                                                {/* Days */}
                                                <div>
                                                    <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-1.5">Dias</p>
                                                    <div className="flex gap-1">
                                                        {DAY_NAMES.map((dn, di) => {
                                                            const enabled = shift.days.includes(di);
                                                            return (
                                                                <button
                                                                    key={di}
                                                                    onClick={() => setShifts((prev) => prev.map((s, i) => {
                                                                        if (i !== sidx) return s;
                                                                        const newDays = enabled
                                                                            ? s.days.filter((x) => x !== di)
                                                                            : [...s.days, di].sort((a, b) => a - b);
                                                                        return { ...s, days: newDays };
                                                                    }))}
                                                                    className={`flex-1 py-1.5 rounded-md text-[11px] font-bold transition-all ${
                                                                        enabled
                                                                            ? 'bg-blue-600 text-white shadow-sm'
                                                                            : 'bg-slate-800/60 text-slate-500 hover:bg-slate-800'
                                                                    }`}
                                                                >
                                                                    {dn.slice(0, 1)}
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                </div>

                                                {/* Time range */}
                                                <div>
                                                    <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-1.5">Horario</p>
                                                    <div className="flex items-center gap-2">
                                                        <input
                                                            type="time"
                                                            value={shift.start}
                                                            onChange={(e) => setShifts((prev) => prev.map((s, i) => i === sidx ? { ...s, start: e.target.value } : s))}
                                                            className="bg-slate-800 border border-white/10 rounded-md px-2 py-1.5 text-white text-sm focus:border-blue-500 outline-none"
                                                        />
                                                        <span className="text-slate-500 text-sm">-</span>
                                                        <input
                                                            type="time"
                                                            value={shift.end}
                                                            onChange={(e) => setShifts((prev) => prev.map((s, i) => i === sidx ? { ...s, end: e.target.value } : s))}
                                                            className="bg-slate-800 border border-white/10 rounded-md px-2 py-1.5 text-white text-sm focus:border-blue-500 outline-none"
                                                        />
                                                    </div>
                                                </div>

                                                {/* Trainers */}
                                                <div>
                                                    <div className="flex items-center justify-between mb-1.5">
                                                        <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Entrenadores</p>
                                                        <button
                                                            onClick={() => setShifts((prev) => prev.map((s, i) => i === sidx ? { ...s, instructors: [...s.instructors, ''] } : s))}
                                                            className="text-[10px] font-bold text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1"
                                                        >
                                                            <Plus size={10} /> Otro
                                                        </button>
                                                    </div>
                                                    <div className="space-y-1.5">
                                                        {shift.instructors.map((name, iidx) => (
                                                            <div key={iidx} className="flex items-center gap-1.5">
                                                                <input
                                                                    type="text"
                                                                    value={name}
                                                                    onChange={(e) => setShifts((prev) => prev.map((s, i) => i === sidx ? { ...s, instructors: s.instructors.map((n, j) => j === iidx ? e.target.value : n) } : s))}
                                                                    placeholder="Nombre del entrenador"
                                                                    className="flex-1 bg-slate-800 border border-white/10 rounded-md px-2.5 py-1.5 text-white text-xs focus:border-blue-500 outline-none"
                                                                />
                                                                {shift.instructors.length > 1 && (
                                                                    <button
                                                                        onClick={() => setShifts((prev) => prev.map((s, i) => i === sidx ? { ...s, instructors: s.instructors.filter((_, j) => j !== iidx) } : s))}
                                                                        className="p-1 hover:bg-red-500/15 rounded text-slate-500 hover:text-red-400 transition-colors"
                                                                    >
                                                                        <X size={11} />
                                                                    </button>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Summary — derivado de los turnos */}
                            <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-4">
                                <p className="text-xs text-slate-400 mb-1">Resumen</p>
                                {(() => {
                                    // Total slots derived from shifts (deduped by day+time)
                                    const generatedSet = new Set();
                                    const activeDaySet = new Set();
                                    for (const s of shifts) {
                                        const [sh, sm] = s.start.split(':').map(Number);
                                        const [eh, em] = s.end.split(':').map(Number);
                                        const startMins = sh * 60 + sm;
                                        const endMins = eh * 60 + em;
                                        for (const dayIdx of s.days) {
                                            activeDaySet.add(dayIdx);
                                            for (let cur = startMins; cur + duration <= endMins; cur += duration) {
                                                generatedSet.add(`${dayIdx}|${cur}`);
                                            }
                                        }
                                    }
                                    const uniqueTrainers = new Set();
                                    shifts.forEach((s) => s.instructors.forEach((n) => { if (n.trim()) uniqueTrainers.add(n.trim()); }));
                                    if (shifts.length === 0) {
                                        return <p className="text-sm text-slate-500">Sin turnos — el gimnasio aparecerá cerrado en la app móvil.</p>;
                                    }
                                    return (
                                        <p className="text-sm text-blue-300 font-medium">
                                            {activeDaySet.size} dias abiertos · {generatedSet.size} franjas/semana de {duration} min · aforo {maxCapacity}
                                            {' · '}{shifts.length} turno{shifts.length > 1 ? 's' : ''}
                                            {uniqueTrainers.size > 0 && ` · ${uniqueTrainers.size} entrenador${uniqueTrainers.size !== 1 ? 'es' : ''}`}
                                        </p>
                                    );
                                })()}
                            </div>
                        </>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-white/5 bg-slate-900/50 flex justify-between items-center">
                    <button
                        onClick={onClose}
                        className="text-slate-400 hover:text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-white/5 transition-all"
                    >
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
