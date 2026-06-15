import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import TemplateManager from './TemplateManager';
import ExerciseModal from './ExerciseModal';
import CategoryManager, { ICON_MAP } from './CategoryManager';
import { Search, Plus, X, Dumbbell, Activity, Trophy, Folder, Edit, Settings, ChevronDown, GripVertical, Link2, Unlink } from 'lucide-react';

// ── Cardio target auto-calc (tiempo · distancia · ritmo) — time is the anchor ──
// Which prescription fields apply to each tracking type (mirror of
// field-catalog.js modalities + ExerciseModal.FIELD_MODALITIES).
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
    if (!trackingType || trackingType === 'custom') return true;
    const mods = FIELD_MODALITIES[(fieldKey || '').toLowerCase().trim()];
    if (!mods) return true; // universal (series, rpe, descanso, notas, custom)
    return mods.includes(trackingType);
}

// Map each item index to its superset info ({ letter, pos }) or null. A superset
// is a contiguous run of items sharing the same non-null superset_group (≥2
// items). Letters A, B, C… are assigned by order of appearance in the day.
function buildSupersetMap(items) {
    const info = new Array(items.length).fill(null);
    let letterIdx = 0;
    let i = 0;
    while (i < items.length) {
        const g = items[i]?.superset_group;
        if (g == null) { i++; continue; }
        let j = i;
        while (j < items.length && items[j]?.superset_group === g) j++;
        if (j - i >= 2) {
            const letter = String.fromCharCode(65 + letterIdx++);
            const rounds = items[i]?.superset_rounds ?? null;
            for (let k = i; k < j; k++) info[k] = { letter, pos: k - i + 1, group: g, rounds, count: j - i };
        }
        i = j;
    }
    return info;
}

