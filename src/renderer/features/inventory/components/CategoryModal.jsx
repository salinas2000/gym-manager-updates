import React, { useState, useEffect } from 'react';
import { X, Plus, Edit2, Trash2, Save, FolderOpen, AlertCircle } from 'lucide-react';
import ConfirmationModal from '../../../components/ui/ConfirmationModal';

export default function CategoryModal({ onClose, onSuccess }) {
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editingCategory, setEditingCategory] = useState(null);
    const [formData, setFormData] = useState({ name: '', description: '' });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    const [idToDelete, setIdToDelete] = useState(null);

    useEffect(() => {
        loadCategories();
    }, []);

    const loadCategories = async () => {
        setLoading(true);
        try {
            const res = await window.api.inventory.getCategories();
            if (res.success) setCategories(res.data);
        } catch (err) {
            console.error('Error loading categories:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleEdit = (category) => {
        setEditingCategory(category);
        setFormData({ name: category.name, description: category.description || '' });
    };

    const handleDeleteClick = (id) => {
        setIdToDelete(id);
    };

    const confirmDelete = async () => {
        if (!idToDelete) return;
        try {
            const res = await window.api.inventory.deleteCategory(idToDelete);
            if (res.success) loadCategories();
        } catch (err) {
            console.error('Error deleting category:', err);
        } finally {
            setIdToDelete(null);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        setError(null);

        try {
            let res;
            if (editingCategory) {
                res = await window.api.inventory.updateCategory(editingCategory.id, formData);
            } else {
                res = await window.api.inventory.createCategory(formData);
            }

            if (res.success) {
                setEditingCategory(null);
                setFormData({ name: '', description: '' });
                loadCategories();
                if (onSuccess) onSuccess();
            } else {
                setError(res.error || 'Error al guardar la categoría');
            }
        } catch (err) {
            console.error('Error saving category:', err);
            setError('Error de conexión');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md animate-in fade-in duration-300">
            <div className="bg-slate-900 border border-white/10 w-full max-w-xl rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
                {/* Header */}
                <div className="px-8 py-6 border-b border-white/5 flex items-center justify-between bg-slate-800/50">
                    <div>
                        <h2 className="text-2xl font-black text-white flex items-center gap-3">
                            <FolderOpen className="text-indigo-400" />
                            Gestionar Categorías
                        </h2>
                        <p className="text-slate-400 text-sm mt-1">Organiza tus productos por tipo.</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-xl text-slate-400 hover:text-white transition-all">
                        <X size={24} />
                    </button>
                </div>

                <div className="p-8 space-y-8">
                    {/* Form Section */}
                    <form onSubmit={handleSubmit} className="bg-white/5 p-6 rounded-2xl space-y-4 border border-white/5">
                        <h3 className="text-xs font-black text-indigo-400 uppercase tracking-widest mb-2">
                            {editingCategory ? 'Editar Categoría' : 'Nueva Categoría'}
                        </h3>

                        {error && (
                            <div className="p-3 bg-red-500/10 border border-red-500/50 rounded-xl text-red-500 text-xs font-bold flex items-center gap-2">
                                <AlertCircle size={16} /> {error}
                            </div>
                        )}

                        <div className="space-y-4">
                            <div>
                                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Nombre</label>
                                <input
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    required
                                    className="w-full bg-slate-950 border border-white/10 rounded-xl py-2 px-4 text-white focus:ring-2 focus:ring-indigo-500/50 focus:outline-none placeholder:text-slate-700"
                                    placeholder="Ej. Suplementación, Bebidas..."
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Descripción (Opcional)</label>
                                <input
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    className="w-full bg-slate-950 border border-white/10 rounded-xl py-2 px-4 text-white focus:ring-2 focus:ring-indigo-500/50 focus:outline-none placeholder:text-slate-700"
                                    placeholder="Breve descripción..."
                                />
                            </div>
                        </div>

                        <div className="flex gap-2">
                            {editingCategory && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setEditingCategory(null);
                                        setFormData({ name: '', description: '' });
                                    }}
                                    className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold transition-all"
                                >
                                    Cancelar
                                </button>
                            )}
                            <button
                                type="submit"
                                disabled={saving}
                                className="flex-[2] py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold transition-all shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2"
                            >
                                {saving ? 'Guardando...' : <><Save size={18} /> {editingCategory ? 'Actualizar' : 'Añadir Categoría'}</>}
                            </button>
                        </div>
                    </form>

                    {/* List Section */}
                    <div className="space-y-3">
                        <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest ml-1">Categorías Existentes</h3>
                        <div className="max-h-60 overflow-y-auto pr-2 custom-scrollbar space-y-2">
                            {loading ? (
                                <div className="text-center py-4 text-slate-500 animate-pulse font-medium">Cargando...</div>
                            ) : categories.length > 0 ? categories.map(cat => (
                                <div key={cat.id} className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/5 group hover:border-white/10 transition-all">
                                    <div>
                                        <div className="font-black text-white uppercase tracking-tight text-sm">{cat.name}</div>
                                        {cat.description && <div className="text-[10px] text-slate-500 italic">{cat.description}</div>}
                                    </div>
                                    <div className="flex items-center gap-1 opacity-100 md:opacity-0 group-hover:opacity-100 transition-all">
                                        <button
                                            onClick={() => handleEdit(cat)}
                                            className="p-1.5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-indigo-400 transition-all"
                                        >
                                            <Edit2 size={16} />
                                        </button>
                                        <button
                                            onClick={() => handleDeleteClick(cat.id)}
                                            className="p-1.5 hover:bg-red-500/10 rounded-lg text-slate-400 hover:text-red-400 transition-all"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                            )) : (
                                <div className="flex flex-col items-center justify-center py-12 px-4 bg-white/5 rounded-2xl border border-dashed border-white/10 text-center animate-in zoom-in-95 duration-500">
                                    <div className="p-4 bg-slate-800/50 rounded-full text-slate-600 mb-4">
                                        <FolderOpen size={48} />
                                    </div>
                                    <h3 className="text-white font-black text-lg uppercase tracking-tight">No hay categorías</h3>
                                    <p className="text-slate-500 text-sm max-w-[250px] mt-1">
                                        Organiza tus productos creando la primera categoría desde el formulario superior.
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <ConfirmationModal
                isOpen={!!idToDelete}
                title="Eliminar Categoría"
                type="danger"
                onClose={() => setIdToDelete(null)}
                onConfirm={confirmDelete}
                confirmText="Eliminar permanentemente"
            >
                ¿Estás seguro de que deseas eliminar esta categoría? Esta acción no se puede deshacer y los productos asociados podrían quedar sin categoría.
            </ConfirmationModal>
        </div>
    );
}


