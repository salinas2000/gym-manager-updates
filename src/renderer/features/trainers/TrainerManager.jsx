import React, { useState, useEffect, useMemo } from 'react';
import { Plus, User, Mail, Phone, Edit2, Trash2, Eye, EyeOff, Clock, X, Save, Shield, Users } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import ConfirmationModal from '../../components/ui/ConfirmationModal';
import TrainerAccessPage from '../trainer-access/TrainerAccessPage';

const DAY_NAMES = ['Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado', 'Domingo'];
const COLORS = [
    { id: 'blue', class: 'from-blue-600 to-blue-900', label: 'Azul' },
    { id: 'emerald', class: 'from-emerald-600 to-emerald-900', label: 'Verde' },
    { id: 'purple', class: 'from-purple-600 to-purple-900', label: 'Morado' },
    { id: 'amber', class: 'from-amber-600 to-amber-900', label: 'Ambar' },
    { id: 'rose', class: 'from-rose-600 to-rose-900', label: 'Rosa' },
    { id: 'slate', class: 'from-slate-600 to-slate-900', label: 'Gris' },
];

export default function TrainerManager() {
    const [tab, setTab] = useState('staff'); // 'staff' | 'access'
    return (
        <div className="flex h-full flex-col">
            <div className="border-b border-white/10 px-6 pt-4">
                <div className="flex gap-1">
                    {[
                        ['staff', 'Plantilla', Users],
                        ['access', 'Acceso al panel', Shield],
                    ].map(([v, label, Icon]) => (
                        <button
                            key={v}
                            onClick={() => setTab(v)}
                            className={`-mb-px flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-bold transition-colors ${tab === v ? 'border-blue-500 text-white' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
                        >
                            <Icon size={15} />
                            {label}
                        </button>
                    ))}
                </div>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
                {tab === 'staff' ? <StaffSection /> : <TrainerAccessPage />}
            </div>
        </div>
    );
}

function StaffSection() {
    const toast = useToast();
    const [trainers, setTrainers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editingTrainer, setEditingTrainer] = useState(null);
    const [scheduleTrainer, setScheduleTrainer] = useState(null);
    const [trainerToDelete, setTrainerToDelete] = useState(null);
    const [isFormOpen, setIsFormOpen] = useState(false);

    const loadData = async () => {
        setLoading(true);
        try {
            const res = await window.api.trainers.getAll('all');
            setTrainers(res.success ? res.data : []);
        } catch (err) {
            toast.error('Error al cargar entrenadores');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadData(); }, []);

    const handleSave = async (data) => {
        try {
            const res = editingTrainer
                ? await window.api.trainers.update(editingTrainer.id, data)
                : await window.api.trainers.create(data);
            if (!res.success) throw new Error(res.error || 'Error al guardar');
            toast.success(editingTrainer ? 'Entrenador actualizado' : 'Entrenador creado');
            setIsFormOpen(false);
            setEditingTrainer(null);
            loadData();
        } catch (err) {
            toast.error(err.message || 'Error al guardar');
        }
    };

    const handleToggle = async (t) => {
        try {
            const res = await window.api.trainers.toggleActive(t.id);
            if (!res.success) throw new Error('Error');
            loadData();
        } catch (err) {
            toast.error('Error al cambiar estado');
        }
    };

    const handleDelete = async () => {
        if (!trainerToDelete) return;
        try {
            await window.api.trainers.delete(trainerToDelete.id);
            toast.success('Entrenador eliminado');
            setTrainerToDelete(null);
            loadData();
        } catch (err) {
            toast.error(err.message || 'Error al eliminar');
        }
    };

    const handleScheduleSaved = async (schedule) => {
        try {
            const res = await window.api.trainers.setSchedule(scheduleTrainer.id, schedule);
            if (!res.success) throw new Error('Error guardando horario');
            toast.success('Horario guardado');
            setScheduleTrainer(null);
            loadData();
        } catch (err) {
            toast.error(err.message || 'Error al guardar horario');
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-black text-white flex items-center gap-3">
                        <User size={28} className="text-blue-400" />
                        Entrenadores
                    </h1>
                    <p className="text-slate-400 text-sm mt-1">
                        Gestiona la plantilla de entrenadores y su horario semanal de trabajo.
                    </p>
                </div>
                <button
                    onClick={() => { setEditingTrainer(null); setIsFormOpen(true); }}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2.5 rounded-xl text-sm font-bold transition-all shadow-lg shadow-blue-500/20"
                >
                    <Plus size={16} />
                    Nuevo Entrenador
                </button>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <div className="w-8 h-8 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
                </div>
            ) : trainers.length === 0 ? (
                <div className="bg-slate-900/30 rounded-2xl border border-white/5 p-12 text-center">
                    <User size={48} className="mx-auto text-slate-600 mb-3" />
                    <h3 className="text-white font-bold mb-1">Sin entrenadores</h3>
                    <p className="text-sm text-slate-500 mb-4">Crea tu primer entrenador para asignarle horario y verlo en la app movil de tus clientes.</p>
                    <button
                        onClick={() => { setEditingTrainer(null); setIsFormOpen(true); }}
                        className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl text-sm font-bold transition-all"
                    >
                        <Plus size={14} />
                        Crear entrenador
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {trainers.map((t) => {
                        const color = COLORS.find((c) => c.id === t.color_theme) || COLORS[0];
                        return (
                            <div key={t.id} className={`bg-slate-900/40 border border-white/5 rounded-2xl p-5 transition-all hover:border-white/10 ${!t.active ? 'opacity-50' : ''}`}>
                                <div className="flex items-start justify-between mb-3">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${color.class} flex items-center justify-center text-lg font-black text-white shadow-lg`}>
                                            {(t.name || '?').split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-white">{t.name}</h3>
                                            {t.phone && <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5"><Phone size={10} />{t.phone}</p>}
                                            {t.email && <p className="text-xs text-slate-500 flex items-center gap-1"><Mail size={10} />{t.email}</p>}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <button onClick={() => { setEditingTrainer(t); setIsFormOpen(true); }} className="p-1.5 hover:bg-white/10 rounded-lg" title="Editar"><Edit2 size={14} className="text-slate-400" /></button>
                                        <button onClick={() => handleToggle(t)} className="p-1.5 hover:bg-white/10 rounded-lg" title={t.active ? 'Desactivar' : 'Activar'}>
                                            {t.active ? <EyeOff size={14} className="text-slate-400" /> : <Eye size={14} className="text-emerald-400" />}
                                        </button>
                                        <button onClick={() => setTrainerToDelete(t)} className="p-1.5 hover:bg-red-500/20 rounded-lg" title="Eliminar"><Trash2 size={14} className="text-red-400" /></button>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setScheduleTrainer(t)}
                                    className="w-full mt-2 flex items-center justify-center gap-2 text-xs font-bold text-slate-300 bg-white/5 hover:bg-white/10 py-2 rounded-xl transition-all"
                                >
                                    <Clock size={12} />
                                    Horario semanal ({t.schedule_count || 0})
                                </button>
                            </div>
                        );
                    })}
                </div>
            )}

            {isFormOpen && (
                <TrainerFormModal
                    editData={editingTrainer}
                    onSave={handleSave}
                    onClose={() => { setIsFormOpen(false); setEditingTrainer(null); }}
                />
            )}

            {scheduleTrainer && (
                <TrainerScheduleModal
                    trainer={scheduleTrainer}
                    onSave={handleScheduleSaved}
                    onClose={() => setScheduleTrainer(null)}
                />
            )}

            <ConfirmationModal
                isOpen={!!trainerToDelete}
                title="Eliminar entrenador"
                onClose={() => setTrainerToDelete(null)}
                onConfirm={handleDelete}
                type="danger"
                confirmText="Eliminar"
            >
                {trainerToDelete && (
                    <p className="text-slate-300">
                        Estas a punto de eliminar a <span className="font-bold text-white">{trainerToDelete.name}</span>.
                        Se eliminara tambien su horario y dejara de aparecer en la app movil.
                    </p>
                )}
            </ConfirmationModal>
        </div>
    );
}

