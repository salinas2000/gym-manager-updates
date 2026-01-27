import React, { useState } from 'react';
import {
    Dumbbell, Trophy, Zap, Heart, Activity, Timer, Play, Target,
    ChevronDown, ChevronRight, Plus, Archive, Edit2, X, Check, Trash2, Folder
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// --- ICON MAP ---
export const ICON_MAP = {
    Dumbbell, Trophy, Zap, Heart, Activity, Timer, Play, Target, Folder
};

const DEFAULT_ICONS = Object.keys(ICON_MAP);

export default function CategoryManager({ onClose }) {
    const queryClient = useQueryClient();
    const [expandedCats, setExpandedCats] = useState({});
    const [newCatName, setNewCatName] = useState('');
    const [selectedIcon, setSelectedIcon] = useState('Dumbbell');
    const [editingSub, setEditingSub] = useState(null); // { catId, subName } for new/edit

    // --- QUERIES ---
    const { data: categories = [], isLoading } = useQuery({
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
        }
    });

    const createSubcategory = useMutation({
        mutationFn: (data) => window.api.training.createSubcategory(data),
        onSuccess: () => {
            queryClient.invalidateQueries(['categories']);
            setEditingSub(null);
        }
    });

    const deleteCategory = useMutation({
        mutationFn: (id) => window.api.training.deleteCategory(id),
        onSuccess: () => queryClient.invalidateQueries(['categories'])
    });

    const deleteSubcategory = useMutation({
        mutationFn: (id) => window.api.training.deleteSubcategory(id),
        onSuccess: () => queryClient.invalidateQueries(['categories'])
    });

    // --- HANDLERS ---
    const toggleExpand = (id) => {
        setExpandedCats(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const handleCreateCategory = (e) => {
        e.preventDefault();
        if (!newCatName.trim()) return;
        createCategory.mutate({ name: newCatName, icon: selectedIcon });
    };

    const handleAddSub = (catId, name) => {
        if (!name.trim()) return;
        createSubcategory.mutate({ categoryId: catId, name });
    };

    // --- RENDER ---
    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 w-full max-w-2xl rounded-2xl border border-white/10 shadow-2xl flex flex-col max-h-[85vh]">

                {/* HEADER */}
                <div className="p-6 border-b border-white/10 flex justify-between items-center bg-slate-900/50 rounded-t-2xl">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <Folder className="text-blue-500" />
                        Gestión de Categorías
                    </h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
                        <X size={24} />
                    </button>
                </div>

                {/* CONTENT */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">

                    {/* NEW CATEGORY FORM */}
                    <div className="bg-slate-800/50 p-4 rounded-xl border border-white/5">
                        <h3 className="text-sm font-bold text-slate-400 uppercase mb-3">Nueva Categoría</h3>
                        <form onSubmit={handleCreateCategory} className="space-y-4">
                            <div className="flex gap-4">
                                <input
                                    type="text"
                                    value={newCatName}
                                    onChange={e => setNewCatName(e.target.value)}
                                    placeholder="Nombre de la categoría..."
                                    className="flex-1 bg-slate-950 border border-white/10 rounded-lg px-4 py-2 text-white focus:border-blue-500 outline-none"
                                />
                                <button
                                    type="submit"
                                    className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 disabled:opacity-50"
                                    disabled={!newCatName.trim()}
                                >
                                    <Plus size={18} /> Crear
                                </button>
                            </div>

                            {/* ICON PICKER */}
                            <div>
                                <label className="text-xs text-slate-500 mb-2 block font-medium">Icono:</label>
                                <div className="flex gap-2 flex-wrap">
                                    {DEFAULT_ICONS.map(iconName => {
                                        const Icon = ICON_MAP[iconName];
                                        return (
                                            <button
                                                key={iconName}
                                                type="button"
                                                onClick={() => setSelectedIcon(iconName)}
                                                className={`p-2 rounded-lg border transition-all ${selectedIcon === iconName
                                                    ? 'bg-blue-500/20 border-blue-500 text-blue-400'
                                                    : 'bg-slate-950 border-white/5 text-slate-500 hover:text-white hover:border-white/20'
                                                    }`}
                                            >
                                                <Icon size={20} />
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </form>
                    </div>

                    {/* CATEGORY LIST (ACCORDION) */}
                    <div className="space-y-2">
                        {isLoading ? (
                            <div className="text-center text-slate-500 py-8">Cargando categorías...</div>
                        ) : categories.map(cat => {
                            const Icon = ICON_MAP[cat.icon] || Folder;
                            const isExpanded = expandedCats[cat.id];

                            return (
                                <div key={cat.id} className="bg-slate-900 border border-white/5 rounded-xl overflow-hidden">
                                    {/* CATEGORY ROW */}
                                    <div
                                        onClick={() => toggleExpand(cat.id)}
                                        className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-800/50 transition-colors"
                                    >
                                        <div className="flex items-center gap-3">
                                            {isExpanded ? <ChevronDown size={18} className="text-slate-500" /> : <ChevronRight size={18} className="text-slate-500" />}
                                            <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400">
                                                <Icon size={18} />
                                            </div>
                                            <span className="font-bold text-white">{cat.name}</span>
                                            {cat.is_system && <span className="text-[10px] bg-slate-800 text-slate-500 px-2 py-0.5 rounded border border-white/5">SISTEMA</span>}
                                        </div>

                                        <div className="flex items-center gap-2">
                                            {/* Always allow delete, even for system cats if user wants to clean up */}
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (confirm(`¿Eliminar categoría "${cat.name}" y todo su contenido?`)) {
                                                        deleteCategory.mutate(cat.id);
                                                    }
                                                }}
                                                className="p-1.5 hover:bg-red-500/20 text-slate-500 hover:text-red-400 rounded transition-colors"
                                                title="Eliminar Categoría"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>

                                    {/* SUBCATEGORIES (EXPANDED) */}
                                    {isExpanded && (
                                        <div className="bg-slate-950/50 border-t border-white/5 p-4 pl-12 space-y-2">
                                            {/* LIST */}
                                            {cat.subcategories && cat.subcategories.map(sub => (
                                                <div key={sub.id} className="flex items-center justify-between group py-1">
                                                    <span className="text-slate-400 text-sm hover:text-white transition-colors cursor-default">• {sub.name}</span>
                                                    <button
                                                        onClick={() => {
                                                            if (confirm(`¿Eliminar subcategoría "${sub.name}"?`)) {
                                                                deleteSubcategory.mutate(sub.id);
                                                            }
                                                        }}
                                                        className="text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity px-2"
                                                        title="Eliminar Subcategoría"
                                                    >
                                                        <Trash2 size={12} />
                                                    </button>
                                                </div>
                                            ))}

                                            {/* ADD SUBCAT INPUT */}
                                            <div className="flex gap-2 mt-3 pt-3 border-t border-white/5">
                                                <input
                                                    type="text"
                                                    placeholder="Nueva subcategoría..."
                                                    className="bg-transparent border-b border-white/10 text-sm text-white px-2 py-1 focus:border-blue-500 focus:outline-none w-full"
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') {
                                                            handleAddSub(cat.id, e.target.value);
                                                            e.target.value = '';
                                                        }
                                                    }}
                                                />
                                                <button className="text-xs text-blue-400 font-bold uppercase hover:text-blue-300">
                                                    Agregar
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                </div>
            </div>
        </div>
    );
}
