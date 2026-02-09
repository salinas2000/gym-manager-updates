import React, { useState, useEffect } from 'react';
import { Package, Plus, ShoppingCart, History, AlertTriangle, Search, Filter, Edit2, Trash2, ArrowUpRight, ArrowDownRight, FolderOpen } from 'lucide-react';
import ProductModal from './components/ProductModal';
import OrderModal from './components/OrderModal';
import CategoryModal from './components/CategoryModal';
import ConfirmationModal from '../../components/ui/ConfirmationModal';

export default function InventoryPage() {
    const [products, setProducts] = useState([]);
    const [categories, setCategories] = useState([]);
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('');
    const [activeTab, setActiveTab] = useState('products'); // 'products' or 'orders'

    const [selectedProduct, setSelectedProduct] = useState(null);
    const [isProductModalOpen, setIsProductModalOpen] = useState(false);
    const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
    const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
    const [orderType, setOrderType] = useState('purchase');
    const [productToDelete, setProductToDelete] = useState(null);
    const [orderToDelete, setOrderToDelete] = useState(null);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [productsRes, ordersRes, categoriesRes] = await Promise.all([
                window.api.inventory.getProducts(),
                window.api.inventory.getOrders(),
                window.api.inventory.getCategories()
            ]);

            if (productsRes.success && Array.isArray(productsRes.data)) setProducts(productsRes.data);
            if (ordersRes.success && Array.isArray(ordersRes.data)) setOrders(ordersRes.data);
            if (categoriesRes.success && Array.isArray(categoriesRes.data)) setCategories(categoriesRes.data);
        } catch (error) {
            console.error('Error loading inventory data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateProduct = () => {
        setSelectedProduct(null);
        setIsProductModalOpen(true);
    };

    const handleEditProduct = (product) => {
        setSelectedProduct(product);
        setIsProductModalOpen(true);
    };

    const handleDeleteProduct = (product) => {
        setProductToDelete(product);
    };

    const confirmDeleteProduct = async () => {
        if (!productToDelete) return;

        try {
            const res = await window.api.inventory.deleteProduct(productToDelete.id);
            if (res.success) {
                loadData();
            }
        } catch (error) {
            console.error('Error deleting product:', error);
        } finally {
            setProductToDelete(null);
        }
    };

    const handleDeleteOrder = (order) => {
        setOrderToDelete(order);
    };

    const confirmDeleteOrder = async () => {
        if (!orderToDelete) return;

        try {
            const res = await window.api.inventory.deleteOrder(orderToDelete.id);
            if (res.success) {
                loadData();
            }
        } catch (error) {
            console.error('Error deleting order:', error);
        } finally {
            setOrderToDelete(null);
        }
    };

    const handleCreateOrder = (type, product = null) => {
        setOrderType(type);
        setSelectedProduct(product);
        setIsOrderModalOpen(true);
    };

    const filteredProducts = (Array.isArray(products) ? products : []).filter(p => {
        const matchesSearch = (p.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (p.sku || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (p.category || '').toLowerCase().includes(searchTerm.toLowerCase());

        const matchesCategory = selectedCategory === '' || p.category === selectedCategory;

        return matchesSearch && matchesCategory;
    });

    const lowStockCount = (Array.isArray(products) ? products : []).filter(p => p.stock <= p.min_stock).length;

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
                        <Package className="text-blue-500" size={32} />
                        Gestión de Almacén
                    </h1>
                    <p className="text-slate-400 mt-1">Control de inventario, precios y pedidos.</p>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setIsCategoryModalOpen(true)}
                        className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold transition-all border border-white/5"
                    >
                        <FolderOpen size={18} className="text-indigo-400" />
                        Categorías
                    </button>
                    <button
                        onClick={() => handleCreateOrder('purchase')}
                        className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold transition-all border border-white/5"
                    >
                        <ShoppingCart size={18} className="text-emerald-400" />
                        Nuevo Pedido
                    </button>
                    <button
                        onClick={() => handleCreateOrder('sale')}
                        className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold transition-all border border-white/5"
                    >
                        <History size={18} className="text-blue-400" />
                        Registrar Venta
                    </button>
                    <button
                        onClick={handleCreateProduct}
                        className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold transition-all shadow-lg shadow-blue-600/20"
                    >
                        <Plus size={20} />
                        Añadir Producto
                    </button>
                </div>
            </div>

            {/* Stats Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-slate-900/50 backdrop-blur-xl border border-white/5 p-5 rounded-2xl">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-slate-400 text-sm font-medium">Total Productos</span>
                        <Package className="text-blue-400" size={20} />
                    </div>
                    <div className="text-2xl font-black text-white">{products.length}</div>
                </div>
                <div className="bg-slate-900/50 backdrop-blur-xl border border-white/5 p-5 rounded-2xl">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-slate-400 text-sm font-medium">Stock Bajo</span>
                        <AlertTriangle className={lowStockCount > 0 ? "text-orange-500" : "text-slate-600"} size={20} />
                    </div>
                    <div className={`text-2xl font-black ${lowStockCount > 0 ? 'text-orange-500' : 'text-white'}`}>
                        {lowStockCount}
                    </div>
                </div>
                <div className="bg-slate-900/50 backdrop-blur-xl border border-white/5 p-5 rounded-2xl">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-slate-400 text-sm font-medium">Valor Inventario (Venta)</span>
                        <div className="p-1 bg-emerald-500/10 rounded-md text-emerald-500">
                            <ArrowUpRight size={16} />
                        </div>
                    </div>
                    <div className="text-2xl font-black text-emerald-400">
                        {products.reduce((acc, p) => acc + (p.stock * p.sale_price), 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                    </div>
                </div>
            </div>

            {/* Tabs & Search */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-slate-900/30 p-2 rounded-2xl border border-white/5">
                <div className="flex items-center gap-1">
                    <button
                        onClick={() => setActiveTab('products')}
                        className={`px-6 py-2 rounded-xl font-bold text-sm transition-all ${activeTab === 'products' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
                    >
                        Productos
                    </button>
                    <button
                        onClick={() => setActiveTab('orders')}
                        className={`px-6 py-2 rounded-xl font-bold text-sm transition-all ${activeTab === 'orders' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
                    >
                        Historial de Pedidos
                    </button>
                </div>

                <div className="flex flex-col md:flex-row items-center gap-3 w-full md:w-auto">
                    <div className="relative w-full md:w-56">
                        <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                        <select
                            value={selectedCategory}
                            onChange={(e) => setSelectedCategory(e.target.value)}
                            className="w-full bg-slate-950 border border-white/10 rounded-xl py-2 pl-10 pr-4 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all font-medium appearance-none"
                        >
                            <option value="">Todas las categorías</option>
                            {categories.map(cat => (
                                <option key={cat.id} value={cat.name}>{cat.name.toUpperCase()}</option>
                            ))}
                        </select>
                    </div>

                    <div className="relative w-full md:w-80">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                        <input
                            type="text"
                            placeholder="Buscar productos..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-slate-950 border border-white/10 rounded-xl py-2 pl-10 pr-4 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all font-medium"
                        />
                    </div>
                </div>
            </div>

            {/* Content Table */}
            <div className="bg-slate-900/50 backdrop-blur-xl border border-white/5 rounded-2xl overflow-hidden shadow-2xl">
                {activeTab === 'products' ? (
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-white/5 bg-white/5">
                                <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-widest">Producto</th>
                                <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-widest">SKU / Cat</th>
                                <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-widest text-right">Compra (€)</th>
                                <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-widest text-right">Venta (€)</th>
                                <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-widest text-center">Stock</th>
                                <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-widest text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {filteredProducts.length > 0 ? filteredProducts.map(product => (
                                <tr key={product.id} className="hover:bg-white/5 transition-colors group">
                                    <td className="px-6 py-4">
                                        <div className="font-bold text-white group-hover:text-blue-400 transition-colors uppercase tracking-tight">{product.name}</div>
                                        <div className="text-xs text-slate-500 truncate max-w-[200px]">{product.description || 'Sin descripción'}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="text-sm font-medium text-slate-300">{product.sku || '---'}</div>
                                        <div className="text-[10px] text-slate-500 uppercase font-bold">{product.category || 'General'}</div>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="text-sm font-bold text-slate-400">
                                            {product.purchase_price.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="text-base font-black text-white">
                                            {product.sale_price.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                                        </div>
                                        {product.sale_price > product.purchase_price && (
                                            <div className="text-[10px] text-emerald-500 font-bold">
                                                Margen: {(((product.sale_price - product.purchase_price) / product.sale_price) * 100).toFixed(0)}%
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col items-center">
                                            <div className={`text-lg font-black ${product.stock <= product.min_stock ? 'text-orange-500' : 'text-white'}`}>
                                                {product.stock}
                                            </div>
                                            <div className="text-[9px] text-slate-500 uppercase font-black">Mín: {product.min_stock}</div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <button
                                                onClick={() => handleCreateOrder('sale', product)}
                                                className="p-2 bg-slate-800 hover:bg-emerald-900/30 text-emerald-400 rounded-lg transition-all"
                                                title="Registrar Venta"
                                            >
                                                <ShoppingCart size={16} />
                                            </button>
                                            <button
                                                onClick={() => handleCreateOrder('adjustment', product)}
                                                className="p-2 bg-slate-800 hover:bg-slate-700 text-amber-400 rounded-lg transition-all"
                                                title="Ajustar Stock"
                                            >
                                                <History size={16} />
                                            </button>
                                            <button
                                                onClick={() => handleEditProduct(product)}
                                                className="p-2 bg-slate-800 hover:bg-slate-700 text-blue-400 rounded-lg transition-all"
                                                title="Editar"
                                            >
                                                <Edit2 size={16} />
                                            </button>
                                            <button
                                                onClick={() => handleDeleteProduct(product)}
                                                className="p-2 bg-slate-800 hover:bg-red-900/50 text-slate-400 hover:text-red-400 rounded-lg transition-all"
                                                title="Eliminar"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan="6" className="px-6 py-20 text-center">
                                        <div className="flex flex-col items-center justify-center animate-in fade-in zoom-in duration-500">
                                            <div className="p-6 bg-slate-800/30 rounded-full text-slate-600 mb-4 border border-white/5">
                                                <Package size={64} />
                                            </div>
                                            <h3 className="text-xl font-black text-white uppercase tracking-tight">Inventario Vacío</h3>
                                            <p className="text-slate-500 mt-2 max-w-sm mx-auto">
                                                {searchTerm || selectedCategory
                                                    ? 'No se encontraron productos que coincidan con los filtros aplicados.'
                                                    : 'Aún no has registrado ningún producto en el almacén. Comienza añadiendo uno nuevo.'}
                                            </p>
                                            {!searchTerm && !selectedCategory && (
                                                <button
                                                    onClick={handleCreateProduct}
                                                    className="mt-6 flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-black transition-all shadow-xl shadow-blue-600/20 uppercase text-xs tracking-widest"
                                                >
                                                    <Plus size={18} />
                                                    Crear primer producto
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                ) : (
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-white/5 bg-white/5">
                                <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-widest">Fecha</th>
                                <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-widest">Producto</th>
                                <th className="px-6 py-4 text-left text-xs font-black text-slate-500 uppercase tracking-widest">Tipo</th>
                                <th className="px-6 py-4 text-left text-xs font-black text-slate-500 uppercase tracking-widest">Cliente</th>
                                <th className="px-6 py-4 text-left text-xs font-black text-slate-500 uppercase tracking-widest">Cant.</th>
                                <th className="px-6 py-4 text-left text-xs font-black text-slate-500 uppercase tracking-widest">Total</th>
                                <th className="px-6 py-4 text-left text-xs font-black text-slate-500 uppercase tracking-widest">Notas</th>
                                <th className="px-6 py-4 text-right text-xs font-black text-slate-500 uppercase tracking-widest">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {Array.isArray(orders) && orders.length > 0 ? orders.map(order => (
                                <tr key={order.id} className="hover:bg-white/[0.02] transition-colors group">
                                    <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-400 font-medium">
                                        {new Date(order.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex flex-col">
                                            <span className="text-sm font-black text-white uppercase tracking-tight">{order.product_name}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-wider ${order.type === 'purchase' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' :
                                            order.type === 'sale' ? 'bg-blue-500/10 text-blue-500 border border-blue-500/20' :
                                                'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                                            }`}>
                                            {order.type === 'purchase' ? 'Compra' : order.type === 'sale' ? 'Venta' : 'Ajuste'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className="text-xs font-bold text-slate-400">
                                            {order.customer_name || (order.type === 'sale' ? 'Público General' : '-')}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-black text-white">
                                        {order.quantity > 0 ? `+${order.quantity}` : order.quantity}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-black text-white">
                                        {order.total_cost.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="text-xs text-slate-400 italic">{order.notes || '---'}</div>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <button
                                            onClick={() => handleDeleteOrder(order)}
                                            className="p-2 bg-slate-800 hover:bg-red-900/50 text-slate-400 hover:text-red-400 rounded-lg transition-all"
                                            title="Borrar Movimiento"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan="6" className="px-6 py-20 text-center">
                                        <div className="flex flex-col items-center justify-center animate-in fade-in zoom-in duration-500">
                                            <div className="p-6 bg-slate-800/30 rounded-full text-slate-600 mb-4 border border-white/5">
                                                <History size={64} />
                                            </div>
                                            <h3 className="text-xl font-black text-white uppercase tracking-tight">Sin Movimientos</h3>
                                            <p className="text-slate-500 mt-2 max-w-sm mx-auto">
                                                Aún no se han registrado compras, ventas o ajustes de stock. El historial aparecerá aquí automáticamente.
                                            </p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Modals */}
            {isProductModalOpen && (
                <ProductModal
                    product={selectedProduct}
                    onClose={() => setIsProductModalOpen(false)}
                    onSuccess={() => {
                        setIsProductModalOpen(false);
                        loadData();
                    }}
                />
            )}

            {isOrderModalOpen && (
                <OrderModal
                    type={orderType}
                    product={selectedProduct}
                    products={products}
                    onClose={() => setIsOrderModalOpen(false)}
                    onSuccess={() => {
                        setIsOrderModalOpen(false);
                        loadData();
                    }}
                />
            )}

            {isCategoryModalOpen && (
                <CategoryModal
                    onClose={() => setIsCategoryModalOpen(false)}
                    onSuccess={() => {
                        loadData();
                    }}
                />
            )}

            <ConfirmationModal
                isOpen={!!productToDelete}
                title="Eliminar Producto"
                type="danger"
                onClose={() => setProductToDelete(null)}
                onConfirm={confirmDeleteProduct}
                confirmText="Eliminar permanentemente"
            >
                ¿Estás seguro de que deseas eliminar <strong>{productToDelete?.name}</strong>? Esta acción no se puede deshacer y eliminará también el historial de movimientos asociado.
            </ConfirmationModal>

            <ConfirmationModal
                isOpen={!!orderToDelete}
                title="Borrar Movimiento"
                type="danger"
                onClose={() => setOrderToDelete(null)}
                onConfirm={confirmDeleteOrder}
                confirmText="Borrar y Revertir Stock"
            >
                ¿Estás seguro de que deseas borrar este movimiento de <strong>{orderToDelete?.product_name}</strong>?
                <br /><br />
                <span className="text-amber-500 font-bold">⚠️ Se revertirá el efecto en el stock automáticamente.</span>
            </ConfirmationModal>
        </div>
    );
}
