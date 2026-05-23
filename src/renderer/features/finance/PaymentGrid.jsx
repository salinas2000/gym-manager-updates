import React, { useEffect, useState } from 'react';
import { useGym } from '../../context/GymContext';
import { cn } from '../../lib/utils';
import { Check, X, ChevronLeft, ChevronRight, Calendar, Link2 } from 'lucide-react';
import PaymentModal from '../finance/PaymentModal';

const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

export default function PaymentGrid({ customer }) {
    const { loadPaymentsForCustomer, getPaymentForMonth, isPaid } = useGym();

    // Modal State
    const [modalOpen, setModalOpen] = useState(false);
    const [selectedMonth, setSelectedMonth] = useState(null);
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

    useEffect(() => {
        if (customer) {
            loadPaymentsForCustomer(customer.id);
        }
    }, [customer]);

    // Find recommended month (first unpaid in current year, default to current month)
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const getRecommendedMonth = () => {
        if (selectedYear !== currentYear) return -1;
        // Find first unpaid month up to current month
        for (let i = 0; i <= currentMonth; i++) {
            if (!getPaymentForMonth(customer?.id, i, selectedYear)) {
                return i;
            }
        }
        return -1;
    };

    const recommendedMonth = customer ? getRecommendedMonth() : -1;

    if (!customer) {
        return (
            <div className="h-full flex flex-col items-center justify-center text-slate-500">
                <p>Select a member to view payments</p>
            </div>
        );
    }

    const handleMonthClick = (monthIndex) => {
        setSelectedMonth(monthIndex);
        setModalOpen(true);
    };

    const currentPayment = (mockMonth) => {
        if (selectedMonth === null) return null;
        return getPaymentForMonth(customer.id, selectedMonth, selectedYear);
    };

    return (
        <div className="space-y-6">
            <header className="flex items-center justify-between flex-wrap gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-white">{customer.first_name} {customer.last_name}</h2>
                    <p className="text-slate-400 text-sm">Historial de pagos · {selectedYear}</p>
                </div>
                <div className="flex items-center gap-2 bg-slate-900/60 px-3 py-2 rounded-xl border border-white/5">
                    <button
                        onClick={() => setSelectedYear(y => y - 1)}
                        className="p-1.5 hover:bg-slate-800 rounded-lg transition-colors text-slate-400 hover:text-white"
                        title="Año anterior"
                    >
                        <ChevronLeft size={18} />
                    </button>
                    <div className="flex items-center gap-2 min-w-[80px] justify-center">
                        <Calendar size={16} className="text-blue-400" />
                        <span className="font-bold text-white">{selectedYear}</span>
                    </div>
                    <button
                        onClick={() => setSelectedYear(y => y + 1)}
                        className="p-1.5 hover:bg-slate-800 rounded-lg transition-colors text-slate-400 hover:text-white"
                        title="Año siguiente"
                    >
                        <ChevronRight size={18} />
                    </button>
                    {selectedYear !== currentYear && (
                        <button
                            onClick={() => setSelectedYear(currentYear)}
                            className="ml-1 px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-blue-600/20 text-blue-300 hover:bg-blue-600/40 transition-colors border border-blue-500/30"
                        >
                            Hoy
                        </button>
                    )}
                </div>
            </header>

            <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {MONTHS.map((month, index) => {
                    const payment = getPaymentForMonth(customer.id, index, selectedYear);
                    const paid = !!payment;
                    const isRecommended = index === recommendedMonth;
                    const groupId = payment?.payment_group_id || null;
                    const hasGroup = !!groupId;
                    // Indica si el pago de este mes es el "pago real" (importe > 0) o cobertura (0€)
                    const isCoverage = hasGroup && (payment?.amount === 0 || payment?.amount === '0');

                    return (
                        <div
                            key={month}
                            onClick={() => handleMonthClick(index)}
                            title={hasGroup
                                ? (isCoverage
                                    ? 'Mes cubierto por un pago multi-mes. Click para ver / anular el grupo entero.'
                                    : 'Pago multi-mes. Cubre varios meses. Click para ver / anular el grupo entero.')
                                : (paid ? 'Pago registrado. Click para ver detalles.' : 'Mes sin pagar. Click para cobrar.')}
                            className={cn(
                                "aspect-square rounded-2xl flex flex-col items-center justify-center cursor-pointer transition-all border group relative overflow-hidden",
                                paid
                                    ? hasGroup
                                        ? "bg-purple-500/10 border-purple-500/30 hover:bg-purple-500/20 text-purple-300 ring-2 ring-purple-500/40"
                                        : "bg-emerald-500/10 border-emerald-500/20 hover:bg-emerald-500/20 text-emerald-400"
                                    : isRecommended
                                        ? "bg-blue-500/10 border-blue-500/40 hover:bg-blue-500/20 text-blue-400 ring-2 ring-blue-500/30"
                                        : "bg-slate-900/40 border-slate-800 hover:border-slate-700 text-slate-500 hover:text-slate-300"
                            )}
                        >
                            {isRecommended && (
                                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                            )}
                            {hasGroup && (
                                <span className="absolute top-1.5 right-1.5 p-0.5 rounded-md bg-purple-500/20 text-purple-300">
                                    <Link2 size={10} />
                                </span>
                            )}
                            <span className="text-sm font-semibold mb-2">{month}</span>
                            <div className={cn(
                                "w-8 h-8 rounded-full flex items-center justify-center transition-all",
                                paid
                                    ? (hasGroup
                                        ? (isCoverage ? "bg-purple-500/30 text-purple-200" : "bg-purple-500 text-slate-950")
                                        : "bg-emerald-500 text-slate-950")
                                    : isRecommended ? "bg-blue-500/20 text-blue-400" : "bg-slate-800"
                            )}>
                                {paid ? <Check size={16} strokeWidth={3} /> : <X size={16} />}
                            </div>

                            {/* Hover Hint */}
                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-[2px]">
                                <span className="text-xs font-bold text-white tracking-widest uppercase">
                                    {hasGroup ? 'Grupo' : (paid ? 'Detalles' : isRecommended ? 'Cobrar' : 'Pagar')}
                                </span>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Leyenda de grupos multi-mes */}
            {(() => {
                const hasAnyGroup = MONTHS.some((_, i) => {
                    const p = getPaymentForMonth(customer.id, i, selectedYear);
                    return p?.payment_group_id;
                });
                if (!hasAnyGroup) return null;
                return (
                    <div className="flex items-center gap-3 text-xs text-slate-400 px-1">
                        <div className="flex items-center gap-1.5">
                            <div className="w-3 h-3 rounded bg-purple-500/30 border border-purple-500/50" />
                            <span>Grupo multi-mes</span>
                        </div>
                        <span className="text-slate-600">·</span>
                        <span className="text-slate-500">Click en cualquier celda morada para ver/anular el grupo completo</span>
                    </div>
                );
            })()}

            {/* Recent Activity Mini-List (Optional for density) */}
            <div className="mt-8">
                <h3 className="text-sm font-semibold text-slate-400 mb-4 uppercase tracking-wider">Recent Activity</h3>
                <div className="glass-panel rounded-xl p-4 text-center text-sm text-slate-600">
                    No extra charges recorded.
                </div>
            </div>

            {/* Modal */}
            {modalOpen && selectedMonth !== null && (
                <PaymentModal
                    isOpen={modalOpen}
                    onClose={() => setModalOpen(false)}
                    customer={customer}
                    month={selectedMonth}
                    year={selectedYear}
                    existingPayment={getPaymentForMonth(customer.id, selectedMonth, selectedYear)}
                />
            )}
        </div>
    );
}
