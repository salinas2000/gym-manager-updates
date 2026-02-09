import React, { useState, useEffect } from 'react';
import { X, Save, Tag, DollarSign, BarChart2, Package, Edit2 } from 'lucide-react';

export default function ProductModal({ product, onClose, onSuccess }) {
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        sku: '',
        purchase_price: 0,
        sale_price: 0,
        stock: 0,
        min_stock: 0,
        category: ''
    });
    const [categories, setCategories] = useState([]);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        loadCategories();
    }, []);

    const loadCategories = async () => {
        try {
            const res = await window.api.inventory.getCategories();
            if (res.success) setCategories(res.data);
        } catch (err) {
            console.error('Error loading categories:', err);
        }
    };

    useEffect(() => {
        if (product) {
            setFormData({
                name: product.name || '',
                description: product.description || '',
                sku: product.sku || '',
                purchase_price: product.purchase_price || 0,
                sale_price: product.sale_price || 0,
                stock: product.stock || 0,
                min_stock: product.min_stock || 0,
                category: product.category || ''
            });
        }
    }, [product]);

    const handleChange = (e) => {
        const { name, value, type } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'number' ? parseFloat(value) || 0 : value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        setError(null);

        try {
            let res;
            if (product?.id) {
                res = await window.api.inventory.updateProduct(product.id, formData);
            } else {
                res = await window.api.inventory.createProduct(formData);
            }

            if (res.success) {
                onSuccess();
            } else {
                setError(res.error || 'Ocurrió un error al guardar el producto');
            }
        } catch (err) {
            console.error('Error saving product:', err);
            setError('Error de conexión con la base de datos');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-slate-900 border border-white/10 w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
                {/* Header */}
                <div className="px-8 py-6 border-b border-white/5 flex items-center justify-between bg-slate-800/50">
                    <div>
                        <h2 className="text-2xl font-black text-white flex items-center gap-3">
                            {product ? <Edit2 className="text-blue-500" /> : <Package className="text-emerald-500" />}
                            {product ? 'Editar Producto' : 'Añadir Nuevo Producto'}
                        </h2>
                        <p className="text-slate-400 text-sm mt-1">Configura los detalles de tu inventario.</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-xl text-slate-400 hover:text-white transition-all">
                        <X size={24} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-8 space-y-6">
                    {error && (
                        <div className="p-4 bg-red-500/10 border border-red-500/50 rounded-xl text-red-500 text-sm font-bold flex items-center gap-2">
                            <X size={18} /> {error}
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Name & SKU */}
                        <div className="space-y-4 md:col-span-2">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="md:col-span-2">
                                    <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Nombre del Producto</label>
                                    <div className="relative">
                                        <Tag className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                                        <input
                                            name="name"
                                            value={formData.name}
                                            onChange={handleChange}
                                            required
                                            className="w-full bg-slate-950 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-white focus:ring-2 focus:ring-blue-500/50 focus:outline-none placeholder:text-slate-700"
                                            placeholder="Ej. Proteína Whey 1kg"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">SKU / Referencia</label>
                                    <input
                                        name="sku"
                                        value={formData.sku}
                                        onChange={handleChange}
                                        className="w-full bg-slate-950 border border-white/10 rounded-xl py-2.5 px-4 text-white focus:ring-2 focus:ring-blue-500/50 focus:outline-none placeholder:text-slate-700"
                                        placeholder="PROT-001"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Description */}
                        <div className="md:col-span-2">
                            <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Descripción</label>
                            <textarea
                                name="description"
                                value={formData.description}
                                onChange={handleChange}
                                rows="2"
                                className="w-full bg-slate-950 border border-white/10 rounded-xl py-2.5 px-4 text-white focus:ring-2 focus:ring-blue-500/50 focus:outline-none placeholder:text-slate-700 resize-none"
                                placeholder="Detalles del producto, marca, sabor..."
                            />
                        </div>

                        {/* Prices */}
                        <div className="space-y-2">
                            <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Precio de Compra (€)</label>
                            <div className="relative">
                                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                                <input
                                    type="number"
                                    step="0.01"
                                    name="purchase_price"
                                    value={formData.purchase_price}
                                    onChange={handleChange}
                                    className="w-full bg-slate-950 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-white focus:ring-2 focus:ring-blue-500/50 focus:outline-none"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Precio de Venta (€)</label>
                            <div className="relative">
                                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-500" size={18} />
                                <input
                                    type="number"
                                    step="0.01"
                                    name="sale_price"
                                    value={formData.sale_price}
                                    onChange={handleChange}
                                    className="w-full bg-slate-950 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-white focus:ring-2 focus:ring-emerald-500/50 focus:outline-none font-bold"
                                />
                            </div>
                        </div>

                        {/* Stock Controls */}
                        <div className="space-y-2">
                            <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Stock Inicial</label>
                            <div className="relative">
                                <Package className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                                <input
                                    type="number"
                                    name="stock"
                                    value={formData.stock}
                                    onChange={handleChange}
                                    disabled={!!product} // Disable stock on edit, use OrderModal to adjust
                                    className="w-full bg-slate-950 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-white focus:ring-2 focus:ring-blue-500/50 focus:outline-none disabled:opacity-50"
                                />
                            </div>
                            {product && <p className="text-[10px] text-slate-500 italic">Usa el historial de movimientos para ajustar stock.</p>}
                        </div>

                        <div className="space-y-2">
                            <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Stock Mínimo</label>
                            <div className="relative">
                                <BarChart2 className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                                <input
                                    type="number"
                                    name="min_stock"
                                    value={formData.min_stock}
                                    onChange={handleChange}
                                    className="w-full bg-slate-950 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-white focus:ring-2 focus:ring-orange-500/50 focus:outline-none"
                                />
                            </div>
                        </div>

                        <div className="md:col-span-2">
                            <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2 font-black">
                                Categoría
                            </label>
                            <select
                                name="category"
                                value={formData.category}
                                onChange={handleChange}
                                className="w-full bg-slate-950 border border-white/10 rounded-xl py-2.5 px-4 text-white focus:ring-2 focus:ring-blue-500/50 focus:outline-none appearance-none font-medium"
                            >
                                <option value="">Sin categoría...</option>
                                {categories.map(cat => (
                                    <option key={cat.id} value={cat.name}>{cat.name.toUpperCase()}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="pt-6 border-t border-white/5 flex gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold transition-all"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={saving}
                            className="flex-[2] py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold transition-all shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2"
                        >
                            {saving ? 'Guardando...' : <><Save size={20} /> Guardar Producto</>}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