// ═════════════════════════════════════════════════════════════════════════════
// TRAINER FORM (create/edit)
// ═════════════════════════════════════════════════════════════════════════════

function TrainerFormModal({ editData, onSave, onClose }) {
    const [name, setName] = useState(editData?.name || '');
    const [color, setColor] = useState(editData?.color_theme || 'blue');
    const [phone, setPhone] = useState(editData?.phone || '');
    const [email, setEmail] = useState(editData?.email || '');
    const [saving, setSaving] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!name.trim()) return;
        setSaving(true);
        await onSave({ name, color_theme: color, phone, email });
        setSaving(false);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={onClose} />
            <form
                onSubmit={handleSubmit}
                className="relative w-full max-w-md bg-slate-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200"
            >
                <div className="p-6 border-b border-white/5 flex items-center justify-between">
                    <h2 className="text-lg font-bold text-white">{editData ? 'Editar entrenador' : 'Nuevo entrenador'}</h2>
                    <button type="button" onClick={onClose} className="p-1.5 hover:bg-white/5 rounded-lg text-slate-400">
                        <X size={16} />
                    </button>
                </div>
                <div className="p-6 space-y-4">
                    <div>
                        <label className="block text-xs uppercase font-bold text-slate-400 tracking-widest mb-1.5">Nombre *</label>
                        <input
                            autoFocus
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Ej. Juan Perez"
                            className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2.5 text-white focus:border-blue-500 outline-none"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-xs uppercase font-bold text-slate-400 tracking-widest mb-1.5">Color</label>
                        <div className="flex gap-2">
                            {COLORS.map((c) => (
                                <button
                                    key={c.id}
                                    type="button"
                                    onClick={() => setColor(c.id)}
                                    className={`w-8 h-8 rounded-full bg-gradient-to-br ${c.class} border-2 transition-all ${color === c.id ? 'border-white scale-110' : 'border-transparent'}`}
                                    title={c.label}
                                />
                            ))}
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs uppercase font-bold text-slate-400 tracking-widest mb-1.5">Telefono</label>
                            <input
                                type="tel"
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                placeholder="Opcional"
                                className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:border-blue-500 outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-xs uppercase font-bold text-slate-400 tracking-widest mb-1.5">Email</label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="Opcional"
                                className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:border-blue-500 outline-none"
                            />
                        </div>
                    </div>
                </div>
                <div className="p-4 border-t border-white/5 bg-slate-900/50 flex justify-end gap-2">
                    <button type="button" onClick={onClose} className="text-slate-400 hover:text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-white/5">
                        Cancelar
                    </button>
                    <button
                        type="submit"
                        disabled={saving || !name.trim()}
                        className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2 disabled:opacity-50"
                    >
                        <Save size={14} />
                        {saving ? 'Guardando...' : 'Guardar'}
                    </button>
                </div>
            </form>
        </div>
    );
}

