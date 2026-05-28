import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Clock } from 'lucide-react';

const DAY_NAMES = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

export default function ScheduleEditor({ gymClass, onSave, onClose }) {
    const [schedules, setSchedules] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // New slot form
    const [newSlot, setNewSlot] = useState({ day_of_week: 0, start_time: '10:00', end_time: '11:00' });
    const [adding, setAdding] = useState(false);

    useEffect(() => {
        loadSchedules();
    }, []);

    const loadSchedules = async () => {
        setLoading(true);
        try {
            const res = await window.api.classes.getSchedules(gymClass.id);
            if (res.success) setSchedules(res.data);
        } catch (err) {
            console.error('Error loading schedules:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleAdd = async () => {
        setError(null);
        setAdding(true);

        // Auto-calculate end_time based on class duration
        const [h, m] = newSlot.start_time.split(':').map(Number);
        const endMin = h * 60 + m + gymClass.duration_minutes;
        const autoEnd = `${String(Math.floor(endMin / 60) % 24).padStart(2, '0')}:${String(endMin % 60).padStart(2, '0')}`;

        try {
            const res = await window.api.classes.addSchedule({
                class_id: gymClass.id,
                day_of_week: Number(newSlot.day_of_week),
                start_time: newSlot.start_time,
                end_time: autoEnd,
            });

            if (res.success) {
                loadSchedules();
                // Advance to next day for convenience
                setNewSlot(prev => ({
                    ...prev,
                    day_of_week: Math.min(prev.day_of_week + 1, 6),
                }));
            } else {
                setError(res.error || 'Error al agregar horario');
            }
        } catch (err) {
            setError(err.message || 'Error inesperado');
        } finally {
            setAdding(false);
        }
    };

    const handleDelete = async (id) => {
        try {
            const res = await window.api.classes.deleteSchedule(id);
            if (res.success) loadSchedules();
        } catch (err) {
            console.error('Delete error:', err);
        }
    };

    // Group by day
    const byDay = DAY_NAMES.map((name, i) => ({
        day: i,
        name,
        slots: schedules.filter(s => s.day_of_week === i).sort((a, b) => a.start_time.localeCompare(b.start_time)),
    }));

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div
                className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-xl shadow-2xl animate-in fade-in zoom-in-95 duration-200 max-h-[80vh] flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 shrink-0">
                    <div>
                        <h2 className="text-lg font-black text-white">Horarios: {gymClass.name}</h2>
                        <p className="text-xs text-slate-400 mt-0.5">Duracion: {gymClass.duration_minutes} min | Aforo: {gymClass.max_capacity}</p>
                    </div>
                    <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-lg transition-all">
                        <X size={18} className="text-slate-400" />
                    </button>
                </div>

                {/* Content */}
                <div className="overflow-y-auto flex-1 p-6 space-y-4">
                    {/* Add Slot Form */}
                    <div className="bg-slate-800/50 border border-white/5 rounded-xl p-4">
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Agregar Horario</h3>
                        <div className="flex items-end gap-3">
                            <div className="flex-1">
                                <label className="block text-xs text-slate-500 mb-1">Dia</label>
                                <select
                                    value={newSlot.day_of_week}
                                    onChange={(e) => setNewSlot(prev => ({ ...prev, day_of_week: Number(e.target.value) }))}
                                    className="w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
                                >
                                    {DAY_NAMES.map((name, i) => (
                                        <option key={i} value={i}>{name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs text-slate-500 mb-1">Hora inicio</label>
                                <input
                                    type="time"
                                    value={newSlot.start_time}
                                    onChange={(e) => setNewSlot(prev => ({ ...prev, start_time: e.target.value }))}
                                    className="bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
                                />
                            </div>
                            <button
                                onClick={handleAdd}
                                disabled={adding}
                                className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold text-sm transition-all disabled:opacity-50"
                            >
                                <Plus size={16} />
                                {adding ? '...' : 'Agregar'}
                            </button>
                        </div>
                        {error && (
                            <p className="text-red-400 text-xs mt-2 font-medium">{error}</p>
                        )}
                    </div>

                    {/* Schedule List by Day */}
                    {loading ? (
                        <div className="text-center py-8 text-slate-500">Cargando...</div>
                    ) : schedules.length === 0 ? (
                        <div className="text-center py-8">
                            <Clock className="mx-auto text-slate-600 mb-3" size={36} />
                            <p className="text-slate-400 text-sm">No hay horarios configurados</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {byDay.filter(d => d.slots.length > 0).map(({ day, name, slots }) => (
                                <div key={day}>
                                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">{name}</h4>
                                    <div className="space-y-1.5">
                                        {slots.map(slot => (
                                            <div
                                                key={slot.id}
                                                className="flex items-center justify-between bg-slate-800/50 border border-white/5 rounded-xl px-4 py-2.5"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <Clock size={14} className="text-blue-400" />
                                                    <span className="text-white text-sm font-bold">{slot.start_time}</span>
                                                    <span className="text-slate-500 text-sm">-</span>
                                                    <span className="text-slate-300 text-sm">{slot.end_time}</span>
                                                </div>
                                                <button
                                                    onClick={() => handleDelete(slot.id)}
                                                    className="p-1.5 hover:bg-red-500/20 rounded-lg transition-all"
                                                    title="Eliminar horario"
                                                >
                                                    <Trash2 size={14} className="text-red-400" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-white/5 shrink-0 flex justify-end">
                    <button
                        onClick={() => { onSave(); onClose(); }}
                        className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-sm transition-all shadow-lg shadow-blue-600/20"
                    >
                        Listo
                    </button>
                </div>
            </div>
        </div>
    );
}
