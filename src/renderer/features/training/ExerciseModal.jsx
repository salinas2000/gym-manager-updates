import React, { useState, useEffect } from 'react';
import { X, Save, Video, FileText, Dumbbell, ChevronDown, Activity } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '../../context/ToastContext';
import LoadingSpinner from '../../components/ui/LoadingSpinner';

// Mirror of constants/field-catalog.js::TRACKING_TYPES (renderer can't require
// a main-process module). Keep in sync.
const TRACKING_TYPES = [
    { key: 'strength',        label: '🏋 Fuerza (peso · reps)' },
    { key: 'cardio_distance', label: '🏃 Cardio distancia (tiempo · km)' },
    { key: 'cardio_time',     label: '⏱ Cardio tiempo (solo tiempo)' },
    { key: 'time_only',       label: '🧘 Isométrico (solo tiempo)' },
    { key: 'reps_only',       label: '💪 Peso corporal (solo reps)' },
    { key: 'custom',          label: '⚙ Personalizado (todos los campos)' },
];

// Which prescription fields apply to each tracking type. Keys not listed are
// universal (shown for every type). tracking_type 'custom' shows everything.
// Mirror of field-catalog.js modalities.
const FIELD_MODALITIES = {
    peso:         ['strength'],
    reps:         ['strength', 'reps_only'],
    repeticiones: ['strength', 'reps_only'],
    rir:          ['strength', 'reps_only'],
    tempo:        ['strength'],
    intensidad:   ['strength'],
    tiempo:       ['cardio_distance', 'cardio_time', 'time_only'],
    distancia:    ['cardio_distance'],
    ritmo:        ['cardio_distance'],
};

function fieldAppliesToType(fieldKey, trackingType) {
    if (trackingType === 'custom') return true;
    const mods = FIELD_MODALITIES[(fieldKey || '').toLowerCase().trim()];
    if (!mods) return true; // universal field (series, rpe, descanso, notas, custom gym fields)
    return mods.includes(trackingType);
}

