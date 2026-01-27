import React, { useState, useEffect } from 'react';
import { X, Save, Video, FileText, Dumbbell } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

export default function ExerciseModal({
    isOpen,
    onClose,
    initialCategory = null,       // pre-select category ID
    initialSubcategory = null,    // pre-select subcategory ID
    exerciseToEdit = null         // If provided, we are in EDIT mode
}) {
    // if (!isOpen) return null; // Removed early return to fix Hook rule violation

    const queryClient = useQueryClient();
    const [name, setName] = useState('');
    const [categoryId, setCategoryId] = useState(initialCategory || '');
    const [subcategoryId, setSubcategoryId] = useState(initialSubcategory || '');
    const [videoUrl, setVideoUrl] = useState('');
    const [notes, setNotes] = useState('');
    // Defaults
    const [defaultSets, setDefaultSets] = useState(4);
    const [defaultReps, setDefaultReps] = useState('');
    const [isFailure, setIsFailure] = useState(false);
    const [defaultIntensity, setDefaultIntensity] = useState('');

    // Fetch Categories (assuming they are already cached, but fine to fetch again or use context)
    // We can access the cache directly or use useQuery. Since this is a modal, minimal fetch is fine.
    const categories = queryClient.getQueryData(['categories']) || [];

    // Derived subcategories based on selection
    const selectedCategoryData = categories.find(c => c.id === parseInt(categoryId));
    const availableSubcategories = selectedCategoryData?.subcategories || [];

    // --- MUTATIONS ---
    const createExercise = useMutation({
        mutationFn: (data) => window.api.training.createExercise(data),
        onSuccess: (res) => {
            if (res.success) {
                queryClient.invalidateQueries(['exercises']);
                onCloseModal();
            } else {
                alert('Error al crear: ' + res.error);
            }
        }
    });

    const updateExercise = useMutation({
        mutationFn: (data) => window.api.training.updateExercise(exerciseToEdit.id, data),
        onSuccess: (res) => {
            if (res.success) {
                queryClient.invalidateQueries(['exercises']);
                onCloseModal();
            } else {
                alert('Error al actualizar: ' + res.error);
            }
        }
    });

    const isPending = createExercise.isPending || updateExercise.isPending;

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!name.trim() || !categoryId) {
            alert('Nombre y Categoría son obligatorios');
            return;
        }

        const payload = {
            name,
            categoryId: parseInt(categoryId),
            subcategoryId: subcategoryId ? parseInt(subcategoryId) : null,
            subcategoryId: subcategoryId ? parseInt(subcategoryId) : null,
            videoUrl,
            notes,
            default_sets: defaultSets,
            default_reps: defaultReps,
            is_failure: isFailure,
            default_intensity: defaultIntensity
        };

        if (exerciseToEdit) {
            updateExercise.mutate(payload);
        } else {
            createExercise.mutate(payload);
        }
    };

    const onCloseModal = () => {
        // Reset form
        setName('');
        setVideoUrl('');
        setNotes('');
        onClose();
    };

    // Update state if props change (smart create / edit)
    useEffect(() => {
        if (isOpen) {
            if (exerciseToEdit) {
                // Edit Mode
                setName(exerciseToEdit.name);
                setCategoryId(exerciseToEdit.category_id);
                setSubcategoryId(exerciseToEdit.subcategory_id || '');
                setVideoUrl(exerciseToEdit.video_url || '');
                setNotes(exerciseToEdit.notes || '');
                setDefaultSets(exerciseToEdit.default_sets || 4);
                setDefaultReps(exerciseToEdit.default_reps || '');
                setIsFailure(!!exerciseToEdit.is_failure);
                setDefaultIntensity(exerciseToEdit.default_intensity || '');
            } else {
                // Create Mode
                setName('');
                setCategoryId(initialCategory || '');
                setSubcategoryId(initialSubcategory || '');
                setVideoUrl('');
                setNotes('');
                setDefaultSets(4);
                setDefaultReps('');
                setIsFailure(false);
                setDefaultIntensity('');
            }
        }
    }, [isOpen, initialCategory, initialSubcategory, exerciseToEdit]);

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
                <form onSubmit={handleSubmit} className="p-6 space-y-4">

                    {/* Name */}
                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Nombre del Ejercicio</label>
                        <input
                            autoFocus
                            type="text"
                            className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-2 text-white focus:border-blue-500 outline-none"
                            placeholder="Ej. Press Banca..."
                            value={name}
                            onChange={e => setName(e.target.value)}
                        />
                    </div>

                    {/* Category Selection */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Categoría</label>
                            <select
                                className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-2 text-white focus:border-blue-500 outline-none appearance-none"
                                value={categoryId}
                                onChange={e => {
                                    setCategoryId(e.target.value);
                                    setSubcategoryId(''); // Reset sub on cat change
                                }}
                            >
                                <option value="">Seleccionar...</option>
                                {categories.map(cat => (
                                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Subcategoría</label>
                            <select
                                className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-2 text-white focus:border-blue-500 outline-none appearance-none"
                                value={subcategoryId || ''}
                                onChange={e => setSubcategoryId(e.target.value)}
                                disabled={!categoryId}
                            >
                                <option value="">(Opcional)</option>
                                {availableSubcategories.map(sub => (
                                    <option key={sub.id} value={sub.id}>{sub.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Default Reps, Failure, & Intensity */}
                    <div className="grid grid-cols-3 gap-4 pt-2">
                        <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Series Default</label>
                            <input
                                type="number"
                                className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-2 text-white focus:border-blue-500 outline-none"
                                placeholder="4"
                                value={defaultSets}
                                onChange={e => setDefaultSets(parseInt(e.target.value) || 0)}
                            />
                        </div>
                        <div>
                            <div className="flex justify-between items-center mb-1">
                                <label className="block text-xs font-bold text-slate-400 uppercase">Rango Reps</label>
                                <button
                                    type="button"
                                    onClick={() => {
                                        const newVal = !isFailure;
                                        setIsFailure(newVal);
                                        if (newVal) setDefaultReps('∞');
                                        else setDefaultReps('');
                                    }}
                                    className={`text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1 transition-colors ${isFailure ? 'bg-red-500 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                                        }`}
                                >
                                    {isFailure ? '🔥 Fallo' : '⭕ Normal'}
                                </button>
                            </div>
                            <input
                                type="text"
                                className={`w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-2 text-white focus:border-blue-500 outline-none ${isFailure ? 'font-bold text-red-400' : ''}`}
                                placeholder={isFailure ? '∞' : '8-12'}
                                value={defaultReps}
                                onChange={e => setDefaultReps(e.target.value)}
                                disabled={isFailure}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Intensidad Def.</label>
                            <select
                                className="w-full bg-slate-950 border border-white/10 rounded-xl px-2 py-2 text-white focus:border-blue-500 outline-none appearance-none text-sm"
                                value={defaultIntensity}
                                onChange={e => setDefaultIntensity(e.target.value)}
                            >
                                <option value="">-</option>
                                <option value="Baja">Baja</option>
                                <option value="Media">Media</option>
                                <option value="Alta">Alta</option>
                                <option value="Máxima">Máxima</option>
                            </select>
                        </div>
                    </div>

                    {/* Meta */}
                    <div className="space-y-3 pt-2">
                        <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase mb-1 flex items-center gap-2">
                                <Video size={14} /> URL de Video (YouTube/Drive)
                            </label>
                            <input
                                type="text"
                                className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-2 text-white focus:border-blue-500 outline-none text-sm"
                                placeholder="https://..."
                                value={videoUrl}
                                onChange={e => setVideoUrl(e.target.value)}
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase mb-1 flex items-center gap-2">
                                <FileText size={14} /> Notas / Tips
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
                    <div className="pt-4 flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={onCloseModal}
                            className="px-4 py-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={isPending}
                            className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-xl font-bold shadow-lg transition-transform active:scale-95 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Save size={18} />
                            {isPending ? 'Guardando...' : (exerciseToEdit ? 'Actualizar' : 'Guardar Ejercicio')}
                        </button>
                    </div>

                </form>
            </div>
        </div>
    );
}
