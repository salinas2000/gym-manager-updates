import React, { useState } from 'react';
import {
    Dumbbell, Trophy, Zap, Heart, Activity, Timer, Play, Target, Folder,
    ChevronDown, ChevronRight, Plus, X, Trash2
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// Shared Icon Map
export const ICON_MAP = {
    Dumbbell, Trophy, Zap, Heart, Activity, Timer, Play, Target, Folder
};
const DEFAULT_ICONS = Object.keys(ICON_MAP);

export default function CategorySidebar({
    activeCategory,
    activeSubcategory,
    onSelectCategory,     // (id) => void
    onSelectSubcategory,  // (id) => void
    onReset               // () => void
}) {
    const queryClient = useQueryClient();
    const [expandedCats, setExpandedCats] = useState({});

    // Creation State
    const [isCreatingCat, setIsCreatingCat] = useState(false);
    const [newCatName, setNewCatName] = useState('');
    const [newCatIcon, setNewCatIcon] = useState('Dumbbell');

    const [creatingSubFor, setCreatingSubFor] = useState(null); // catId
    const [newSubName, setNewSubName] = useState('');

    // --- QUERIES ---
    const { data: categories = [] } = useQuery({
        queryKey: ['categories'],
        queryFn: async () => {
            const res = await window.api.training.getCategories();
            return res.success ? res.data : [];
        }
    });

    // --- MUTATIONS ---
    const createCategory = useMutation({
        mutationFn: (data) => window.api.training.createCategory(data),
        onSuccess: () => {
            queryClient.invalidateQueries(['categories']);
            setNewCatName('');
            setIsCreatingCat(false);
        }
    });

    const createSubcategory = useMutation({
        mutationFn: (data) => window.api.training.createSubcategory(data),
        onSuccess: () => {
            queryClient.invalidateQueries(['categories']);
            setNewSubName('');
            setCreatingSubFor(null);
        }
    });

    const deleteCategory = useMutation({
        mutationFn: (id) => window.api.training.deleteCategory(id),
        onSuccess: () => {
            queryClient.invalidateQueries(['categories']);
            if (activeCategory) onReset();
        }
    });

    const deleteSubcategory = useMutation({
        mutationFn: (id) => window.api.training.deleteSubcategory(id),
        onSuccess: () => {
            queryClient.invalidateQueries(['categories']);
            if (activeSubcategory) onSelectCategory(activeCategory); // Go back to cat
        }
    });

    // --- HANDLERS ---
    const toggleExpand = (id) => setExpandedCats(prev => ({ ...prev, [id]: !prev[id] }));

    const handleCreateCat = (e) => {
        e.preventDefault();
        if (!newCatName.trim()) return;
        createCategory.mutate({ name: newCatName, icon: newCatIcon });
    };

    const handleCreateSub = (e) => {
        e.preventDefault();
        if (!newSubName.trim()) return;
        createSubcategory.mutate({ categoryId: creatingSubFor, name: newSubName });
    };

    const handleDeleteCategory = (catId, catName) => {
        if (confirm(`⚠️ PELIGRO ⚠️\n\n¿Estás seguro de eliminar la categoría "${catName}"?\n\nAl hacerlo SE ELIMINARÁN TODOS LOS EJERCICIOS que pertenezcan a esta categoría. Esta acción no se puede deshacer.`)) {
            deleteCategory.mutate(catId);
        }
    };

    const handleDeleteSubcategory = (subId, subName) => {
        if (confirm(`¿Eliminar subcategoría "${subName}"?\nSe eliminarán todos los ejercicios asociados.`)) {
            deleteSubcategory.mutate(subId);
        }
    };

    return (
        <div className="flex flex-col h-full bg-slate-900/50 border-r border-white/5 w-72 flex-shrink-0">
            {/* HEADER */}
            <div className="p-4 border-b border-white/5 flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Explorador</h3>
                <button
                    onClick={() => setIsCreatingCat(true)}
                    className="p-1 hover:bg-blue-600/20 hover:text-blue-400 rounded transition-colors text-slate-500"
                    title="Nueva Categoría"
                >
                    <Plus size={16} />
                </button>
            </div>



            {/* NEW CAT FORM (Isolated Component) */}
            {
                isCreatingCat && (
                    <CreateCategoryForm
                        onCancel={() => setIsCreatingCat(false)}
                        onSubmit={(data) => {
                            createCategory.mutate(data);
                        }}
                    />
                )
            }

            {/* TREE LIST */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
                <button
                    onClick={onReset}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors ${!activeCategory
                        ? 'bg-blue-600/10 text-blue-400 border border-blue-500/20'
                        : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                        }`}
                >
                    <Dumbbell size={16} />
                    Todos los Ejercicios
                </button>

                {categories.map(cat => {
                    const Icon = ICON_MAP[cat.icon] || Folder;
                    const isExpanded = expandedCats[cat.id];
                    const isActive = activeCategory === cat.id;

                    return (
                        <div key={cat.id} className="select-none">
                            {/* CATEGORY ROW */}
                            <div
                                className={`
                                    group flex items-center justify-between px-2 py-1.5 rounded-lg cursor-pointer transition-colors
                                    ${isActive ? 'bg-slate-800 text-white' : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'}
                                `}
                            >
                                <div
                                    className="flex items-center gap-2 flex-1 overflow-hidden"
                                    onClick={() => {
                                        onSelectCategory(cat.id);
                                        if (!isExpanded) toggleExpand(cat.id);
                                    }}
                                >
                                    <button
                                        onClick={(e) => { e.stopPropagation(); toggleExpand(cat.id); }}
                                        className="text-slate-600 hover:text-white"
                                    >
                                        {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                    </button>
                                    <Icon size={16} className={isActive ? 'text-blue-400' : 'text-slate-500'} />
                                    <span className="text-sm font-medium truncate">{cat.name}</span>
                                </div>

                                <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={(e) => { e.stopPropagation(); setCreatingSubFor(cat.id); setExpandedCats(p => ({ ...p, [cat.id]: true })); }}
                                        className="p-1 hover:text-blue-400 text-slate-500"
                                        title="Agregar Subcategoría"
                                    >
                                        <Plus size={12} />
                                    </button>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleDeleteCategory(cat.id, cat.name);
                                        }}
                                        className="p-1 hover:text-red-400 text-slate-500"
                                        title="Eliminar Categoría"
                                    >
                                        <Trash2 size={12} />
                                    </button>
                                </div>
                            </div>

                            {/* SUBCATEGORIES */}
                            {isExpanded && (
                                <div className="ml-6 pl-2 border-l border-white/5 mt-1 space-y-0.5">
                                    {/* SUB LIST */}
                                    {cat.subcategories && cat.subcategories.map(sub => (
                                        <div
                                            key={sub.id}
                                            className={`
                                                group/sub flex items-center justify-between px-2 py-1 rounded text-sm cursor-pointer transition-colors
                                                ${activeSubcategory === sub.id
                                                    ? 'bg-blue-600/20 text-blue-400'
                                                    : 'text-slate-500 hover:text-white hover:bg-slate-800/30'}
                                            `}
                                            onClick={() => onSelectSubcategory(sub.id)}
                                        >
                                            <span className="truncate">{sub.name}</span>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleDeleteSubcategory(sub.id, sub.name);
                                                }}
                                                className="opacity-0 group-hover/sub:opacity-100 p-0.5 hover:text-red-400 text-slate-600"
                                                title="Eliminar Subcategoría"
                                            >
                                                <X size={12} />
                                            </button>
                                        </div>
                                    ))}

                                    {/* CREATE SUB INPUT */}
                                    {creatingSubFor === cat.id && (
                                        <form onSubmit={handleCreateSub} className="px-2 py-1">
                                            <input
                                                autoFocus
                                                type="text"
                                                placeholder="Nombre Sub..."
                                                value={newSubName}
                                                onChange={e => setNewSubName(e.target.value)}
                                                className="w-full bg-slate-950 border border-white/10 rounded px-2 py-0.5 text-xs text-white focus:border-blue-500 outline-none"
                                                onBlur={() => !newSubName && setCreatingSubFor(null)} // Cancel on blur if empty
                                            />
                                        </form>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div >
    );
}

// Helper Component to isolate state
function CreateCategoryForm({ onCancel, onSubmit }) {
    const [name, setName] = useState('');
    const [icon, setIcon] = useState('Dumbbell');

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!name.trim()) return;
        onSubmit({ name, icon });
    };

    return (
        <div className="p-3 bg-slate-800/50 border-b border-white/5">
            <form onSubmit={handleSubmit} className="space-y-2">
                <input
                    autoFocus
                    type="text"
                    placeholder="Nombre..."
                    value={name}
                    onChange={e => setName(e.target.value)}
                    className="w-full bg-slate-950 border border-white/10 rounded px-2 py-1 text-sm text-white focus:border-blue-500 outline-none"
                    onKeyDown={e => e.stopPropagation()}
                />
                <div className="flex gap-1 overflow-x-auto pb-1 no-scrollbar">
                    {DEFAULT_ICONS.map(i => {
                        const Icon = ICON_MAP[i];
                        return (
                            <button
                                key={i}
                                type="button"
                                onClick={() => setIcon(i)}
                                className={`p-1 rounded ${icon === i ? 'bg-blue-500 text-white' : 'text-slate-500'}`}
                            >
                                <Icon size={14} />
                            </button>
                        )
                    })}
                </div>
                <div className="flex justify-end gap-2">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="text-xs text-slate-500 hover:text-white"
                    >
                        Cancelar
                    </button>
                    <button
                        type="submit"
                        disabled={!name.trim()}
                        className="text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-500 disabled:opacity-50"
                    >
                        Guardar
                    </button>
                </div>
            </form>
        </div>
    );
}
