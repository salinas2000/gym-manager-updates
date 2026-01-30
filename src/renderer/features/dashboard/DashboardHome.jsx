import React, { useEffect, useState } from 'react';
import { TrendingUp, Users, CreditCard, Activity, ChevronDown } from 'lucide-react';
import GrowthChart from '../finance/GrowthChart';
import TariffPieChart from '../finance/TariffPieChart';
import RecentActivity from './RecentActivity';
import { cn } from '../../lib/utils';
import { useLanguage } from '../../context/LanguageContext';

export default function DashboardHome() {
    const { t } = useLanguage();
    const [data, setData] = useState(null);
    const [availableYears, setAvailableYears] = useState([]);
    const [recentTx, setRecentTx] = useState([]);
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            if (window.api && window.api.analytics) {
                const [dashboardData, yearsRes, recentRes] = await Promise.all([
                    window.api.analytics.getDashboardData(selectedYear),
                    window.api.analytics.getAvailableYears(),
                    window.api.analytics.getRecentTransactions(5)
                ]);

                if (dashboardData.success) setData(dashboardData.data);
                if (yearsRes.success) setAvailableYears(yearsRes.data);
                if (recentRes.success) setRecentTx(recentRes.data);
            }
            setLoading(false);
        };
        load();
    }, [selectedYear]);

    if (loading) return <div className="p-8 text-slate-400">Loading analytics...</div>;
    if (!data) return <div className="p-8 text-slate-400">Failed to load analytics.</div>;

    // Calculate basic totals for KPIs
    const totalRevenue = data.revenue.reduce((acc, curr) => acc + curr.revenue, 0);
    const totalMembers = data.activeCount !== undefined
        ? data.activeCount
        : data.distribution.reduce((acc, curr) => acc + curr.value, 0); // Fallback

    // New Members This Month
    const currentMonthIndex = new Date().getMonth();
    const newMembersThisMonth = data.newMembers ? data.newMembers[currentMonthIndex]?.members || 0 : 0;

    // Quick month trend (Revenue)
    const currentMonthRev = data.revenue[currentMonthIndex]?.revenue || 0;
    const prevMonthRev = data.revenue[currentMonthIndex - 1]?.revenue || 0;
    const revGrowth = prevMonthRev > 0 ? ((currentMonthRev - prevMonthRev) / prevMonthRev) * 100 : 0;

    // Calculate Average Monthly Revenue
    // Logic:
    // - Current Year: Divide total revenue by months passed so far.
    // - Past Years: Divide total revenue by 12.
    let avgRevenue = 0;

    // Default to Annual
    let avgSubtitle = t('dashboard.avgAnnual') || "Annual Average";

    const currentYearNum = new Date().getFullYear();
    const selectedYearNum = Number(selectedYear);

    if (selectedYearNum === currentYearNum) {
        const monthsPassed = new Date().getMonth() + 1; // 1-12
        // Sum revenue up to current month (inclusive)
        const totalUpToNow = data.revenue.slice(0, monthsPassed).reduce((acc, curr) => acc + curr.revenue, 0);
        avgRevenue = totalUpToNow / monthsPassed;
        avgSubtitle = t('dashboard.avgYtd') || "Average (YTD)";
    } else {
        avgRevenue = totalRevenue / 12;
    }

    return (
        <div className="space-y-6 h-full flex flex-col overflow-y-auto custom-scrollbar p-1">

            {/* Header */}
            <div className="flex items-center justify-between px-2">
                <div>
                    <h1 className="text-2xl font-bold text-white">{t('dashboard.title')}</h1>
                    <p className="text-slate-400 text-sm">{t('dashboard.welcome')}</p>
                </div>
                <div className="flex items-center gap-4">
                    {/* Year Selector */}
                    <div className="relative group">
                        <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 border border-white/10 hover:border-blue-500/50 transition-colors text-sm font-medium">
                            {selectedYear}
                            <ChevronDown size={14} className="text-slate-500" />
                        </button>
                        <div className="absolute right-0 top-full mt-2 w-32 bg-slate-900 border border-white/10 rounded-xl shadow-xl overflow-hidden opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                            {availableYears.map(year => (
                                <button
                                    key={year}
                                    onClick={() => setSelectedYear(Number(year))}
                                    className={cn(
                                        "w-full text-left px-4 py-2 text-sm hover:bg-slate-800",
                                        year == selectedYear ? "text-blue-400 font-bold" : "text-slate-400"
                                    )}
                                >
                                    {year}
                                </button>
                            ))}
                        </div>
                    </div>

                    <span className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold animate-pulse">
                        LIVE
                    </span>
                </div>
            </div>

            {/* KPI Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <KPICard
                    title={t('dashboard.monthlyRevenue') || "Revenue"}
                    value={new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(totalRevenue)}
                    icon={CreditCard}
                    color="text-emerald-400"
                    trend={revGrowth > 0 ? `+${revGrowth.toFixed(1)}%` : `${revGrowth.toFixed(1)}%`}
                    trendUp={revGrowth >= 0}
                />
                <KPICard
                    title={t('dashboard.activeMembers') || "Active Members"}
                    value={totalMembers}
                    icon={Users}
                    color="text-blue-400"
                    sub={t('dashboard.memberGrowth') || "Total Active"}
                />
                <KPICard
                    title={t('dashboard.averageRevenue') || "Monthly Average"}
                    value={new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(avgRevenue)}
                    icon={TrendingUp}
                    color="text-orange-400"
                    sub={avgSubtitle}
                />
            </div>

            {/* Main Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 flex-1 min-h-[500px]">

                {/* Growth & Revenue (Line/Bar) - 3 Calls */}
                <div className="lg:col-span-3 bg-slate-900/50 backdrop-blur-sm border border-white/5 rounded-3xl p-6 flex flex-col min-h-[350px]">
                    <h3 className="text-lg font-semibold text-white mb-6">{t('dashboard.revenueHistory') || "Growth & Revenue"}</h3>
                    <div className="flex-1 min-h-[300px]">
                        <GrowthChart data={data} />
                    </div>
                </div>

                {/* Recent Activity (1 Col) - Tall */}
                <div className="bg-slate-900/50 backdrop-blur-sm border border-white/5 rounded-3xl p-6 flex flex-col row-span-2">
                    <h3 className="text-lg font-semibold text-white mb-4">{t('dashboard.recentActivity') || "Recent Activity"}</h3>
                    <div className="flex-1 w-full">
                        <RecentActivity transactions={recentTx} />
                    </div>
                </div>



                {/* Tariff Distribution (3 Cols) - Expanded View */}
                <div className="lg:col-span-3 bg-slate-900/50 backdrop-blur-sm border border-white/5 rounded-3xl p-6 flex flex-col">
                    <h3 className="text-lg font-semibold text-white mb-6">{t('dashboard.tariffDistribution') || "Distribution"}</h3>
                    <div className="flex-1 flex flex-col md:flex-row items-center justify-around gap-12">
                        {/* Chart Area - Larger fixed height */}
                        <div className="w-full max-w-[400px] h-[300px] relative">
                            <TariffPieChart data={data.distribution} />
                        </div>

                        {/* Interactive Legend - Grid Layout */}
                        <div className="grid grid-cols-2 lg:grid-cols-2 gap-x-16 gap-y-6 min-w-[350px]">
                            {data.distribution.map((d, i) => {
                                const COLORS = ['#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6'];
                                const color = COLORS[i % COLORS.length];
                                const total = data.distribution.reduce((acc, curr) => acc + curr.value, 0);
                                const percent = total > 0 ? ((d.value / total) * 100).toFixed(1) : 0;

                                return (
                                    <div key={d.name} className="flex items-center gap-4 text-xs group/item cursor-pointer hover:bg-white/5 p-3 rounded-xl transition-all border border-transparent hover:border-white/5">
                                        <div
                                            className="w-4 h-4 rounded-full shadow-lg shadow-white/5 flex-shrink-0"
                                            style={{ backgroundColor: color, boxShadow: `0 0 15px ${color}50` }}
                                        />
                                        <div className="flex flex-col flex-1">
                                            <span className="text-white font-bold text-sm group-hover/item:text-blue-200 transition-colors">{d.name}</span>
                                            <span className="text-xs text-slate-500 font-mono tracking-wide">{percent}% del total</span>
                                        </div>
                                        <span className="font-black text-2xl text-slate-700 group-hover/item:text-white transition-colors">{d.value}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}

function KPICard({ title, value, icon: Icon, color, trend, trendUp, sub }) {
    return (
        <div className="bg-slate-900/50 backdrop-blur-sm border border-white/5 rounded-2xl p-5 hover:bg-slate-900/80 transition-colors group">
            <div className="flex justify-between items-start mb-4">
                <div className={cn("p-3 rounded-xl bg-slate-950/50 border border-white/5", color)}>
                    <Icon size={20} />
                </div>
                {trend && (
                    <span className={cn(
                        "text-xs font-bold px-2 py-1 rounded-full border",
                        trendUp ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-red-500/10 text-red-400 border-red-500/20"
                    )}>
                        {trend}
                    </span>
                )}
            </div>
            <div>
                <p className="text-slate-500 text-xs font-medium uppercase tracking-wider mb-1">{title}</p>
                <h3 className="text-2xl font-bold text-white">{value}</h3>
                {sub && <p className="text-xs text-slate-600 mt-1">{sub}</p>}
            </div>
        </div>
    );
}
