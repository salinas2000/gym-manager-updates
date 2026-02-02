import React from 'react';
import { cn } from '../../../lib/utils';
import { Activity, Globe, Wifi, WifiOff, RefreshCw, BarChart3, Users, DollarSign, Cloud, CheckCircle, AlertCircle, Database } from 'lucide-react';

export function AdminStats({ stats }) {
    if (!stats) return null;

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <StatCard
                title="Gimnasios Activos"
                value={stats.activeGyms}
                icon={Activity}
                color="text-emerald-400"
                bg="bg-emerald-500/10"
                sub={`Total: ${stats.totalGyms}`}
            />
            <StatCard
                title="Ingresos Recurrentes"
                value={new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(stats.totalRevenue)}
                icon={DollarSign}
                color="text-indigo-400"
                bg="bg-indigo-500/10"
                sub="Estimado Mensual"
            />
            <StatCard
                title="Versión Global"
                value={`v${stats.latestVersion}`}
                icon={Cloud}
                color="text-blue-400"
                bg="bg-blue-500/10"
                sub="Producción"
            />
            <StatCard
                title="Estado Sistema"
                value="100%"
                icon={Database}
                color="text-purple-400"
                bg="bg-purple-500/10"
                sub="Uptime"
            />
        </div>
    );
}

function StatCard({ title, value, icon: Icon, color, bg, sub }) {
    return (
        <div className="bg-slate-900/50 backdrop-blur-sm border border-white/5 rounded-2xl p-5 hover:bg-indigo-900/10 transition-all group overflow-hidden relative">
            <div className="flex justify-between items-start mb-4 relative z-10">
                <div className={cn("p-3 rounded-xl border border-white/5 shadow-inner", bg, color)}>
                    <Icon size={20} />
                </div>
            </div>
            <div className="relative z-10">
                <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mb-1">{title}</p>
                <h3 className="text-2xl font-black text-white">{value}</h3>
                {sub && <p className="text-[10px] text-slate-500 mt-1 font-medium">{sub}</p>}
            </div>
            {/* Decal background */}
            <Icon size={80} className={cn("absolute -right-4 -bottom-4 opacity-[0.03] transition-transform group-hover:scale-110", color)} />
        </div>
    );
}