// ═════════════════════════════════════════════════════════════════════════════
// TRAINER WEEKLY SCHEDULE EDITOR
// ═════════════════════════════════════════════════════════════════════════════

function TrainerScheduleModal({ trainer, onSave, onClose }) {
    // Schedule rows: each is one day + time range
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        window.api.trainers.getById(trainer.id).then((res) => {
            if (res.success) {
                setRows((res.data.schedules || []).map((s, i) => ({
                    key: `${s.id || `tmp-${i}`}`,
                    day_of_week: s.day_of_week,
                    start_time: s.start_time,
                    end_time: s.end_time,
                })));
            }
        }).finally(() => setLoading(false));
    }, [trainer.id]);

    const addRow = (dayIdx = 0) => {
        setRows((prev) => [...prev, {
            key: `tmp-${Date.now()}-${prev.length}`,
            day_of_week: dayIdx,
            start_time: '09:00',
            end_time: '17:00',
        }]);
    };

    const updateRow = (idx, field, value) => {
        setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, [field]: value } : r)));
    };

    const removeRow = (idx) => {
        setRows((prev) => prev.filter((_, i) => i !== idx));
    };

    const handleSave = async () => {
        // Validate
        for (const r of rows) {
            if (r.start_time >= r.end_time) {
                alert(`Horario invalido en ${DAY_NAMES[r.day_of_week]}: fin debe ser despues del inicio`);
                return;
            }
        }
        setSaving(true);
        await onSave(rows);
        setSaving(false);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={onClose} />
            <div className="relative w-full max-w-2xl max-h-[85vh] bg-slate-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
                <div className="p-5 border-b border-white/5 flex items-center justify-between">
                    <div>
                        <h2 className="text-lg font-bold text-white">Horario de {trainer.name}</h2>
                        <p className="text-xs text-slate-500 mt-0.5">Define en que dias y horas trabaja</p>
                    </div>
                    <button onClick={onClose} className="p-1.5 hover:bg-white/5 rounded-lg text-slate-400"><X size={16} /></button>
                </div>

                <div className="flex-1 overflow-y-auto p-5 space-y-3">
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <div className="w-6 h-6 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
                        </div>
                    ) : rows.length === 0 ? (
                        <div className="text-center py-8 text-slate-500">
                            <Clock size={32} className="mx-auto mb-2 text-slate-600" />
                            <p className="text-sm">Sin franjas configuradas</p>
                            <p className="text-xs text-slate-600 mt-1">Anade una franja por cada turno (puede tener varias al dia)</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {rows.map((r, idx) => (
                                <div key={r.key} className="flex items-center gap-3 p-3 bg-slate-800/40 rounded-xl border border-white/5">
                                    <select
                                        value={r.day_of_week}
                                        onChange={(e) => updateRow(idx, 'day_of_week', parseInt(e.target.value))}
                                        className="bg-slate-900 border border-white/10 rounded-lg px-3 py-1.5 text-white text-sm focus:border-blue-500 outline-none"
                                    >
                                        {DAY_NAMES.map((n, i) => <option key={i} value={i}>{n}</option>)}
                                    </select>
                                    <input
                                        type="time"
                                        value={r.start_time}
                                        onChange={(e) => updateRow(idx, 'start_time', e.target.value)}
                                        className="bg-slate-900 border border-white/10 rounded-lg px-2 py-1.5 text-white text-sm focus:border-blue-500 outline-none"
                                    />
                                    <span className="text-slate-500">-</span>
                                    <input
                                        type="time"
                                        value={r.end_time}
                                        onChange={(e) => updateRow(idx, 'end_time', e.target.value)}
                                        className="bg-slate-900 border border-white/10 rounded-lg px-2 py-1.5 text-white text-sm focus:border-blue-500 outline-none"
                                    />
                                    <button
                                        onClick={() => removeRow(idx)}
                                        className="ml-auto p-1.5 hover:bg-red-500/15 rounded-lg text-slate-500 hover:text-red-400"
                                    >
                                        <X size={14} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="grid grid-cols-7 gap-1 mt-3">
                        {DAY_NAMES.map((n, i) => (
                            <button
                                key={i}
                                onClick={() => addRow(i)}
                                className="text-xs font-bold py-2 rounded-lg bg-blue-600/15 hover:bg-blue-600/25 border border-blue-500/30 text-blue-300 transition-all"
                                title={`Añadir franja en ${n}`}
                            >
                                + {n.slice(0, 3)}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="p-4 border-t border-white/5 bg-slate-900/50 flex justify-end gap-2">
                    <button onClick={onClose} className="text-slate-400 hover:text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-white/5">
                        Cancelar
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2 disabled:opacity-50"
                    >
                        <Save size={14} />
                        {saving ? 'Guardando...' : 'Guardar horario'}
                    </button>
                </div>
            </div>
        </div>
    );
}
