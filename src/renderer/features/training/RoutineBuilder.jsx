import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import TemplateManager from './TemplateManager';
import ExerciseModal from './ExerciseModal';
import CategoryManager, { ICON_MAP } from './CategoryManager';
import { Search, Plus, X, Dumbbell, Activity, Trophy, Folder, Edit, Settings } from 'lucide-react';

export default function RoutineBuilder({ days, setDays, currentDayId }) {
    const [activeCategory, setActiveCategory] = useState(null); // categoryId
    const [activeSubcategory, setActiveSubcategory] = useState(null); // subcategoryId
    const [searchTerm, setSearchTerm] = useState('');
    const [showCatManager, setShowCatManager] = useState(false);
    const [exerciseToEdit, setExerciseToEdit] = useState(null);

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

    // Filter Logic
    const filteredExercises = exercises.filter(ex => {
        // Filter by Category
        if (activeCategory && ex.category_id !== activeCategory) return false;

        // Filter by Subcategory
        if (activeSubcategory && ex.subcategory_id !== activeSubcategory) return false;

        // Filter by Search
        if (searchTerm && !ex.name.toLowerCase().includes(searchTerm.toLowerCase())) return false;

        return true;
    });

    const selectedCategoryData = categories.find(c => c.id === activeCategory);

    // Actions
    const addExerciseToCurrentDay = (exercise) => {
        if (!currentDayId) return;

        setDays(days.map(day => {
            if (day.id === currentDayId) {
                return {
                    ...day,
                    items: [...day.items, {
                        exerciseId: exercise.id,
                        _guiId: crypto.randomUUID(), // Stable Key
                        exercise_name: exercise.name,
                        series: exercise.default_sets || 4,
                        reps: exercise.is_failure ? '∞' : (exercise.default_reps || '10-12'),
                        rpe: '',
                        notes: '',
                        intensity: exercise.default_intensity || ''
                    }]
                };
            }
            return day;
        }));
    };

    const updateItem = (dayId, itemIndex, field, value) => {
        setDays(days.map(day => {
            if (day.id === dayId) {
                const newItems = [...day.items];
                newItems[itemIndex] = { ...newItems[itemIndex], [field]: value };
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

    // Current Day Data
    const currentDay = days.find(d => d.id === currentDayId);

    return (
        <div className="flex flex-1 h-full gap-4 overflow-hidden">

            {/* LEFT PANEL: CATALOG (40%) */}
            <div className="w-2/5 flex flex-col bg-slate-900/50 rounded-2xl border border-white/5 overflow-hidden">

                {/* Header Actions */}
                <div className="flex items-center justify-between p-3 border-b border-white/5">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Biblioteca</h3>
                    <button
                        onClick={() => setShowCatManager(true)}
                        className="p-1.5 hover:bg-slate-800 rounded-lg text-blue-400 transition-colors"
                        title="Gestionar Categorías"
                    >
                        <Settings size={14} />
                    </button>
                </div>

                {/* Categories Tabs */}
                <div className="flex border-b border-white/5 overflow-x-auto no-scrollbar">
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
                                className={`flex-1 min-w-[30%] py-3 flex flex-col items-center justify-center gap-1.5 text-[10px] font-bold uppercase tracking-wider transition-colors border-b-2 ${isActive
                                    ? 'bg-slate-800 text-white border-blue-500'
                                    : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50 border-transparent'
                                    }`}
                            >
                                <Icon size={16} className={isActive ? 'text-blue-400' : ''} />
                                {cat.name}
                            </button>
                        );
                    })}
                </div>

                {/* Subcategories Filters (if category selected) */}
                {selectedCategoryData && selectedCategoryData.subcategories.length > 0 && (
                    <div className="flex gap-2 p-2 overflow-x-auto border-b border-white/5 no-scrollbar">
                        <button
                            onClick={() => setActiveSubcategory(null)}
                            className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap border ${!activeSubcategory
                                ? 'bg-blue-600/20 text-blue-400 border-blue-500/50'
                                : 'bg-slate-900 text-slate-500 border-white/10 hover:border-white/20'
                                }`}
                        >
                            Todo
                        </button>
                        {selectedCategoryData.subcategories.map(sub => (
                            <button
                                key={sub.id}
                                onClick={() => setActiveSubcategory(sub.id)}
                                className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap border ${activeSubcategory === sub.id
                                    ? 'bg-blue-600/20 text-blue-400 border-blue-500/50'
                                    : 'bg-slate-900 text-slate-500 border-white/10 hover:border-white/20'
                                    }`}
                            >
                                {sub.name}
                            </button>
                        ))}
                    </div>
                )}

                {/* Search */}
                <div className="p-3 border-b border-white/5">
                    <div className="relative">
                        <Search size={16} className="absolute left-3 top-2.5 text-slate-500" />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Buscar ejercicio..."
                            className="w-full bg-slate-950 border border-white/10 rounded-xl pl-9 pr-4 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                        />
                    </div>
                </div>

                {/* List */}
                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                    {isLoading ? (
                        <div className="text-center p-4 text-slate-500 text-xs">Cargando catálogo...</div>
                    ) : filteredExercises.length === 0 ? (
                        <div className="text-center p-4 text-slate-500 text-xs">No hay ejercicios aquí.</div>
                    ) : (
                        filteredExercises.map(ex => (
                            <button
                                key={ex.id}
                                onClick={() => addExerciseToCurrentDay(ex)}
                                onContextMenu={(e) => {
                                    e.preventDefault();
                                    setExerciseToEdit(ex);
                                }}
                                className="w-full text-left p-3 rounded-lg hover:bg-slate-800 border border-transparent hover:border-blue-500/30 group transition-all flex items-center justify-between"
                                title="Click para añadir, Click derecho para editar"
                            >
                                <span className="text-sm text-slate-300 font-medium group-hover:text-white truncate">
                                    {ex.name}
                                </span>
                                {ex.is_failure ? (
                                    <span className="text-[10px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded ml-2 font-bold">
                                        🔥 Al Fallo
                                    </span>
                                ) : ex.default_reps ? (
                                    <span className="text-[10px] bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded ml-2">
                                        {ex.default_reps} reps
                                    </span>
                                ) : null}
                                <Plus size={16} className="text-slate-600 group-hover:text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </button>
                        ))
                    )}
                </div>
            </div>

            {/* RIGHT PANEL: CANVAS (60%) */}
            <div className="flex-1 flex flex-col bg-slate-900/30 rounded-2xl border border-white/5 overflow-hidden">
                <div className="p-3 bg-slate-950/30 border-b border-white/5 flex justify-between items-center">
                    <h3 className="font-bold text-white text-sm">
                        {currentDay ? `${currentDay.name} (${currentDay.items.length} ejercicios)` : 'Selecciona un día'}
                    </h3>
                </div>

                <div className="flex-1 overflow-y-auto p-3 space-y-2">
                    {!currentDay ? (
                        <div className="h-full flex items-center justify-center text-slate-500 text-sm">
                            <p>Crea o selecciona un día para editar</p>
                        </div>
                    ) : currentDay.items.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-slate-500 text-sm border-2 border-dashed border-white/5 rounded-xl">
                            <Dumbbell size={32} className="opacity-20 mb-2" />
                            <p>Haz clic en los ejercicios de la izquierda</p>
                            <p>para añadirlos a la rutina</p>
                        </div>
                    ) : (
                        currentDay.items.map((item, idx) => (
                            <div key={item.id || item._guiId || idx} className="bg-slate-800 rounded-xl p-3 border border-white/5 flex flex-col gap-2 shadow-sm">
                                <div className="flex justify-between items-start">
                                    <span className="font-bold text-slate-200 text-sm flex gap-2">
                                        <span className="text-blue-500">#{idx + 1}</span>
                                        {item.exercise_name}
                                    </span>
                                    <button
                                        onClick={() => removeItem(currentDay.id, idx)}
                                        className="text-slate-600 hover:text-red-400"
                                    >
                                        <X size={14} />
                                    </button>
                                </div>

                                <div className="grid grid-cols-4 gap-2">
                                    <div className="col-span-1">
                                        <label className="text-[10px] text-slate-500 uppercase font-bold block mb-1">Series</label>
                                        <input
                                            type="number"
                                            value={item.series}
                                            onChange={(e) => updateItem(currentDay.id, idx, 'series', e.target.value)}
                                            className="w-full bg-slate-950 border border-white/10 rounded px-2 py-1 text-xs text-white focus:border-blue-500 outline-none"
                                        />
                                    </div>
                                    <div className="col-span-1">
                                        <label className="text-[10px] text-slate-500 uppercase font-bold block mb-1">Reps</label>
                                        <input
                                            type="text"
                                            value={item.reps}
                                            onChange={(e) => updateItem(currentDay.id, idx, 'reps', e.target.value)}
                                            className="w-full bg-slate-950 border border-white/10 rounded px-2 py-1 text-xs text-white focus:border-blue-500 outline-none"
                                        />
                                    </div>
                                    <div className="col-span-1">
                                        <label className="text-[10px] text-slate-500 uppercase font-bold block mb-1">Intensidad</label>
                                        <select
                                            value={item.intensity || ''}
                                            onChange={(e) => updateItem(currentDay.id, idx, 'intensity', e.target.value)}
                                            className="w-full bg-slate-950 border border-white/10 rounded px-2 py-1 text-xs text-white focus:border-blue-500 outline-none appearance-none"
                                        >
                                            <option value="">-</option>
                                            <option value="Baja">Baja</option>
                                            <option value="Media">Media</option>
                                            <option value="Alta">Alta</option>
                                            <option value="Máxima">Máxima</option>
                                        </select>
                                    </div>
                                    <div className="col-span-1">
                                        <label className="text-[10px] text-slate-500 uppercase font-bold block mb-1">Notas</label>
                                        <input
                                            type="text"
                                            value={item.notes}
                                            onChange={(e) => updateItem(currentDay.id, idx, 'notes', e.target.value)}
                                            placeholder="..."
                                            className="w-full bg-slate-950 border border-white/10 rounded px-2 py-1 text-xs text-white focus:border-blue-500 outline-none"
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
                isOpen={!!exerciseToEdit}
                onClose={() => setExerciseToEdit(null)}
                exerciseToEdit={exerciseToEdit}
            />
        </div>
    );
}