// Unit is MINUTES. "30" → 30 min; "6,5"/"6.5" → 6.5 min; "5:30" → 5 min 30 s.
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
    const mins = parseFloat(s.replace(',', '.'));
    return isNaN(mins) ? null : mins * 60;
}
function secondsToMs(secs) {
    if (secs == null || isNaN(secs)) return '';
    const m = Math.floor(secs / 60);
    const s = Math.round(secs % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
}
// Distancia in METERS, ritmo min/km, tiempo is the anchor.
function recalcCardio(changedKey, fields) {
    const tSec = parseHmsToSeconds(fields.tiempo);
    const distM = fields.distancia != null && String(fields.distancia).trim() !== ''
        ? parseFloat(String(fields.distancia).replace(',', '.')) : null;
    const paceSec = parseHmsToSeconds(fields.ritmo);
    const patch = {};
    if (!tSec) return patch;
    if (changedKey === 'ritmo' && paceSec && paceSec > 0) {
        patch.distancia = String(Math.round(tSec / paceSec * 1000));
    } else if (changedKey === 'distancia' && distM && distM > 0) {
        patch.ritmo = secondsToMs(tSec / (distM / 1000));
    } else if (changedKey === 'tiempo') {
        if (distM && distM > 0) patch.ritmo = secondsToMs(tSec / (distM / 1000));
        else if (paceSec && paceSec > 0) patch.distancia = String(Math.round(tSec / paceSec * 1000));
    }
    return patch;
}

export default function RoutineBuilder({ days, setDays, currentDayId }) {
    const [activeCategory, setActiveCategory] = useState(null); // categoryId
    const [activeSubcategory, setActiveSubcategory] = useState(null); // subcategoryId
    const [searchTerm, setSearchTerm] = useState('');
    const [showCatManager, setShowCatManager] = useState(false);
    const [exerciseToEdit, setExerciseToEdit] = useState(null);
    const [showExerciseModal, setShowExerciseModal] = useState(false);
    const [expandedExerciseId, setExpandedExerciseId] = useState(null);
    const [dragIndex, setDragIndex] = useState(null);
    const [dragOverIndex, setDragOverIndex] = useState(null);
    // Superset creation modal
    const [showSupersetModal, setShowSupersetModal] = useState(false);
    const [ssSelection, setSsSelection] = useState([]); // selected item indices
    const [ssRounds, setSsRounds] = useState(4);

    // Query Exercises
    const { data: exercises = [], isLoading } = useQuery({
        queryKey: ['exercises'],
        queryFn: async () => {
            const res = await window.api.training.getExercises();
            return res.success ? res.data : [];
        }
    });

    // exercise id → tracking_type, so each routine row only shows the
    // prescription fields that apply to that exercise's modality.
    const trackingByExerciseId = React.useMemo(() => {
        const m = new Map();
        for (const ex of exercises) m.set(ex.id, ex.tracking_type || 'strength');
        return m;
    }, [exercises]);

    // Query Categories
    const { data: categories = [] } = useQuery({
        queryKey: ['categories'],
        queryFn: async () => {
            const res = await window.api.training.getCategories();
            return res.success ? res.data : [];
        }
    });

    // Query Field Configs
    const { data: fieldConfigs = [] } = useQuery({
        queryKey: ['exercise-field-configs-all'],
        queryFn: async () => {
            const res = await window.api.training.getAllFieldConfigs();
            return res.success ? res.data : [];
        }
    });

    // Fields the TRAINER can prescribe in the routine. Anything flagged
    // is_prescribable (which is most of the catalog except Notas) appears.
    // Fields that are ALSO loggable (Peso, Repeticiones, RPE, RIR) still
    // appear here — the prescribed value becomes the customer's placeholder
    // in the mobile, and the customer logs the actual value per set.
    const activeFields = fieldConfigs.filter(
        f => f.is_active && !f.is_deleted && f.is_prescribable !== 0
    );

    const filteredExercises = exercises.filter(ex => {
        if (activeCategory && ex.category_id !== activeCategory) return false;
        // Subcategory filter deprecated
        if (searchTerm && !ex.name.toLowerCase().includes(searchTerm.toLowerCase())) return false;
        return true;
    });

    const selectedCategoryData = categories.find(c => c.id === activeCategory);

    // Actions
    const addExerciseToCurrentDay = (exercise) => {
        if (!currentDayId) return;

        const rawFields = typeof exercise.custom_fields === 'string'
            ? JSON.parse(exercise.custom_fields)
            : (exercise.custom_fields || {});

        // Filter out:
        //   - deleted/orphan fields (no live config)
        //   - fields that are NOT prescribable (e.g. Notas — pure customer side)
        const baseCustomFields = {};
        for (const [key, val] of Object.entries(rawFields)) {
            const fc = fieldConfigs.find(f => f.field_key === key);
            if (!fc || fc.is_deleted) continue;
            if (fc.is_prescribable === 0) continue;
            baseCustomFields[key] = val;
        }

        setDays(days.map(day => {
            if (day.id === currentDayId) {
                return {
                    ...day,
                    items: [...day.items, {
                        exerciseId: exercise.id,
                        _guiId: crypto.randomUUID(),
                        exercise_name: exercise.name,
                        notes: '',
                        custom_fields: { ...baseCustomFields }
                    }]
                };
            }
            return day;
        }));
    };

    const handleNewExerciseSuccess = (newExercise) => {
        if (!currentDayId) return;
        addExerciseToCurrentDay({
            id: newExercise.id,
            name: newExercise.name,
            custom_fields: newExercise.custom_fields
        });
    };

    const updateItem = (dayId, itemIndex, field, value) => {
        setDays(days.map(day => {
            if (day.id === dayId) {
                const newItems = [...day.items];
                const item = { ...newItems[itemIndex] };

                if (field === 'notes') {
                    item.notes = value;
                } else {
                    const nextFields = {
                        ...(item.custom_fields || {}),
                        [field]: value
                    };
                    // Auto-fill the cardio trio (tiempo/distancia/ritmo).
                    const k = String(field).toLowerCase().trim();
                    if (k === 'tiempo' || k === 'distancia' || k === 'ritmo') {
                        Object.assign(nextFields, recalcCardio(k, nextFields));
                    }
                    item.custom_fields = nextFields;
                }

                newItems[itemIndex] = item;
                return { ...day, items: newItems };
            }
            return day;
        }));
    };

    const removeItem = (dayId, itemIndex) => {
        setDays(days.map(day => {
            if (day.id === dayId) {
                const newItems = [...day.items];
                newItems.splice(itemIndex, 1);
                return { ...day, items: newItems };
            }
            return day;
        }));
    };

    const reorderItem = (dayId, fromIndex, toIndex) => {
        if (fromIndex === toIndex) return;
        setDays(days.map(day => {
            if (day.id === dayId) {
                const newItems = [...day.items];
                const [moved] = newItems.splice(fromIndex, 1);
                newItems.splice(toIndex, 0, moved);
                return { ...day, items: newItems };
            }
            return day;
        }));
    };

    // Create a superset from the selected item indices: tag them with a fresh
    // group + rounds and pull them together (contiguous) at the first selected
    // position, preserving their relative order.
    const createSuperset = (dayId, indices, rounds) => {
        const sel = [...new Set(indices)].sort((a, b) => a - b);
        if (sel.length < 2) return;
        setDays(days.map(day => {
            if (day.id !== dayId) return day;
            const items = [...day.items];
            const maxG = items.reduce((m, it) => Math.max(m, it.superset_group ?? 0), 0);
            const group = maxG + 1;
            const picked = sel.map(i => ({ ...items[i], superset_group: group, superset_rounds: rounds }));
            const firstPos = sel[0];
            let insertAt = 0;
            for (let i = 0; i < firstPos; i++) if (!sel.includes(i)) insertAt++;
            const remaining = items.filter((_, i) => !sel.includes(i));
            remaining.splice(insertAt, 0, ...picked);
            return { ...day, items: remaining };
        }));
    };

    // Dissolve a whole superset (clear group + rounds on all its items).
    const dissolveSuperset = (dayId, group) => {
        setDays(days.map(day => {
            if (day.id !== dayId) return day;
            return { ...day, items: day.items.map(it => it.superset_group === group ? { ...it, superset_group: null, superset_rounds: null } : it) };
        }));
    };

    // Change the rounds ("nº de veces") of an existing superset.
    const setSupersetRounds = (dayId, group, rounds) => {
        setDays(days.map(day => {
            if (day.id !== dayId) return day;
            return { ...day, items: day.items.map(it => it.superset_group === group ? { ...it, superset_rounds: rounds } : it) };
        }));
    };

    const handleDragStart = (e, idx) => {
        setDragIndex(idx);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', idx.toString());
        // Make drag image slightly transparent
        if (e.target) {
            setTimeout(() => {
                e.target.style.opacity = '0.4';
            }, 0);
        }
    };

    const handleDragEnd = (e) => {
        e.target.style.opacity = '1';
        if (dragIndex !== null && dragOverIndex !== null && dragIndex !== dragOverIndex) {
            reorderItem(currentDayId, dragIndex, dragOverIndex);
        }
        setDragIndex(null);
        setDragOverIndex(null);
    };

    const handleDragOver = (e, idx) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        setDragOverIndex(idx);
    };

    const currentDay = days.find(d => d.id === currentDayId);
    const supersetMap = currentDay ? buildSupersetMap(currentDay.items) : [];

    return (
        <div className="flex flex-1 h-full gap-4 overflow-hidden">

            {/* LEFT PANEL: CATALOG (40%) */}
            <div className="w-2/5 flex flex-col bg-slate-900/50 rounded-2xl border border-white/5 overflow-hidden">

                {/* Header Actions */}
                <div className="p-3 border-b border-white/5 flex justify-between items-center bg-slate-800/20">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Biblioteca</h3>
                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => setShowExerciseModal(true)}
                            className="p-1.5 hover:bg-blue-500/10 rounded-lg text-blue-400 transition-colors flex items-center gap-1.5 text-[10px] font-bold uppercase"
                            title="Nuevo Ejercicio"
                        >
                            <Plus size={14} />
                            Nuevo
                        </button>
                        <button
                            onClick={() => setShowCatManager(true)}
                            className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 transition-colors"
                            title="Gestionar Categorías"
                        >
                            <Settings size={14} />
                        </button>
                    </div>
                </div>

                {/* Categories Tabs */}
                <div className="flex border-b border-white/5 overflow-x-auto no-scrollbar bg-slate-900/40">
                    {categories.map(cat => {
                        const Icon = ICON_MAP[cat.icon] || Folder;
                        const isActive = activeCategory === cat.id;
                        return (
                            <button
                                key={cat.id}
                                onClick={() => {
                                    setActiveCategory(isActive ? null : cat.id);
                                    setActiveSubcategory(null);
                                }}
                                className={`flex-1 min-w-[33.3%] py-3 flex flex-col items-center justify-center gap-1.5 text-[9px] font-bold uppercase tracking-widest transition-all border-b-2 ${isActive
                                    ? 'bg-slate-800/80 text-white border-blue-500 shadow-[inset_0_0_20px_rgba(59,130,246,0.1)]'
                                    : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/40 border-transparent'
                                    }`}
                            >
                                <Icon size={16} className={isActive ? 'text-blue-400' : ''} />
                                {cat.name}
                            </button>
                        );
                    })}
                </div>

                {/* Subcategories deprecated — only categories are used now */}

                {/* Search */}
                <div className="p-3 border-b border-white/5 bg-slate-900/10">
                    <div className="relative">
                        <Search size={14} className="absolute left-3 top-2.5 text-slate-600" />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Buscar ejercicio..."
                            className="w-full bg-slate-950/50 border border-white/5 rounded-xl pl-9 pr-4 py-2 text-xs text-white focus:outline-none focus:border-blue-500/50 transition-all placeholder:text-slate-700"
                        />
                    </div>
                </div>

                {/* List - Expandable Cards */}
                <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-2 bg-slate-950/20">
                    {isLoading ? (
                        <div className="py-8 flex flex-col items-center gap-3">
                            <LoadingSpinner size="sm" />
                            <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Cargando biblioteca</span>
                        </div>
                    ) : filteredExercises.length === 0 ? (
                        <div className="text-center py-12 px-6">
                            <Dumbbell className="mx-auto text-slate-800 mb-3" size={32} />
                            <p className="text-slate-500 text-xs font-medium italic">No se encontraron ejercicios</p>
                        </div>
                    ) : (
                        filteredExercises.map(ex => {
                            const isExpanded = expandedExerciseId === ex.id;
                            const subtitle = [
                                ex.subcategory_name || ex.category_name,
                                ex.default_sets ? `${ex.default_sets}x${ex.default_reps || '?'}` : null
                            ].filter(Boolean).join(' · ');

                            return (
                                <div
                                    key={ex.id}
                                    onMouseEnter={() => setExpandedExerciseId(ex.id)}
                                    onMouseLeave={() => setExpandedExerciseId(null)}
                                    onClick={() => addExerciseToCurrentDay(ex)}
                                    className={`rounded-xl border transition-all duration-300 group overflow-hidden cursor-pointer ${isExpanded
                                        ? 'bg-slate-800 border-blue-500/40 shadow-xl shadow-blue-500/10 -translate-y-0.5'
                                        : 'bg-slate-900/30 border-white/[0.03] hover:border-white/10 hover:bg-slate-800/40'
                                        }`}
                                >
                                    <div
                                        onContextMenu={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            setExerciseToEdit(ex);
                                        }}
                                        className="p-3 flex items-center justify-between transition-transform active:scale-[0.98]"
                                    >
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className={`p-1.5 rounded-lg transition-colors ${isExpanded ? 'bg-blue-500/20 text-blue-400' : 'bg-slate-800 text-slate-500 group-hover:bg-slate-700'}`}>
                                                <Activity size={12} />
                                            </div>
                                            <div className="flex flex-col min-w-0">
                                                <span className={`text-[13px] font-bold truncate transition-colors ${isExpanded ? 'text-white' : 'text-slate-300 group-hover:text-slate-100'}`}>
                                                    {ex.name}
                                                </span>
                                                {subtitle && (
                                                    <span className="text-[10px] text-slate-500 truncate">
                                                        {subtitle}
                                                    </span>
                                                )}
                                                {!!ex.is_failure && (
                                                    <span className="text-[8px] text-red-500 font-extrabold uppercase tracking-tighter">
                                                        Al fallo
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        <div className={`text-[9px] font-black uppercase tracking-widest transition-opacity duration-300 ${isExpanded ? 'text-blue-400 opacity-100' : 'opacity-0'}`}>
                                            + Añadir
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            {/* RIGHT PANEL: CANVAS (60%) */}
            <div className="flex-1 flex flex-col bg-slate-900/30 rounded-2xl border border-white/5 overflow-hidden">
                <div className="p-3 bg-slate-950/30 border-b border-white/5 flex justify-between items-center">
                    <h3 className="font-bold text-white text-sm flex items-center gap-2">
                        <Trophy size={16} className="text-amber-500" />
                        {currentDay ? `${currentDay.name} (${currentDay.items.length} ejercicios)` : 'Selecciona un día'}
                    </h3>
                    {currentDay && currentDay.items.length >= 2 && (
                        <button
                            onClick={() => { setSsSelection([]); setSsRounds(4); setShowSupersetModal(true); }}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider bg-violet-500/10 text-violet-300 border border-violet-500/25 hover:bg-violet-500/20 transition-all"
                            title="Agrupar ejercicios en una superserie"
                        >
                            <Link2 size={13} />
                            Crear superserie
                        </button>
                    )}
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2">
                    {!currentDay ? (
                        <div className="h-full flex items-center justify-center text-slate-500 text-sm italic">
                            <p>Crea o selecciona un día para empezar a construir la rutina</p>
                        </div>
                    ) : currentDay.items.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-slate-500 text-sm border-2 border-dashed border-white/5 rounded-2xl bg-slate-900/10">
                            <Dumbbell size={32} className="opacity-10 mb-3" />
                            <p className="font-medium">Tu rutina está vacía</p>
                            <p className="text-[10px] uppercase tracking-widest mt-1 opacity-50">Añade ejercicios de la biblioteca</p>
                        </div>
                    ) : (
                        currentDay.items.map((item, idx) => {
                            const ss = supersetMap[idx];
                            return (
                            <div
                                key={item.id || item._guiId || idx}
                                draggable
                                onDragStart={(e) => handleDragStart(e, idx)}
                                onDragEnd={handleDragEnd}
                                onDragOver={(e) => handleDragOver(e, idx)}
                                onDrop={(e) => { e.preventDefault(); }}
                                className={`bg-slate-800/80 rounded-xl p-3 border flex flex-col gap-3 shadow-sm transition-all ${ss ? 'border-l-2 border-l-violet-500/70' : ''} ${dragOverIndex === idx && dragIndex !== idx
                                    ? 'border-blue-500/60 bg-blue-500/5 scale-[1.01]'
                                    : 'border-white/5 hover:border-white/10'
                                }`}
                            >
                                <div className="flex justify-between items-center">
                                    <div className="flex items-center gap-3">
                                        <div className="flex items-center gap-1 cursor-grab active:cursor-grabbing select-none" title="Arrastrar para reordenar">
                                            <GripVertical size={14} className="text-slate-600 hover:text-slate-400 transition-colors flex-shrink-0" />
                                            <span className={`text-[10px] font-black w-6 h-6 rounded-lg flex items-center justify-center border ${ss ? 'bg-violet-500/15 text-violet-300 border-violet-500/30' : 'bg-slate-950 text-blue-500 border-white/5'}`}>
                                                {ss ? `${ss.letter}${ss.pos}` : idx + 1}
                                            </span>
                                        </div>
                                        <span className="font-bold text-slate-100 text-sm">
                                            {item.exercise_name}
                                        </span>
                                        {ss && ss.pos === 1 && (
                                            <div className="flex items-center gap-1.5 ml-1">
                                                <span className="text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-violet-500/15 text-violet-300 border border-violet-500/25">
                                                    Superserie {ss.letter}
                                                </span>
                                                <span className="flex items-center gap-1 text-[10px] text-slate-400">
                                                    <input
                                                        type="number"
                                                        min={1}
                                                        max={20}
                                                        value={ss.rounds ?? ''}
                                                        onChange={(e) => setSupersetRounds(currentDay.id, ss.group, e.target.value === '' ? null : Math.max(1, parseInt(e.target.value, 10) || 1))}
                                                        className="w-10 bg-slate-950 border border-violet-500/20 rounded px-1 py-0.5 text-[10px] text-center text-white outline-none focus:border-violet-500"
                                                        title="Número de veces (rondas)"
                                                    />
                                                    veces
                                                </span>
                                                <button
                                                    onClick={() => dissolveSuperset(currentDay.id, ss.group)}
                                                    title="Deshacer la superserie"
                                                    className="p-1 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded transition-all"
                                                >
                                                    <Unlink size={12} />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                    <button
                                        onClick={() => removeItem(currentDay.id, idx)}
                                        className="p-1.5 text-slate-600 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                                    >
                                        <X size={14} />
                                    </button>
                                </div>

                                <div className="grid grid-cols-4 gap-3">
                                    {(() => {
                                        // Merge active configs with existing fields in the item
                                        const itemFields = item.custom_fields || {};
                                        const itemKeys = Object.keys(itemFields);
                                        const configKeys = activeFields.map(f => f.field_key);

                                        // Keys to render: every prescribable catalog field plus any
                                        // legacy item key that's still prescribable.
                                        const validItemKeys = itemKeys.filter(k => {
                                            const fc = fieldConfigs.find(f => f.field_key === k);
                                            return fc && !fc.is_deleted && fc.is_prescribable !== 0;
                                        });
                                        // Only show the fields that apply to THIS exercise's tracking
                                        // type (e.g. a running exercise shows tiempo/distancia/ritmo,
                                        // not peso/reps). A field already filled keeps showing so old
                                        // data isn't hidden.
                                        const trackingType = trackingByExerciseId.get(item.exerciseId ?? item.exercise_id);
                                        const allKeys = Array.from(new Set([...configKeys, ...validItemKeys]))
                                            .filter(k => fieldAppliesToType(k, trackingType) || (itemFields[k] != null && itemFields[k] !== ''));

                                        return allKeys.map(key => {
                                            const field = fieldConfigs.find(f => f.field_key === key);
                                            const val = itemFields[key] || '';

                                            // If the field is inactive AND has no value, don't show it for new entry
                                            if (field && !field.is_active && !val) return null;

                                            const label = field ? field.label : (key.charAt(0).toUpperCase() + key.slice(1));
                                            const isOrphaned = !field;

                                            return (
                                                <div key={key} className="col-span-1">
                                                    <label
                                                        className={`text-[9px] uppercase font-black tracking-widest block mb-1.5 truncate ${isOrphaned ? 'text-amber-500/70' : 'text-slate-500'}`}
                                                        title={isOrphaned ? `${label} (Campo eliminado de la configuración)` : label}
                                                    >
                                                        {label} {isOrphaned && '*'}
                                                    </label>
                                                    {field?.type === 'select' ? (
                                                        <div className="relative">
                                                            <select
                                                                value={val}
                                                                onChange={(e) => updateItem(currentDay.id, idx, key, e.target.value)}
                                                                className="w-full bg-slate-950 border border-white/10 rounded-lg px-2.5 py-1.5 text-[11px] text-white focus:border-blue-500 outline-none appearance-none transition-all pr-8"
                                                            >
                                                                <option value="">...</option>
                                                                {field.options?.map(opt => (
                                                                    <option key={opt} value={opt}>{opt}</option>
                                                                ))}
                                                                {val && !field.options?.includes(val) && (
                                                                    <option value={val}>{val}</option>
                                                                )}
                                                            </select>
                                                            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-600 pointer-events-none" size={12} />
                                                        </div>
                                                    ) : (
                                                        <input
                                                            type={field?.type === 'number' ? 'number' : 'text'}
                                                            value={val}
                                                            onChange={(e) => updateItem(currentDay.id, idx, key, e.target.value)}
                                                            placeholder="..."
                                                            className={`w-full bg-slate-950 border rounded-lg px-2.5 py-1.5 text-[11px] text-white focus:border-blue-500 outline-none transition-all ${isOrphaned ? 'border-amber-500/20' : 'border-white/10'}`}
                                                        />
                                                    )}
                                                </div>
                                            );
                                        });
                                    })()}
                                    <div className="col-span-1">
                                        <label className="text-[9px] text-slate-500 uppercase font-black tracking-widest block mb-1.5">Notas</label>
                                        <input
                                            type="text"
                                            value={item.notes || ''}
                                            onChange={(e) => updateItem(currentDay.id, idx, 'notes', e.target.value)}
                                            placeholder="..."
                                            className="w-full bg-slate-950 border border-white/10 rounded-lg px-2.5 py-1.5 text-[11px] text-white focus:border-blue-500 outline-none transition-all"
                                        />
                                    </div>
                                </div>
                            </div>
                            );
                        })
                    )}
                </div>
            </div>

            {/* Modals */}
            <ExerciseModal
                isOpen={showExerciseModal || !!exerciseToEdit}
                onClose={() => {
                    setShowExerciseModal(false);
                    setExerciseToEdit(null);
                }}
                exerciseToEdit={exerciseToEdit}
                onSuccess={handleNewExerciseSuccess}
                initialCategory={activeCategory}
                initialSubcategory={activeSubcategory}
            />

            {/* Crear superserie */}
            {showSupersetModal && currentDay && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[70] flex items-center justify-center p-4" onClick={() => setShowSupersetModal(false)}>
                    <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-md shadow-2xl flex flex-col max-h-[80vh]" onClick={(e) => e.stopPropagation()}>
                        <div className="p-5 border-b border-white/10 flex items-center justify-between">
                            <h2 className="text-lg font-black text-white flex items-center gap-2">
                                <Link2 size={18} className="text-violet-400" /> Crear superserie
                            </h2>
                            <button onClick={() => setShowSupersetModal(false)} className="text-slate-400 hover:text-white">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-5 space-y-3 overflow-y-auto">
                            <p className="text-xs text-slate-400">
                                Elige los ejercicios que se harán encadenados, sin descanso entre ellos.
                            </p>
                            <div className="space-y-1.5">
                                {currentDay.items.map((it, i) => {
                                    const inSs = supersetMap[i];
                                    const checked = ssSelection.includes(i);
                                    return (
                                        <label
                                            key={it.id || it._guiId || i}
                                            className={`flex items-center gap-3 p-2.5 rounded-xl border transition-all ${inSs
                                                ? 'border-white/5 bg-slate-950/30 opacity-50 cursor-not-allowed'
                                                : checked
                                                    ? 'border-violet-500/50 bg-violet-500/10 cursor-pointer'
                                                    : 'border-white/5 bg-slate-950/40 hover:border-white/10 cursor-pointer'}`}
                                        >
                                            <input
                                                type="checkbox"
                                                disabled={!!inSs}
                                                checked={checked}
                                                onChange={(e) => setSsSelection(prev => e.target.checked ? [...prev, i] : prev.filter(x => x !== i))}
                                                className="accent-violet-500 w-4 h-4"
                                            />
                                            <span className="flex-1 text-sm font-bold text-slate-100">{it.exercise_name}</span>
                                            {inSs && <span className="text-[10px] font-black text-violet-300">Ya en Superserie {inSs.letter}</span>}
                                        </label>
                                    );
                                })}
                            </div>
                        </div>
                        <div className="p-5 border-t border-white/10 flex items-center justify-between gap-3">
                            <label className="flex items-center gap-2 text-xs font-bold text-slate-300">
                                Nº de veces
                                <input
                                    type="number"
                                    min={1}
                                    max={20}
                                    value={ssRounds}
                                    onChange={(e) => setSsRounds(Math.max(1, parseInt(e.target.value, 10) || 1))}
                                    className="w-16 bg-slate-950 border border-white/10 rounded-lg px-2 py-1.5 text-sm text-center text-white outline-none focus:border-violet-500"
                                />
                            </label>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setShowSupersetModal(false)}
                                    className="px-4 py-2 rounded-xl text-sm font-bold bg-slate-800 text-slate-300 hover:bg-slate-700 transition-all"
                                >
                                    Cancelar
                                </button>
                                <button
                                    disabled={ssSelection.length < 2}
                                    onClick={() => { createSuperset(currentDay.id, ssSelection, ssRounds); setShowSupersetModal(false); }}
                                    className="px-4 py-2 rounded-xl text-sm font-bold bg-violet-600 text-white hover:bg-violet-500 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    Crear ({ssSelection.length})
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function LoadingSpinner({ size = "md" }) {
    const sizes = { sm: "w-4 h-4", md: "w-8 h-8", lg: "w-12 h-12" };
    return (
        <div className={`${sizes[size]} border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin`} />
    );
}
