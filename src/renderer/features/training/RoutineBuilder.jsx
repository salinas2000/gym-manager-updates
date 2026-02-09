import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import TemplateManager from './TemplateManager';
import ExerciseModal from './ExerciseModal';
import CategoryManager, { ICON_MAP } from './CategoryManager';
import { Search, Plus, X, Dumbbell, Activity, Trophy, Folder, Edit, Settings, ChevronDown } from 'lucide-react';

export default function RoutineBuilder({ days, setDays, currentDayId }) {
    const [activeCategory, setActiveCategory] = useState(null); // categoryId
    const [activeSubcategory, setActiveSubcategory] = useState(null); // subcategoryId
    const [searchTerm, setSearchTerm] = useState('');
    const [showCatManager, setShowCatManager] = useState(false);
    const [exerciseToEdit, setExerciseToEdit] = useState(null);
    const [showExerciseModal, setShowExerciseModal] = useState(false);
    const [expandedExerciseId, setExpandedExerciseId] = useState(null);

    // Query Exercises
    const { data: exercises = [], isLoading } = useQuery({
        queryKey: ['exercises'],
        queryFn: async () => {
            const res = await window.api.training.getExercises();
            return res.success ? res.data : [];
        }
    });

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

    // Filter active fields for NEW entry UI
    const activeFields = fieldConfigs.filter(f => f.is_active && !f.is_deleted);

    const filteredExercises = exercises.filter(ex => {
        if (activeCategory && ex.category_id !== activeCategory) return false;
        if (activeSubcategory && ex.subcategory_id !== activeSubcategory) return false;
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

        // Filter out deleted/orphaned fields
        const baseCustomFields = {};
        for (const [key, val] of Object.entries(rawFields)) {
            const fc = fieldConfigs.find(f => f.field_key === key);
            if (fc && !fc.is_deleted) {
                baseCustomFields[key] = val;
            }
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
                    item.custom_fields = {
                        ...(item.custom_fields || {}),
                        [field]: value
                    };
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

    const currentDay = days.find(d => d.id === currentDayId);

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

                {/* Subcategories Filters */}
                {selectedCategoryData && selectedCategoryData.subcategories.length > 0 && (
                    <div className="flex gap-2 p-2 overflow-x-auto border-b border-white/5 no-scrollbar bg-slate-900/20">
                        <button
                            onClick={() => setActiveSubcategory(null)}
                            className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider whitespace-nowrap border transition-all ${!activeSubcategory
                                ? 'bg-blue-600/20 text-blue-400 border-blue-500/40 shadow-sm'
                                : 'bg-slate-900/40 text-slate-500 border-white/5 hover:border-white/10'
                                }`}
                        >
                            Todo
                        </button>
                        {selectedCategoryData.subcategories.map(sub => (
                            <button
                                key={sub.id}
                                onClick={() => setActiveSubcategory(sub.id)}
                                className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider whitespace-nowrap border transition-all ${activeSubcategory === sub.id
                                    ? 'bg-blue-600/20 text-blue-400 border-blue-500/40 shadow-sm'
                                    : 'bg-slate-900/40 text-slate-500 border-white/5 hover:border-white/10'
                                    }`}
                            >
                                {sub.name}
                            </button>
                        ))}
                    </div>
                )}

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
                <div className="flex-1 overflow-y-auto p-2 space-y-2 bg-slate-950/20">
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
                            const hasFields = ex.custom_fields && Object.keys(ex.custom_fields).length > 0;

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
                                    {/* Card Header */}
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
                                                {ex.is_failure && (
                                                    <span className="text-[8px] text-red-500 font-extrabold uppercase tracking-tighter">
                                                        🔥 High Intensity / Failure
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <div className={`text-[9px] font-black uppercase tracking-widest transition-opacity duration-300 ${isExpanded ? 'text-blue-400 opacity-100' : 'opacity-0'}`}>
                                                Añadir
                                            </div>
                                        </div>
                                    </div>

                                    {/* Expanded Body */}
                                    {isExpanded && hasFields && (
                                        <div className="px-12 pb-3 pt-1 border-t border-white/[0.03] animate-in zoom-in-95 duration-300 fade-in">
                                            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                                                {Object.entries(ex.custom_fields).map(([key, val]) => {
                                                    const config = fieldConfigs.find(f => f.field_key === key);
                                                    if (!val || !config || config.is_deleted) return null;
                                                    return (
                                                        <div key={key} className="flex flex-col border-l border-white/5 pl-2">
                                                            <span className="text-[8px] font-black text-slate-500 uppercase tracking-[0.15em] mb-0.5">
                                                                {config.label}
                                                            </span>
                                                            <span className="text-[11px] text-slate-300 font-medium">
                                                                {val}
                                                            </span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
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
                </div>

                <div className="flex-1 overflow-y-auto p-3 space-y-2">
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
                        currentDay.items.map((item, idx) => (
                            <div key={item.id || item._guiId || idx} className="bg-slate-800/80 rounded-xl p-3 border border-white/5 flex flex-col gap-3 shadow-sm hover:border-white/10 transition-all">
                                <div className="flex justify-between items-center">
                                    <div className="flex items-center gap-3">
                                        <span className="bg-slate-950 text-blue-500 text-[10px] font-black w-6 h-6 rounded-lg flex items-center justify-center border border-white/5">
                                            {idx + 1}
                                        </span>
                                        <span className="font-bold text-slate-100 text-sm">
                                            {item.exercise_name}
                                        </span>
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

                                        // All keys that should be rendered:
                                        // 1. All active configurations
                                        // 2. Any field that HAS data AND has a valid (non-deleted) config
                                        const validItemKeys = itemKeys.filter(k => {
                                            const fc = fieldConfigs.find(f => f.field_key === k);
                                            return fc && !fc.is_deleted;
                                        });
                                        const allKeys = Array.from(new Set([...configKeys, ...validItemKeys]));

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
                        ))
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
        </div>
    );
}

function LoadingSpinner({ size = "md" }) {
    const sizes = { sm: "w-4 h-4", md: "w-8 h-8", lg: "w-12 h-12" };
    return (
        <div className={`${sizes[size]} border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin`} />
    );
}
