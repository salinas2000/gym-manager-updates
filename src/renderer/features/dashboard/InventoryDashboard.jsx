import React, { useState, useEffect, useRef } from 'react';
import { Package, TrendingUp, DollarSign, AlertTriangle, Users, ArrowUpRight, ShoppingCart, Filter, ChevronRight, ChevronLeft } from 'lucide-react';
import { cn } from '../../lib/utils';
import { AreaChart, Card, Metric, Text, Flex, ProgressBar, BadgeDelta, Title, BarList, Bold, Table, TableHead, TableRow, TableHeaderCell, TableBody, TableCell } from '@tremor/react';

export default function InventoryDashboard({ data: initialData }) {
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [data, setData] = useState(initialData);
    const [loading, setLoading] = useState(false);
    const scrollRef = useRef(null);

    // Effect to reload data when category changes
    useEffect(() => {
        const reloadData = async () => {
            if (selectedCategory === 'all' && initialData && !data?.productAverages) {
                // Initialize if first load
                setData(initialData);
                return;
            }

            setLoading(true);
            try {
                if (window.api && window.api.analytics) {
                    const year = new Date().getFullYear();
                    const res = await window.api.analytics.getInventoryDashboardData(year, selectedCategory);
                    if (res.success) {
                        setData(res.data);
                    }
                }
            } catch (err) {
                console.error("Error reloading inventory data:", err);
            } finally {
                setLoading(false);
            }
        };
        reloadData();
    }, [selectedCategory, initialData]);

    if (!data) return null;

    const { history, topProducts, topCustomers, stockAlerts, totalValue, categories, productAverages } = data;

    // Formatting currency
    const formatCurrency = (val) => {
        const formatted = new Intl.NumberFormat('es-ES', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(val);
        return `${formatted} €`;
    };

    // Prepare chart data
    const chartData = history.map(h => ({
        "Mes": h.month,
        "Ventas": h.revenue,
        "Beneficio": h.profit
    }));

    // Prepare BarList for top products
    const productList = topProducts.map(p => ({
        name: p.name,
        value: p.total_revenue
    }));

    // Prepare BarList for top customers
    const customerList = topCustomers.map(c => ({
        name: c.name,
        value: c.total_spent
    }));

    // Calculate total sales and profit from history
    const totalSales = history.reduce((acc, curr) => acc + curr.revenue, 0);
    const totalProfit = history.reduce((acc, curr) => acc + curr.profit, 0);
    const profitMargin = totalSales > 0 ? (totalProfit / totalSales) * 100 : 0;

    return (
        <div className={cn("space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500", loading && "opacity-50 pointer-events-none transition-opacity")}>

            {/* Innovative Category Filter (Pill Bar) */}
            <div className="relative group">
                <div className="flex items-center gap-2 mb-4">
                    <div className="p-1.5 bg-emerald-500/10 rounded-lg">
                        <Filter size={16} className="text-emerald-400" />
                    </div>
                    <h2 className="text-sm font-black text-slate-400 uppercase tracking-widest">Explorar Categorías</h2>
                </div>

                <div className="relative flex items-center">
                    {/* Horizontal Scroll Area */}
                    <div
                        ref={scrollRef}
                        className="flex gap-3 overflow-x-auto pb-4 custom-scrollbar-hide no-scrollbar snap-x cursor-grab active:cursor-grabbing scroll-smooth"
                        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                    >
                        <CategoryPill
                            label="Todo el Inventario"
                            active={selectedCategory === 'all'}
                            onClick={() => setSelectedCategory('all')}
                            icon={Package}
                            color="emerald"
                        />
                        {categories?.map((cat) => (
                            <CategoryPill
                                key={cat}
                                label={cat}
                                active={selectedCategory === cat}
                                onClick={() => setSelectedCategory(cat)}
                                color="blue"
                            />
                        ))}
                    </div>

                    {/* Visual Fade Gradient */}
                    <div className="absolute right-0 top-0 bottom-4 w-20 bg-gradient-to-l from-slate-950 to-transparent pointer-events-none" />
                </div>
            </div>

            {/* KPI Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <KPICard
                    title="VENTAS CATEGORÍA"
                    value={formatCurrency(totalSales)}
                    icon={ShoppingCart}
                    color="text-emerald-400"
                    sub="Facturación en el periodo"
                />
                <KPICard
                    title="BENEFICIO ESTIMADO"
                    value={formatCurrency(totalProfit)}
                    icon={DollarSign}
                    color="text-blue-400"
                    trend={`${profitMargin.toFixed(1)}%`}
                    trendLabel="Margen"
                    sub="Sobre precio de compra"
                />
                <KPICard
                    title="VALOR STOCK"
                    value={formatCurrency(totalValue)}
                    icon={Package}
                    color="text-orange-400"
                    sub="Total productos en almacén"
                />
                <KPICard
                    title="ALERTAS CRÍTICAS"
                    value={stockAlerts}
                    icon={AlertTriangle}
                    color={stockAlerts > 0 ? "text-red-400" : "text-slate-400"}
                    sub="Debajo del mínimo"
                    alert={stockAlerts > 0}
                />
            </div>

            {/* Performance Chart */}
            <div className="bg-slate-900/40 backdrop-blur-md border border-white/5 rounded-[2rem] p-8 shadow-2xl">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h3 className="text-xl font-bold text-white tracking-tight">Rendimiento Mensual</h3>
                        <p className="text-slate-400 text-sm">Evolución de ventas y ganancias reales</p>
                    </div>
                    <div className="flex gap-4">
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                            <span className="text-xs text-slate-300 font-medium">Ventas</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]" />
                            <span className="text-xs text-slate-300 font-medium">Beneficio</span>
                        </div>
                    </div>
                </div>

                <div className="h-80">
                    <AreaChart
                        data={chartData}
                        index="Mes"
                        categories={["Ventas", "Beneficio"]}
                        colors={["emerald", "blue"]}
                        valueFormatter={formatCurrency}
                        showLegend={false}
                        className="h-full"
                        yAxisWidth={64}
                        curveType="monotone"
                    />
                </div>
            </div>

            {/* Averages Section */}
            <div className="bg-slate-900/40 backdrop-blur-md border border-white/5 rounded-[2rem] p-8 shadow-2xl">
                <div className="mb-8">
                    <h3 className="text-xl font-bold text-white tracking-tight">Media Mensual por Producto</h3>
                    <p className="text-slate-400 text-sm">Análisis detallado de facturación media y rotación</p>
                </div>

                <div className="overflow-x-auto custom-scrollbar">
                    <Table>
                        <TableHead>
                            <TableRow className="border-b border-white/10">
                                <TableHeaderCell className="text-slate-400 font-black uppercase text-[10px] tracking-widest opacity-70">PRODUCTO</TableHeaderCell>
                                <TableHeaderCell className="text-right text-slate-400 font-black uppercase text-[10px] tracking-widest opacity-70">ROTACIÓN</TableHeaderCell>
                                <TableHeaderCell className="text-right text-slate-400 font-black uppercase text-[10px] tracking-widest opacity-70">VALOR MEDIO/MES</TableHeaderCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {productAverages?.length > 0 ? (
                                productAverages.map((p) => (
                                    <TableRow key={p.name} className="border-b border-white/5 last:border-0 hover:bg-white/[0.03] transition-all group/row">
                                        <TableCell className="text-white font-semibold py-5 text-base">
                                            {p.name}
                                        </TableCell>
                                        <TableCell className="text-right py-5">
                                            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-950/50 border border-white/10 text-slate-300 text-xs font-mono group-hover/row:border-blue-500/30 transition-colors">
                                                <TrendingUp size={12} className="text-blue-400" />
                                                {p.total_units} unid.
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-right py-5">
                                            <div className="flex flex-col items-end">
                                                <span className="text-emerald-400 font-black text-lg tracking-tight group-hover/row:scale-105 transition-transform">
                                                    {formatCurrency(p.avg_monthly_revenue)}
                                                </span>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={3} className="text-center py-20">
                                        <div className="flex flex-col items-center gap-3 opacity-30">
                                            <Package size={48} />
                                            <p className="text-sm font-medium">Sin datos de ventas en esta categoría</p>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>

            {/* Rankings Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

                {/* Top Products */}
                <div className="bg-slate-900/40 backdrop-blur-md border border-white/5 rounded-[2rem] p-8 shadow-2xl">
                    <Flex className="mb-8">
                        <div>
                            <h3 className="text-xl font-bold text-white tracking-tight">Top 5 Rentabilidad</h3>
                            <p className="text-slate-400 text-sm">Por facturación acumulada</p>
                        </div>
                        <div className="p-2 bg-emerald-500/10 rounded-xl">
                            <TrendingUp size={20} className="text-emerald-400" />
                        </div>
                    </Flex>
                    <BarList
                        data={productList}
                        color="emerald"
                        className="mt-4"
                        valueFormatter={formatCurrency}
                    />
                </div>

                {/* Top Buyers */}
                <div className="bg-slate-900/40 backdrop-blur-md border border-white/5 rounded-[2rem] p-8 shadow-2xl">
                    <Flex className="mb-8">
                        <div>
                            <h3 className="text-xl font-bold text-white tracking-tight">Mejores Compradores</h3>
                            <p className="text-slate-400 text-sm">Inversión por cliente en categoría</p>
                        </div>
                        <div className="p-2 bg-blue-500/10 rounded-xl">
                            <Users size={20} className="text-blue-400" />
                        </div>
                    </Flex>
                    <BarList
                        data={customerList}
                        color="blue"
                        valueFormatter={formatCurrency}
                        className="mt-4"
                    />
                </div>

            </div>

        </div>
    );
}

function CategoryPill({ label, active, onClick, icon: Icon, color = "blue" }) {
    const activeStyles = {
        emerald: "bg-emerald-500/20 border-emerald-500/50 text-emerald-300 shadow-[0_0_20px_rgba(16,185,129,0.2)]",
        blue: "bg-blue-500/20 border-blue-500/50 text-blue-300 shadow-[0_0_20px_rgba(59,130,246,0.2)]",
    };

    return (
        <button
            onClick={onClick}
            className={cn(
                "flex items-center gap-2 px-6 py-3 rounded-2xl border transition-all shrink-0 whitespace-nowrap text-sm font-bold uppercase tracking-tight",
                "hover:scale-105 active:scale-95",
                active
                    ? activeStyles[color] || activeStyles.blue
                    : "bg-slate-900/50 border-white/5 text-slate-500 hover:text-slate-300 hover:border-white/10 backdrop-blur-sm"
            )}
        >
            {Icon && <Icon size={16} />}
            {label}
        </button>
    );
}

function KPICard({ title, value, icon: Icon, color, trend, trendLabel, sub, alert }) {
    return (
        <div className={cn(
            "bg-slate-900/40 backdrop-blur-md border border-white/5 rounded-[1.5rem] p-6 hover:bg-slate-800/50 transition-all group shadow-lg",
            alert && "border-red-500/30 bg-red-500/5"
        )}>
            <div className="flex justify-between items-start mb-6">
                <div className={cn(
                    "p-3.5 rounded-2xl bg-slate-950/50 border border-white/5 shadow-inner transition-transform group-hover:scale-110 duration-300",
                    color
                )}>
                    <Icon size={22} />
                </div>
                {trend && (
                    <div className="text-right">
                        <span className="text-xs font-black text-emerald-400 block tracking-tighter">{trend}</span>
                        <span className="text-[9px] text-slate-500 uppercase font-bold">{trendLabel}</span>
                    </div>
                )}
            </div>
            <div>
                <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em] mb-2">{title}</p>
                <div className="flex items-baseline gap-2">
                    <h3 className="text-2xl font-black text-white tracking-tighter leading-none">{value}</h3>
                </div>
                {sub && <p className="text-xs text-slate-500 mt-3 font-medium opacity-70 group-hover:opacity-100 transition-opacity">{sub}</p>}
            </div>
        </div>
    );
}
