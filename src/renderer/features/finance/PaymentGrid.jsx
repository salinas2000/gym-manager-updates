import React, { useEffect, useState } from 'react';
import { useGym } from '../../context/GymContext';
import { cn } from '../../lib/utils';
import { Check, X } from 'lucide-react';
import PaymentModal from '../finance/PaymentModal';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

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
            <header className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-white">{customer.first_name} {customer.last_name}</h2>
                    <p className="text-slate-400 text-sm">Payment History • {selectedYear}</p>
                </div>
            </header>

            <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {MONTHS.map((month, index) => {
                    const payment = getPaymentForMonth(customer.id, index, selectedYear);
                    const paid = !!payment;

                    return (
                        <div
                            key={month}
                            onClick={() => handleMonthClick(index)}
                            className={cn(
                                "aspect-square rounded-2xl flex flex-col items-center justify-center cursor-pointer transition-all border group relative overflow-hidden",
                                paid
                                    ? "bg-emerald-500/10 border-emerald-500/20 hover:bg-emerald-500/20 text-emerald-400"
                                    : "bg-slate-900/40 border-slate-800 hover:border-slate-700 text-slate-500 hover:text-slate-300"
                            )}
                        >
                            <span className="text-sm font-semibold mb-2">{month}</span>
                            <div className={cn(
                                "w-8 h-8 rounded-full flex items-center justify-center transition-all",
                                paid ? "bg-emerald-500 text-slate-950" : "bg-slate-800"
                            )}>
                                {paid ? <Check size={16} strokeWidth={3} /> : <X size={16} />}
                            </div>

                            {/* Hover Hint */}
                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-[2px]">
                                <span className="text-xs font-bold text-white tracking-widest uppercase">
                                    {paid ? 'Details' : 'Pay'}
                                </span>
                            </div>
                        </div>
                    );
                })}
            </div>

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
