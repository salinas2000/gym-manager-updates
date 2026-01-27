import React, { useEffect, useState } from 'react';
import { X, Zap } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useGym } from '../../context/GymContext';
import MembershipTimeline from '../customers/MembershipTimeline';

export default function PaymentDrawer({ isOpen, onClose, children, customer }) {
    const { toggleCustomerStatus } = useGym();
    const [history, setHistory] = useState([]);
    const [loadingHistory, setLoadingHistory] = useState(false);

    // Load history when drawer opens for a specific customer
    useEffect(() => {
        const loadHistory = async () => {
            if (isOpen && customer) {
                setLoadingHistory(true);
                try {
                    const res = await window.api.customers.getHistory(customer.id);
                    if (res.success) {
                        setHistory(res.data);
                    }
                } catch (e) {
                    console.error("Failed to load history", e);
                } finally {
                    setLoadingHistory(false);
                }
            }
        };
        loadHistory();
    }, [isOpen, customer]);

    const handleReactivate = async () => {
        if (!customer) return;
        await toggleCustomerStatus(customer.id);
        // Refresh history
        const res = await window.api.customers.getHistory(customer.id);
        if (res.success) setHistory(res.data);
    };

    return (
        <>
            {/* Backdrop */}
            <div
                className={cn(
                    "fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-sm transition-opacity duration-300",
                    isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
                )}
                onClick={onClose}
            />

            {/* Drawer */}
            <div className={cn(
                "fixed top-0 right-0 h-full w-[500px] max-w-full bg-slate-900/80 backdrop-blur-xl border-l border-white/10 shadow-2xl z-50 transform transition-transform duration-300 ease-out flex flex-col",
                isOpen ? "translate-x-0" : "translate-x-full"
            )}>
                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 p-2 rounded-full hover:bg-white/5 text-slate-500 hover:text-white transition-colors z-10"
                >
                    <X size={20} />
                </button>

                {/* Hero / Header Section if customer exists */}
                {customer && (
                    <div className="p-8 pb-4 border-b border-white/5">
                        <h2 className="text-2xl font-bold text-white max-w-[80%] truncate">
                            {customer.first_name} {customer.last_name}
                        </h2>
                        <p className="text-slate-400 text-sm mb-4">{customer.email}</p>

                        {!customer.active && (
                            <button
                                onClick={handleReactivate}
                                className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2 transition-all transform hover:scale-[1.02] active:scale-[0.98]"
                            >
                                <Zap size={18} className="text-yellow-300 fill-current" />
                                Reactivar Socio
                            </button>
                        )}
                    </div>
                )}

                <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
                    {/* Payment Grid (Children) */}
                    <div className="space-y-4">
                        <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Pagos</h3>
                        {children}
                    </div>

                    {/* Timeline */}
                    {customer && (
                        <div className="space-y-4 pt-6 border-t border-white/5">
                            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Historial de Actividad</h3>
                            {loadingHistory ? (
                                <p className="text-slate-500 text-sm italic">Cargando...</p>
                            ) : (
                                <MembershipTimeline history={history} />
                            )}
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}
