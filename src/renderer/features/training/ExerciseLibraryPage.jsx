import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, Plus, Filter, Edit2, Trash2, Home, ChevronRight, Video, FileText, Dumbbell, Settings2 } from 'lucide-react';
import CategorySidebar from './CategorySidebar';
import ExerciseModal from './ExerciseModal';
import { useToast } from '../../context/ToastContext';
import ConfirmationModal from '../../components/ui/ConfirmationModal';
import FieldConfigModal from './FieldConfigModal';

export default function ExerciseLibraryPage() {
    const toast = useToast();
    const queryClient = useQueryClient();
    const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', children: null, onConfirm: () => { }, type: 'info' });

    // View State
    const [activeCategory, setActiveCategory] = useState(null);
    const [activeSubcategory, setActiveSubcategory] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingExercise, setEditingExercise] = useState(null);
    const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
    const [hoveredExerciseId, setHoveredExerciseId] = useState(null);

    // --- QUERIES ---
    const { data: exercises = [], isLoading } = useQuery({
        queryKey: ['exercises'],
        queryFn: async () => {
            const res = await window.api.training.getExercises();
            return res.success ? res.data : [];
        }
    });

    const { data: categories = [] } = useQuery({
        queryKey: ['categories'],
        queryFn: async () => {
            const res = await window.api.training.getCategories();
            return res.success ? res.data : [];
        }
    });

    // Query Field Configs for labels
    const { data: fieldConfigs = [] } = useQuery({
        queryKey: ['exercise-field-configs'],
        queryFn: async () => {
            const res = await window.api.training.getFieldConfigs();
            return res.success ? res.data : [];
        }
    });

    // --- MUTATIONS ---
    const deleteExercise = useMutation({
        mutationFn: (id) => window.api.training.deleteExercise(id),
        onSuccess: (res) => {
            if (res.success) {
                queryClient.invalidateQueries(['exercises']);
                toast.success('Ejercicio eliminado correctamente');
            } else {
                toast.error('No se pudo eliminar el ejercicio. Puede estar en uso en rutinas activas.');
            }
        },
        onError: () => {
            toast.error('Error inesperado al eliminar el ejercicio');
        }
    });

    // --- DERIVED STATE ---
    const selectedCategoryData = categories.find(c => c.id === activeCategory);
    const selectedSubData = selectedCategoryData?.subcategories.find(s => s.id === activeSubcategory);

    const filteredExercises = exercises.filter(ex => {
        // 1. Hierarchy Filter
        if (activeSubcategory) {
            if (ex.subcategory_id !== activeSubcategory) return false;
        } else if (activeCategory) {
            if (ex.category_id !== activeCategory) return false;
        }

        // 2. Search Filter
        if (searchTerm && !ex.name.toLowerCase().includes(searchTerm.toLowerCase())) return false;

        return true;
    });

    // --- HANDLERS ---
    const handleSelectCategory = (id) => {
        setActiveCategory(id);
        setActiveSubcategory(null); // Reset sub selection
    };

    const handleSelectSubcategory = (id) => {
        // Find parent category if not set (though structurally difficult in sidebar, good for safety)
        const parentCat = categories.find(c => c.subcategories.some(s => s.id === id));
        if (parentCat) setActiveCategory(parentCat.id);
        setActiveSubcategory(id);
    };

    const handleReset = () => {
        setActiveCategory(null);
        setActiveSubcategory(null);
    };

    const handleOpenCreate = () => {
        setEditingExercise(null);
        setIsModalOpen(true);
    };

    const handleOpenEdit = (exercise) => {
        setEditingExercise(exercise);
        setIsModalOpen(true);
    };

    return (
        <div className="flex h-full bg-slate-950 rounded-2xl overflow-hidden border border-white/5 shadow-2xl">

            {/* SIDEBAR (Tree) */}
            <CategorySidebar
                activeCategory={activeCategory}
                activeSubcategory={activeSubcategory}
                onSelectCategory={handleSelectCategory}
                onSelectSubcategory={handleSelectSubcategory}
                onReset={handleReset}
            />

            {/* MAIN CONTENT */}
            <div className="flex-1 flex flex-col bg-slate-900/30">

                {/* TOOLBAR Header */}
                <div className="p-6 border-b border-white/5 space-y-4">
                    {/* Breadcrumbs */}
                    <div className="flex items-center gap-2 text-sm text-slate-500">
                        <button onClick={handleReset} className="hover:text-white flex items-center gap-1 transition-colors">
                            <Home size={14} /> Biblioteca
                        </button>
                        {selectedCategoryData && (
                            <>
                                <ChevronRight size={14} />
                                <span className={!selectedSubData ? 'text-white font-bold' : ''}>
                                    {selectedCategoryData.name}
                                </span>
                            </>
                        )}
                        {selectedSubData && (
                            <>
                                <ChevronRight size={14} />
                                <span className="text-white font-bold">{selectedSubData.name}</span>
                            </>
                        )}
                    </div>

                    <div className="flex justify-between items-center gap-4">
                        <div className="relative flex-1 max-w-md">
                            <Search className="absolute left-3 top-2.5 text-slate-500" size={18} />
                            <input
                                type="text"
                                placeholder="Buscar ejercicio..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full bg-slate-950 border border-white/10 rounded-xl pl-10 pr-4 py-2 text-white focus:border-blue-500 outline-none shadow-inner"
                            />
                        </div>

                        <div className="flex items-center gap-3">
                            <button
                                className="flex items-center gap-2 px-4 py-2 text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700/80 rounded-xl transition-all border border-white/5 active:scale-95"
                                onClick={() => setIsConfigModalOpen(true)}
                            >
                                <Settings2 size={18} className="text-indigo-400" />
                                <span className="text-sm font-semibold">Campos</span>
                            </button>
                            <button
                                className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 shadow-lg hover:shadow-blue-500/20 transition-all active:scale-95"
                                onClick={handleOpenCreate}
                            >
                                <Plus size={18} /> Nuevo Ejercicio
                            </button>
                        </div>
                    </div>
                </div>

                {/* EXERCISE LIST */}
                <div className="flex-1 overflow-y-auto p-6">
                    {/* Empty State / Prompt */}
                    {!activeCategory && !activeSubcategory && !searchTerm && (
                        <div className="mb-6 p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-center gap-4 text-blue-200">
                            <Filter size={20} />
                            <p className="text-sm">Selecciona una categoría a la izquierda para filtrar los resultados.</p>
                        </div>
                    )}

                    {isLoading ? (
                        <div className="text-center py-12 text-slate-500">Cargando ejercicios...</div>
                    ) : filteredExercises.length === 0 ? (
                        <div className="text-center py-12 flex flex-col items-center">
                            <Dumbbell size={48} className="text-slate-700 mb-4" />
                            <p className="text-slate-400 font-medium">No se encontraron ejercicios.</p>
                            <p className="text-slate-600 text-sm mt-1">Intenta con otra búsqueda o categoría.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {filteredExercises.map(ex => {
                                const isHovered = hoveredExerciseId === ex.id;
                                const hasFields = ex.custom_fields && Object.keys(ex.custom_fields).length > 0;
                                const fields = typeof ex.custom_fields === 'string' ? JSON.parse(ex.custom_fields) : (ex.custom_fields || {});

                                return (
                                    <div
                                        key={ex.id}
                                        onMouseEnter={() => setHoveredExerciseId(ex.id)}
                                        onMouseLeave={() => setHoveredExerciseId(null)}
                                        className={`group bg-slate-900 border border-white/5 rounded-xl p-4 transition-all duration-300 flex flex-col min-h-[140px] relative ${isHovered ? 'bg-slate-800 border-blue-500/40 shadow-xl shadow-blue-500/10 -translate-y-1' : 'hover:border-white/10'
                                            }`}
                                    >
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="flex-1 min-w-0">
                                                <h4 className={`font-bold transition-colors truncate ${isHovered ? 'text-blue-400' : 'text-white'}`} title={ex.name}>
                                                    {ex.name}
                                                </h4>
                                                <p className="text-[10px] text-slate-500 truncate flex items-center gap-1 mt-1 font-medium uppercase tracking-wider">
                                                    {ex.category_name}
                                                    <ChevronRight size={10} className="text-slate-700" />
                                                    {ex.subcategory_name || 'General'}
                                                </p>
                                            </div>
                                            {/* Actions shown on hover */}
                                            <div className={`transition-opacity flex gap-1 ${isHovered ? 'opacity-100' : 'opacity-0'}`}>
                                                <button
                                                    onClick={() => handleOpenEdit(ex)}
                                                    className="p-1.5 bg-slate-950/40 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-all"
                                                >
                                                    <Edit2 size={13} />
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        setConfirmModal({
                                                            isOpen: true,
                                                            title: 'Eliminar Ejercicio',
                                                            children: `¿Estás seguro de que quieres eliminar "${ex.name}"? Esta acción no se puede deshacer.`,
                                                            type: 'danger',
                                                            confirmText: 'Eliminar',
                                                            onConfirm: () => deleteExercise.mutate(ex.id)
                                                        });
                                                    }}
                                                    className="p-1.5 bg-slate-950/40 hover:bg-red-900/40 rounded-lg text-slate-400 hover:text-red-400 transition-all"
                                                >
                                                    <Trash2 size={13} />
                                                </button>
                                            </div>
                                        </div>

                                        {/* Fields on Hover - Absolute overlay or smooth expansion? */}
                                        {/* Let's go with a smooth internal expansion/fade */}
                                        <div className={`mt-2 flex-1 overflow-hidden transition-all duration-300 ${isHovered && hasFields ? 'opacity-100 max-h-40' : 'opacity-0 max-h-0'}`}>
                                            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/5">
                                                {Object.entries(fields).map(([key, val]) => {
                                                    const config = fieldConfigs.find(f => f.field_key === key);
                                                    if (!val || !config) return null;
                                                    return (
                                                        <div key={key} className="flex flex-col">
                                                            <span className="text-[8px] font-black text-slate-500 uppercase tracking-tighter truncate">
                                                                {config.label}
                                                            </span>
                                                            <span className="text-[10px] text-slate-300 truncate font-medium">
                                                                {val}
                                                            </span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>

                                        {/* Footer details (Visible when NOT hovered or always?) */}
                                        <div className={`mt-auto pt-3 border-t border-white/5 flex gap-3 text-[10px] items-center transition-opacity ${isHovered && hasFields ? 'opacity-40' : 'opacity-100'}`}>
                                            {ex.video_url && (
                                                <span className="flex items-center gap-1 text-emerald-500/80" title="Tiene Video">
                                                    <Video size={10} /> Video
                                                </span>
                                            )}
                                            {ex.is_failure ? (
                                                <span className="flex items-center gap-1 text-red-500 font-black uppercase tracking-tighter" title="Modo Fallo">
                                                    🔥 Fallo
                                                </span>
                                            ) : ex.default_reps ? (
                                                <span className="flex items-center gap-1 text-blue-400 font-bold" title="Rango Reps">
                                                    <Dumbbell size={10} /> {ex.default_reps}
                                                </span>
                                            ) : null}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

            </div>

            {/* MODALS */}
            <ExerciseModal
                isOpen={isModalOpen}
                onClose={() => {
                    setIsModalOpen(false);
                    setEditingExercise(null);
                }}
                initialCategory={activeCategory}
                initialSubcategory={activeSubcategory}
                exerciseToEdit={editingExercise}
            />

            <ConfirmationModal
                isOpen={confirmModal.isOpen}
                title={confirmModal.title}
                onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                onConfirm={confirmModal.onConfirm}
                type={confirmModal.type}
                confirmText={confirmModal.confirmText || 'Confirmar'}
            >
                {confirmModal.children}
            </ConfirmationModal>

            <FieldConfigModal
                isOpen={isConfigModalOpen}
                onClose={() => setIsConfigModalOpen(false)}
            />
        </div>
    );
}