// ── Cardio target auto-calc (tiempo · distancia · ritmo) ─────────────────────
// Time is the anchor. Given tiempo + one of {distancia, ritmo}, compute the
// other:  ritmo(s/km) = tiempo(s) / distancia(km);  distancia = tiempo / ritmo.
function parseHmsToSeconds(str) {
    const s = String(str || '').trim();
    if (!s) return null;
    if (s.includes(':')) {
        const [m, sec] = s.split(':');
        const mm = parseInt(m || '0', 10);
        const ss = parseInt(sec || '0', 10);
        if (isNaN(mm) && isNaN(ss)) return null;
        return (isNaN(mm) ? 0 : mm) * 60 + (isNaN(ss) ? 0 : ss);
    }
    const n = parseFloat(s);
    return isNaN(n) ? null : n; // plain number = seconds
}
function secondsToMs(secs) {
    if (secs == null || isNaN(secs)) return '';
    const m = Math.floor(secs / 60);
    const s = Math.round(secs % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
}
/**
 * Recompute the cardio trio when one of tiempo/distancia/ritmo changes.
 * Returns a patch object of fields to set. Time is the anchor.
 */
function recalcCardio(changedKey, fields) {
    const tSec = parseHmsToSeconds(fields.tiempo);
    const distKm = fields.distancia != null && String(fields.distancia).trim() !== '' ? parseFloat(fields.distancia) : null;
    const paceSec = parseHmsToSeconds(fields.ritmo);
    const patch = {};

    if (!tSec) return patch; // no anchor yet — can't derive anything

    if (changedKey === 'ritmo' && paceSec && paceSec > 0) {
        // distancia = tiempo / ritmo
        patch.distancia = (tSec / paceSec).toFixed(2).replace(/\.00$/, '');
    } else if (changedKey === 'distancia' && distKm && distKm > 0) {
        // ritmo = tiempo / distancia
        patch.ritmo = secondsToMs(tSec / distKm);
    } else if (changedKey === 'tiempo') {
        // Re-derive whichever pair is consistent: prefer keeping distancia, recompute ritmo
        if (distKm && distKm > 0) patch.ritmo = secondsToMs(tSec / distKm);
        else if (paceSec && paceSec > 0) patch.distancia = (tSec / paceSec).toFixed(2).replace(/\.00$/, '');
    }
    return patch;
}

export default function ExerciseModal({
    isOpen,
    onClose,
    onSuccess = null,              // Callback for external handling
    initialCategory = null,       // pre-select category ID
    exerciseToEdit = null         // If provided, we are in EDIT mode
}) {
    const toast = useToast();
    const queryClient = useQueryClient();
    const [name, setName] = useState('');
    const [categoryId, setCategoryId] = useState(initialCategory || '');
    const [trackingType, setTrackingType] = useState('strength');
    const [videoUrl, setVideoUrl] = useState('');
    const [notes, setNotes] = useState('');
    const [customFields, setCustomFields] = useState({});

    // Fetch Field Configurations
    const { data: fieldConfigs = [] } = useQuery({
        queryKey: ['exercise-field-configs'],
        queryFn: async () => {
            const res = await window.api.training.getFieldConfigs();
            return res.success ? res.data : [];
        },
        enabled: isOpen
    });

    // The exercise base lets the trainer set DEFAULT prescriptions. Show only
    // the prescribable fields that apply to the selected tracking_type — e.g.
    // a running exercise hides peso / reps / tempo and keeps series / descanso.
    const activeFields = fieldConfigs.filter(
        f => f.is_active && f.is_prescribable !== 0 && fieldAppliesToType(f.field_key, trackingType)
    );

    // Fetch Categories
    const categories = queryClient.getQueryData(['categories']) || [];

    // --- MUTATIONS ---
    const createExercise = useMutation({
        mutationFn: (data) => window.api.training.createExercise(data),
        onSuccess: (res, variables) => {
            if (res.success) {
                queryClient.invalidateQueries({ queryKey: ['exercises'] });
                toast.success('Ejercicio creado con éxito');
                if (onSuccess) onSuccess({ ...variables, id: res.id });
                onCloseModal();
            } else {
                toast.error('Error al crear: ' + res.error);
            }
        },
        onError: (err) => {
            toast.error('Error de red al crear ejercicio');
        }
    });

    const updateExercise = useMutation({
        mutationFn: (data) => window.api.training.updateExercise(exerciseToEdit.id, data),
        onSuccess: (res, variables) => {
            if (res.success) {
                queryClient.invalidateQueries({ queryKey: ['exercises'] });
                toast.success('Ejercicio actualizado');
                if (onSuccess) onSuccess({ ...variables, id: exerciseToEdit.id });
                onCloseModal();
            } else {
                toast.error('Error al actualizar: ' + res.error);
            }
        },
        onError: (err) => {
            toast.error('Error de red al actualizar ejercicio');
        }
    });

    const isPending = createExercise.isPending || updateExercise.isPending;

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!name.trim() || !categoryId) {
            toast.warning('Nombre y Categoría son obligatorios');
            return;
        }

        // Drop any prescription values for fields that don't apply to the
        // chosen tracking_type (e.g. a stale "peso" after switching to cardio).
        const cleanedFields = {};
        for (const [k, v] of Object.entries(customFields)) {
            if (fieldAppliesToType(k, trackingType)) cleanedFields[k] = v;
        }

        const payload = {
            name,
            categoryId: parseInt(categoryId),
            tracking_type: trackingType,
            videoUrl,
            notes,
            custom_fields: cleanedFields
        };

        if (exerciseToEdit) {
            updateExercise.mutate(payload);
        } else {
            createExercise.mutate(payload);
        }
    };

    // Field change handler. For the cardio trio (tiempo/distancia/ritmo) it
    // also auto-fills the derived value (time is the anchor).
    const handleFieldChange = (key, value) => {
        setCustomFields(prev => {
            const next = { ...prev, [key]: value };
            const k = key.toLowerCase().trim();
            if (k === 'tiempo' || k === 'distancia' || k === 'ritmo') {
                Object.assign(next, recalcCardio(k, next));
            }
            return next;
        });
    };

    const onCloseModal = () => {
        // Reset form
        setName('');
        setTrackingType('strength');
        setVideoUrl('');
        setNotes('');
        setCustomFields({});
        onClose();
    };

    // Update state if props change (smart create / edit)
    useEffect(() => {
        if (isOpen) {
            if (exerciseToEdit) {
                setName(exerciseToEdit.name);
                setCategoryId(exerciseToEdit.category_id || '');
                setTrackingType(exerciseToEdit.tracking_type || 'strength');
                setVideoUrl(exerciseToEdit.video_url || '');
                setNotes(exerciseToEdit.notes || '');
                setCustomFields(exerciseToEdit.custom_fields || {});
            } else {
                setName('');
                setCategoryId(initialCategory || '');
                setTrackingType('strength');
                setVideoUrl('');
                setNotes('');
                setCustomFields({});
            }
        }
    }, [isOpen, initialCategory, exerciseToEdit]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 w-full max-w-lg rounded-2xl border border-white/10 shadow-2xl flex flex-col animate-in fade-in zoom-in duration-200">

                {/* HEAD */}
                <div className="p-6 border-b border-white/10 flex justify-between items-center bg-slate-800/50 rounded-t-2xl">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <Dumbbell className="text-blue-500" />
                        {exerciseToEdit ? 'Editar Ejercicio' : 'Nuevo Ejercicio'}
                    </h2>
                    <button onClick={onCloseModal} className="text-slate-400 hover:text-white">
                        <X size={24} />
                    </button>
                </div>

                {/* BODY */}
                <form onSubmit={handleSubmit} className="p-6 overflow-y-auto max-h-[75vh] space-y-4">

                    {/* Name */}
                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase mb-1.5 tracking-wider">Nombre del Ejercicio</label>
                        <input
                            autoFocus
                            type="text"
                            className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:border-blue-500 outline-none transition-all"
                            placeholder="Ej. Press Banca..."
                            value={name}
                            onChange={e => setName(e.target.value)}
                        />
                    </div>

                    {/* Category Selection */}
                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase mb-1.5 tracking-wider">
                            Categoría <span className="text-red-400">*</span>
                        </label>
                        <div className="relative">
                            <select
                                className={`w-full bg-slate-950 border rounded-xl px-4 py-2.5 text-white focus:border-blue-500 outline-none appearance-none transition-all pr-10 ${!categoryId ? 'border-red-500/40' : 'border-white/10'}`}
                                value={categoryId}
                                onChange={e => setCategoryId(e.target.value)}
                            >
                                <option value="">Seleccionar categoría...</option>
                                {categories.map(cat => (
                                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                                ))}
                            </select>
                            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" size={16} />
                        </div>
                        {categories.length === 0 && (
                            <p className="text-xs text-amber-400 mt-1.5">
                                No hay categorías. Crea una desde "Categorías" antes de añadir ejercicios.
                            </p>
                        )}
                    </div>

                    {/* Tracking type (exercise modality) */}
                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase mb-1.5 tracking-wider flex items-center gap-2">
                            <Activity size={14} className="text-emerald-400" /> Tipo de registro
                        </label>
                        <div className="relative">
                            <select
                                className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:border-blue-500 outline-none appearance-none transition-all pr-10"
                                value={trackingType}
                                onChange={e => setTrackingType(e.target.value)}
                            >
                                {TRACKING_TYPES.map(t => (
                                    <option key={t.key} value={t.key}>{t.label}</option>
                                ))}
                            </select>
                            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" size={16} />
                        </div>
                        <p className="text-[11px] text-slate-500 mt-1.5">
                            Define qué datos registra el cliente en la app móvil (kilos, tiempo, distancia...).
                        </p>
                    </div>

                    {/* DYNAMIC FIELDS */}
                    {activeFields.length > 0 && (
                        <div className="grid grid-cols-2 gap-4 pt-2 border-t border-white/5">
                            <h3 className="col-span-2 text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mb-1">Parámetros de Entrenamiento</h3>
                            {activeFields.map(field => (
                                <div key={field.field_key}>
                                    <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1.5 truncate" title={field.label}>
                                        {field.label}
                                    </label>
                                    {field.type === 'select' ? (
                                        <div className="relative">
                                            <select
                                                className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-2 text-white focus:border-blue-500 outline-none text-sm appearance-none transition-all pr-10"
                                                value={customFields[field.field_key] || ''}
                                                onChange={e => handleFieldChange(field.field_key, e.target.value)}
                                            >
                                                <option value="">Seleccionar...</option>
                                                {field.options?.map(opt => (
                                                    <option key={opt} value={opt}>{opt}</option>
                                                ))}
                                            </select>
                                            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" size={16} />
                                        </div>
                                    ) : (
                                        <input
                                            type={field.type === 'number' ? 'number' : 'text'}
                                            className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-2 text-white focus:border-blue-500 outline-none text-sm transition-all"
                                            placeholder={`${field.label}...`}
                                            value={customFields[field.field_key] || ''}
                                            onChange={e => handleFieldChange(field.field_key, e.target.value)}
                                        />
                                    )}
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Meta */}
                    <div className="space-y-4 pt-2 border-t border-white/5">
                        <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mb-1">Multimedia y Notas</h3>
                        <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase mb-1.5 flex items-center gap-2">
                                <Video size={14} className="text-red-500" /> URL de Video
                            </label>
                            <input
                                type="text"
                                className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-2 text-white focus:border-blue-500 outline-none text-sm font-mono"
                                placeholder="https://youtube.com/..."
                                value={videoUrl}
                                onChange={e => setVideoUrl(e.target.value)}
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase mb-1.5 flex items-center gap-2">
                                <FileText size={14} className="text-amber-500" /> Notas / Tips
                            </label>
                            <textarea
                                rows={3}
                                className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-2 text-white focus:border-blue-500 outline-none text-sm resize-none"
                                placeholder="Instrucciones técnicas..."
                                value={notes}
                                onChange={e => setNotes(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* FOOTER */}
                    <div className="pt-4 flex justify-end gap-3 border-t border-white/10">
                        <button
                            type="button"
                            onClick={onCloseModal}
                            className="px-6 py-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-all font-semibold"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={isPending}
                            className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-2 rounded-xl font-bold shadow-lg transition-all active:scale-95 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed min-w-[160px] justify-center"
                        >
                            {isPending ? (
                                <LoadingSpinner size="sm" color="white" />
                            ) : (
                                <><Save size={18} /> {exerciseToEdit ? 'Actualizar' : 'Guardar'}</>
                            )}
                        </button>
                    </div>

                </form>
            </div>
        </div>
    );
}
