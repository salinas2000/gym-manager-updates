import React, { useState, useEffect } from 'react';
import { X, Check } from 'lucide-react';

const COLORS = [
    { key: 'blue', label: 'Azul', class: 'bg-blue-500' },
    { key: 'red', label: 'Rojo', class: 'bg-red-500' },
    { key: 'green', label: 'Verde', class: 'bg-emerald-500' },
    { key: 'purple', label: 'Morado', class: 'bg-purple-500' },
    { key: 'orange', label: 'Naranja', class: 'bg-orange-500' },
    { key: 'pink', label: 'Rosa', class: 'bg-pink-500' },
    { key: 'yellow', label: 'Amarillo', class: 'bg-yellow-500' },
    { key: 'cyan', label: 'Cyan', class: 'bg-cyan-500' },
];

export default function ClassFormModal({ editData, onSave, onClose }) {
    const [form, setForm] = useState({
        name: '',
        description: '',
        trainer_id: '',
        color_theme: 'blue',
        max_capacity: 20,
        duration_minutes: 60,
    });
    const [trainers, setTrainers] = useState([]);
    const [error, setError] = useState(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        (async () => {
            try {
                const res = await window.api.trainers.getAll('active');
                if (res?.success && Array.isArray(res.data)) setTrainers(res.data);
            } catch { /* lista de entrenadores opcional */ }
        })();
    }, []);

    useEffect(() => {
        if (editData) {
            setForm({
                name: editData.name || '',
                description: editData.description || '',
                trainer_id: editData.trainer_id ? String(editData.trainer_id) : '',
                color_theme: editData.color_theme || 'blue',
                max_capacity: editData.max_capacity || 20,
                duration_minutes: editData.duration_minutes || 60,
            });
        }
    }, [editData]);

    const handleChange = (key, value) => {
        setForm(prev => ({ ...prev, [key]: value }));
        setError(null);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);
        setSaving(true);

        try {
            const payload = {
                ...form,
                trainer_id: form.trainer_id ? Number(form.trainer_id) : null,
                max_capacity: Number(form.max_capacity),
                duration_minutes: Number(form.duration_minutes),
            };

            const res = editData
                ? await window.api.classes.update(editData.id, payload)
                : await window.api.classes.create(payload);

            if (res.success) {
                onSave();
            } else {
                setError(res.error || 'Error al guardar');
            }
        } catch (err) {
            setError(err.message || 'Error inesperado');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div
                className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl animate-in fade-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
                    <h2 className="text-lg font-black text-white">
                        {editData ? 'Editar Clase' : 'Nueva Clase'}
                    </h2>
                    <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-lg transition-all">
                        <X size={18} className="text-slate-400" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-5">
                    {/* Name */}
                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                            Nombre *
                        </label>
                        <input
                            type="text"
                            value={form.name}
                            onChange={(e) => handleChange('name', e.target.value)}
                            placeholder="Ej: Spinning, Yoga, CrossFit..."
                            className="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-3 text-white text-sm font-medium placeholder:text-slate-500 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30"
                            required
                        />
                    </div>

                    {/* Description */}
                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                            Descripcion
                        </label>
                        <textarea
                            value={form.description}
                            onChange={(e) => handleChange('description', e.target.value)}
                            placeholder="Descripcion de la clase..."
                            rows={2}
                            className="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-3 text-white text-sm font-medium placeholder:text-slate-500 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30 resize-none"
                        />
                    </div>

                    {/* Entrenador */}
                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                            Entrenador
                        </label>
                        <select
                            value={form.trainer_id}
                            onChange={(e) => handleChange('trainer_id', e.target.value)}
                            className="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-3 text-white text-sm font-medium focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30"
                        >
                            <option value="">Sin asignar (por turno)</option>
                            {trainers.map((t) => (
                                <option key={t.id} value={t.id}>{t.name}</option>
                            ))}
                        </select>
                        {trainers.length === 0 && (
                            <p className="mt-1.5 text-[11px] text-slate-500">
                                No hay entrenadores. Crea entrenadores en la sección «Entrenadores».
                            </p>
                        )}
                    </div>

                    {/* Capacity & Duration */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                                Aforo maximo *
                            </label>
                            <input
                                type="number"
                                value={form.max_capacity}
                                onChange={(e) => handleChange('max_capacity', e.target.value)}
                                min={1}
                                max={200}
                                className="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-3 text-white text-sm font-medium focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                                Duracion (min) *
                            </label>
                            <input
                                type="number"
                                value={form.duration_minutes}
                                onChange={(e) => handleChange('duration_minutes', e.target.value)}
                                min={15}
                                max={480}
                                step={5}
                                className="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-3 text-white text-sm font-medium focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30"
                                required
                            />
                        </div>
                    </div>

                    {/* Color Picker */}
                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                            Color
                        </label>
                        <div className="flex items-center gap-2">
                            {COLORS.map(({ key, class: cls }) => (
                                <button
                                    key={key}
                                    type="button"
                                    onClick={() => handleChange('color_theme', key)}
                                    className={`w-8 h-8 rounded-full ${cls} flex items-center justify-center transition-all ${
                                        form.color_theme === key ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-900 scale-110' : 'opacity-60 hover:opacity-100'
                                    }`}
                                >
                                    {form.color_theme === key && <Check size={14} className="text-white" />}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Error */}
                    {error && (
                        <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3">
                            <p className="text-red-400 text-sm font-medium">{error}</p>
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex items-center justify-end gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold text-sm transition-all border border-white/5"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={saving}
                            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-sm transition-all shadow-lg shadow-blue-600/20 disabled:opacity-50"
                        >
                            {saving ? 'Guardando...' : editData ? 'Guardar Cambios' : 'Crear Clase'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
