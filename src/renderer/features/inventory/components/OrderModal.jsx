import React, { useState, useEffect } from 'react';
import { X, Save, ShoppingCart, Plus, Minus, AlertCircle, Package, User, Search } from 'lucide-react';

export default function OrderModal({ type, product, products, onClose, onSuccess }) {
    const [formData, setFormData] = useState({
        product_id: product?.id || '',
        customer_id: '',
        type: type || 'purchase',
        quantity: 1,
        unit_cost: type === 'sale' ? (product?.sale_price || 0) : (product?.purchase_price || 0),
        auto_purchase_cost: product?.purchase_price || 0,
        notes: ''
    });
    const [customers, setCustomers] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);

    const selectedProduct = products.find(p => p.id === parseInt(formData.product_id)) || product;

    useEffect(() => {
        loadCustomers();
    }, []);

    const loadCustomers = async () => {
        try {
            const res = await window.api.customers.getAll();
            if (res.success) {
                // Only active customers for sales
                setCustomers(res.data.filter(c => c.active === 1));
            }
        } catch (err) {
            console.error('Error loading customers:', err);
        }
    };

    useEffect(() => {
        if (selectedProduct) {
            setFormData(prev => ({
                ...prev,
                unit_cost: prev.type === 'sale' ? (selectedProduct.sale_price || 0) : (selectedProduct.purchase_price || 0),
                auto_purchase_cost: selectedProduct.purchase_price || 0
            }));
        }
    }, [formData.product_id, formData.type]);

    const handleChange = (e) => {
        const { name, value, type } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'number' ? parseFloat(value) || 0 : value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!formData.product_id) return setError('Selecciona un producto');
        if (formData.quantity === 0) return setError('La cantidad no puede ser cero');

        setSaving(true);
        setError(null);

        try {
            let finalData = { ...formData };
            // Backend handles signs based on type. 
            // We ensure positive values are sent for purchase/sale to avoid confusion.
            if (formData.type !== 'adjustment') {
                finalData.quantity = Math.abs(formData.quantity);
            }

            const res = await window.api.inventory.createOrder(finalData);

            if (res.success) {
                onSuccess();
            } else {
                setError(res.error || 'Ocurrió un error al registrar el movimiento');
            }
        } catch (err) {
            console.error('Error creating order:', err);
            setError('Error de conexión');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-slate-900 border border-white/10 w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
                {/* Header */}
                <div className={`px-8 py-6 border-b border-white/5 flex items-center justify-between ${formData.type === 'purchase' ? 'bg-emerald-500/10' :
                    formData.type === 'sale' ? 'bg-blue-500/10' :
                        'bg-amber-500/10'
                    }`}>
                    <div>
                        <h2 className="text-2xl font-black text-white flex items-center gap-3">
                            {formData.type === 'purchase' ? <ShoppingCart className="text-emerald-500" /> :
                                formData.type === 'sale' ? <Minus className="text-blue-500" /> :
                                    <Plus className="text-amber-500" />}
                            {formData.type === 'purchase' ? 'Registrar Pedido' :
                                formData.type === 'sale' ? 'Registrar Venta' :
                                    'Ajuste de Stock'}
                        </h2>
                        <p className="text-slate-400 text-sm mt-1">Actualiza el stock de tus productos.</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-xl text-slate-400 hover:text-white transition-all">
                        <X size={24} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-8 space-y-6">
                    {error && (
                        <div className="p-4 bg-red-500/10 border border-red-500/50 rounded-xl text-red-500 text-sm font-bold flex items-center gap-2">
                            <AlertCircle size={18} /> {error}
                        </div>
                    )}

                    <div className="space-y-4">
                        {/* Product Selection */}
                        {!product ? (
                            <div>
                                <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Seleccionar Producto</label>
                                <select
                                    name="product_id"
                                    value={formData.product_id}
                                    onChange={handleChange}
                                    required
                                    className="w-full bg-slate-950 border border-white/10 rounded-xl py-3 px-4 text-white focus:ring-2 focus:ring-blue-500/50 focus:outline-none appearance-none"
                                >
                                    <option value="">Selecciona un producto...</option>
                                    {products.map(p => (
                                        <option key={p.id} value={p.id}>{p.name.toUpperCase()} (Stock: {p.stock})</option>
                                    ))}
                                </select>
                            </div>
                        ) : (
                            <div className="bg-white/5 p-4 rounded-2xl flex items-center gap-4">
                                <div className="p-3 bg-blue-500/10 rounded-xl text-blue-500">
                                    <Package size={24} />
                                </div>
                                <div>
                                    <h4 className="font-black text-white uppercase tracking-tight">{product.name}</h4>
                                    <p className="text-xs text-slate-500">Stock Actual: <span className="text-white font-bold">{product.stock}</span></p>
                                </div>
                            </div>
                        )}

                        {/* Order Type Change (if not fixed by trigger) */}
                        {!type && (
                            <div>
                                <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Tipo de Movimiento</label>
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setFormData(prev => ({ ...prev, type: 'purchase' }))}
                                        className={`py-2 rounded-xl font-bold text-xs transition-all border ${formData.type === 'purchase' ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-slate-950 text-slate-500 border-white/10 hover:border-white/20'}`}
                                    >
                                        COMPRA (+)
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setFormData(prev => ({ ...prev, type: 'adjustment' }))}
                                        className={`py-2 rounded-xl font-bold text-xs transition-all border ${formData.type === 'adjustment' ? 'bg-amber-500 text-white border-amber-500' : 'bg-slate-950 text-slate-500 border-white/10 hover:border-white/20'}`}
                                    >
                                        AJUSTE (+/-)
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Conditional Form Fields (Only shown if product is selected) */}
                        {formData.product_id ? (
                            <div className="space-y-6 animate-in fade-in slide-in-from-top-4 duration-500">
                                {/* Customer Selection (ONLY for sales) */}
                                {formData.type === 'sale' && (
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Asignar a Cliente</label>
                                            <div className="relative mb-2">
                                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                                                <input
                                                    type="text"
                                                    placeholder="Buscar cliente por nombre..."
                                                    value={searchTerm}
                                                    onChange={(e) => setSearchTerm(e.target.value)}
                                                    className="w-full bg-slate-950 border border-white/10 rounded-xl py-2 pl-10 pr-4 text-white text-sm focus:ring-2 focus:ring-blue-500/50 focus:outline-none"
                                                />
                                            </div>
                                            <select
                                                name="customer_id"
                                                value={formData.customer_id}
                                                onChange={handleChange}
                                                className="w-full bg-slate-950 border border-white/10 rounded-xl py-3 px-4 text-white focus:ring-2 focus:ring-blue-500/50 focus:outline-none appearance-none"
                                            >
                                                <option value="">Venta General (Sin asignar)</option>
                                                {customers
                                                    .filter(c =>
                                                        `${c.first_name} ${c.last_name}`.toLowerCase().includes(searchTerm.toLowerCase())
                                                    )
                                                    .slice(0, 50)
                                                    .map(c => (
                                                        <option key={c.id} value={c.id}>
                                                            {c.first_name.toUpperCase()} {c.last_name.toUpperCase()}
                                                        </option>
                                                    ))
                                                }
                                            </select>
                                        </div>
                                    </div>
                                )}

                                <div className="grid grid-cols-2 gap-4">
                                    {/* Quantity */}
                                    <div className="relative group">
                                        <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Cantidad</label>
                                        <input
                                            type="number"
                                            name="quantity"
                                            value={formData.quantity}
                                            onChange={handleChange}
                                            required
                                            className="w-full bg-slate-950 border border-white/10 rounded-xl py-3 px-4 text-white focus:ring-2 focus:ring-blue-500/50 focus:outline-none text-2xl font-black text-center"
                                        />

                                        {formData.type === 'sale' && formData.quantity > (selectedProduct?.stock || 0) && (
                                            <div className="mt-2 p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl animate-in slide-in-from-top-2 duration-300">
                                                <div className="flex items-start gap-2">
                                                    <AlertCircle size={16} className="text-amber-500 shrink-0 mt-0.5" />
                                                    <div className="w-full">
                                                        <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest leading-none mb-1">Stock Insuficiente</p>
                                                        <p className="text-[11px] text-amber-200/70 leading-tight mb-2">
                                                            Se generará una <span className="text-white font-bold">compra automática</span> de <span className="text-white font-bold">{formData.quantity - (selectedProduct?.stock || 0)} unidades</span> para cubrir el déficit.
                                                        </p>

                                                        <div className="flex items-center gap-2">
                                                            <label className="text-[10px] text-amber-500/80 font-mono whitespace-nowrap">Coste Reposición (€):</label>
                                                            <input
                                                                type="number"
                                                                step="0.01"
                                                                name="auto_purchase_cost"
                                                                value={formData.auto_purchase_cost}
                                                                onChange={handleChange}
                                                                className="w-24 bg-slate-950 border border-amber-500/30 rounded px-2 py-1 text-xs text-white focus:ring-1 focus:ring-amber-500 focus:outline-none text-right font-mono"
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Cost per unit */}
                                    <div>
                                        <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">
                                            {formData.type === 'sale' ? 'Precio Venta (€)' : 'Coste Unidad (€)'}
                                        </label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            name="unit_cost"
                                            value={formData.unit_cost}
                                            onChange={handleChange}
                                            className="w-full bg-slate-950 border border-white/10 rounded-xl py-3 px-4 text-white focus:ring-2 focus:ring-blue-500/50 focus:outline-none text-2xl font-black text-center"
                                        />
                                    </div>
                                </div>

                                {/* Total Cost Preview */}
                                <div className="bg-slate-950/50 p-4 rounded-xl border border-white/5 flex items-center justify-between">
                                    <span className="text-xs font-black text-slate-500 uppercase tracking-widest">
                                        {formData.type === 'sale' ? 'Total Venta' : 'Inversión Total'}
                                    </span>
                                    <span className={`text-xl font-black ${formData.type === 'sale' ? 'text-emerald-400' : 'text-white'}`}>
                                        {(formData.quantity * formData.unit_cost).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                                    </span>
                                </div>

                                {/* Notes */}
                                <div>
                                    <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Notas / Referencia Pedido</label>
                                    <textarea
                                        name="notes"
                                        value={formData.notes}
                                        onChange={handleChange}
                                        rows="2"
                                        className="w-full bg-slate-950 border border-white/10 rounded-xl py-3 px-4 text-white focus:ring-2 focus:ring-blue-500/50 focus:outline-none placeholder:text-slate-700 resize-none"
                                        placeholder="Ej. Pedido #123 - Proveedor NutriSport"
                                    />
                                </div>
                            </div>
                        ) : (
                            <div className="py-12 border-2 border-dashed border-white/5 rounded-3xl flex flex-col items-center justify-center gap-3 opacity-20 grayscale">
                                <Package size={48} />
                                <p className="text-sm font-medium">Selecciona un producto para continuar</p>
                            </div>
                        )}
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
                            disabled={saving || !formData.product_id}
                            className={`flex-[2] py-3 rounded-xl font-bold transition-all shadow-lg flex items-center justify-center gap-2 ${!formData.product_id ? 'bg-slate-800 text-slate-500 cursor-not-allowed' :
                                formData.type === 'purchase' ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-500/20 text-white' :
                                    'bg-blue-600 hover:bg-blue-500 shadow-blue-600/20 text-white'
                                }`}
                        >
                            {saving ? 'Procesando...' : <><Save size={20} /> Confirmar Movimiento</>}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
