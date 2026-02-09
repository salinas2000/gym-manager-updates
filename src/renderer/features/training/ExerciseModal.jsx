import React, { useState, useEffect } from 'react';
import { X, Save, Video, FileText, Dumbbell, ChevronDown } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '../../context/ToastContext';
import LoadingSpinner from '../../components/ui/LoadingSpinner';

export default function ExerciseModal({
    isOpen,
    onClose,
    onSuccess = null,              // Callback for external handling
    initialCategory = null,       // pre-select category ID
    initialSubcategory = null,    // pre-select subcategory ID
    exerciseToEdit = null         // If provided, we are in EDIT mode
}) {
    const toast = useToast();
    const queryClient = useQueryClient();
    const [name, setName] = useState('');
    const [categoryId, setCategoryId] = useState(initialCategory || '');
    const [subcategoryId, setSubcategoryId] = useState(initialSubcategory || '');
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

    const activeFields = fieldConfigs.filter(f => f.is_active);

    // Fetch Categories
    const categories = queryClient.getQueryData(['categories']) || [];

    // Derived subcategories based on selection
    const selectedCategoryData = categories.find(c => c.id === parseInt(categoryId));
    const availableSubcategories = selectedCategoryData?.subcategories || [];

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

        const payload = {
            name,
            categoryId: parseInt(categoryId),
            subcategoryId: subcategoryId ? parseInt(subcategoryId) : null,
            videoUrl,
            notes,
            custom_fields: customFields
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
        setCustomFields({});
        onClose();
    };

    // Update state if props change (smart create / edit)
    useEffect(() => {
        if (isOpen) {
            if (exerciseToEdit) {
                setName(exerciseToEdit.name);
                setCategoryId(exerciseToEdit.category_id);
                setSubcategoryId(exerciseToEdit.subcategory_id || '');
                setVideoUrl(exerciseToEdit.video_url || '');
                setNotes(exerciseToEdit.notes || '');
                setCustomFields(exerciseToEdit.custom_fields || {});
            } else {
                setName('');
                setCategoryId(initialCategory || '');
                setSubcategoryId(initialSubcategory || '');
                setVideoUrl('');
                setNotes('');
                setCustomFields({});
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
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase mb-1.5 tracking-wider">Categoría</label>
                            <div className="relative">
                                <select
                                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:border-blue-500 outline-none appearance-none transition-all pr-10"
                                    value={categoryId}
                                    onChange={e => {
                                        setCategoryId(e.target.value);
                                        setSubcategoryId('');
                                    }}
                                >
                                    <option value="">Seleccionar...</option>
                                    {categories.map(cat => (
                                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                                    ))}
                                </select>
                                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" size={16} />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase mb-1.5 tracking-wider">Subcategoría</label>
                            <div className="relative">
                                <select
                                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:border-blue-500 outline-none appearance-none transition-all pr-10 disabled:opacity-30"
                                    value={subcategoryId || ''}
                                    onChange={e => setSubcategoryId(e.target.value)}
                                    disabled={!categoryId}
                                >
                                    <option value="">(Opcional)</option>
                                    {availableSubcategories.map(sub => (
                                        <option key={sub.id} value={sub.id}>{sub.name}</option>
                                    ))}
                                </select>
                                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" size={16} />
                            </div>
                        </div>
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
                                                onChange={e => setCustomFields({ ...customFields, [field.field_key]: e.target.value })}
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
                                            onChange={e => setCustomFields({ ...customFields, [field.field_key]: e.target.value })}
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
