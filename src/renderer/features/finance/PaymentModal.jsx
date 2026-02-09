import React, { useState, useEffect } from 'react';
import { X, Check, Trash2, CreditCard, Banknote, Calendar } from 'lucide-react';
import { useGym } from '../../context/GymContext';
import { useLanguage } from '../../context/LanguageContext';
import { cn } from '../../lib/utils';

export default function PaymentModal({ isOpen, onClose, customer, month, year, existingPayment = null }) {
    const { tariffs, addPayment, deletePayment } = useGym();
    const { t } = useLanguage();

    // Form State
    const [tariffId, setTariffId] = useState('');
    const [price, setPrice] = useState('0'); // This is "Precio a Cobrar"
    const [tariffPrice, setTariffPrice] = useState('0'); // This is "Precio Tarifa" (Read only)
    const [loading, setLoading] = useState(false);
    const [prorationInfo, setProrationInfo] = useState({ isProrated: false, daysRemaining: 0 });

    // Helper: Calculate price based on tariff and date
    const calculateAutoPrice = (tId, overrideDate = null) => {
        const selectedTariff = tariffs.find(t => t.id === Number(tId));
        if (!selectedTariff) return null;

        const baseAmount = selectedTariff.amount;
        const targetMonth = Number(month) + 1; // Convert 0-indexed to 1-indexed for logic consistency
        const targetYear = Number(year);

        let joinDay = 1;
        let isProratedInThisMonth = false;
        let displayJoinDate = null;

        const rawDate = overrideDate || fetchedJoinDate || customer.joined_date;

        if (rawDate) {
            const parts = rawDate.split(/[-T ]/);
            if (parts.length >= 3) {
                const y = parseInt(parts[0], 10);
                const m = parseInt(parts[1], 10); // 1-indexed month
                const d = parseInt(parts[2], 10);

                if (m === targetMonth && y === targetYear) {
                    joinDay = d;
                    if (joinDay > 1) {
                        isProratedInThisMonth = true;
                    }
                    displayJoinDate = `${d}/${m}/${y}`;
                }
            }
        }

        let finalPrice = baseAmount;
        let info = { isProrated: false, daysRemaining: 0, fromDate: null };

        if (isProratedInThisMonth) {
            const daysInMonth = new Date(targetYear, targetMonth, 0).getDate();
            const daysToPay = daysInMonth - joinDay + 1;

            finalPrice = (baseAmount / daysInMonth) * daysToPay;
            finalPrice = Math.round(finalPrice * 100) / 100;

            info = {
                isProrated: true,
                daysRemaining: daysToPay,
                fromDate: displayJoinDate
            };
        }

        return {
            base: baseAmount,
            charged: finalPrice,
            info
        };
    };

    const [paymentMethod, setPaymentMethod] = useState('cash');
    const [fetchedJoinDate, setFetchedJoinDate] = useState(null);
    const [isFetchingHistory, setIsFetchingHistory] = useState(false); // Explicit loading state

    useEffect(() => {
        if (isOpen) {
            setPaymentMethod('cash');
            // Fetch latest membership to be absolutely sure about Join Date
            if (customer && customer.id) {
                setIsFetchingHistory(true);
                setIsFetchingHistory(true);
                window.api.customers.getHistory(customer.id).then(response => {
                    // Fix: Handle { success: true, data: [...] } structure
                    const history = response.data || response;

                    if (Array.isArray(history) && history.length > 0) {
                        setFetchedJoinDate(history[0].start_date);
                    } else {
                        setFetchedJoinDate(null);
                    }
                }).catch(err => {
                    console.error("Failed to fetch fresh history for proration", err);
                    setFetchedJoinDate(null);
                }).finally(() => {
                    setIsFetchingHistory(false); // Done fetching
                });
            } else {
                setFetchedJoinDate(null);
                setIsFetchingHistory(false);
            }
        }
    }, [isOpen, customer]);

    // Initialize/Reset
    useEffect(() => {
        if (isOpen && customer && !isFetchingHistory) { // Wait for fetch to complete
            if (existingPayment) {
                // View Mode
            } else {
                // Create Mode - Default Tariff
                const defaultTariff = tariffs.find(t => t.id === customer.tariff_id);
                if (defaultTariff) {
                    setTariffId(defaultTariff.id);

                    // Explicitly pass the fresh date we just got (or fallback)
                    const dateToUse = fetchedJoinDate || customer.joined_date;
                    const calculation = calculateAutoPrice(defaultTariff.id, dateToUse);

                    if (calculation) {
                        setPrice(calculation.charged.toString());
                        setTariffPrice(calculation.base.toString());
                        setProrationInfo(calculation.info);
                    } else {
                        // Fallback just in case
                        setPrice(defaultTariff.amount.toString());
                        setTariffPrice(defaultTariff.amount.toString());
                        setProrationInfo({ isProrated: false, daysRemaining: 0 });
                    }
                } else {
                    setTariffId('');
                    setPrice('0');
                    setTariffPrice('0');
                    setProrationInfo({ isProrated: false, daysRemaining: 0 });
                }
            }
        }
    }, [isOpen, customer, existingPayment, tariffs, month, year, fetchedJoinDate, isFetchingHistory]);

    // Update price when tariff changes
    const handleTariffChange = (id) => {
        setTariffId(id);
        const dateToUse = fetchedJoinDate || customer.joined_date;
        const calculation = calculateAutoPrice(id, dateToUse);

        if (calculation) {
            setPrice(calculation.charged.toString());
            setTariffPrice(calculation.base.toString());
            setProrationInfo(calculation.info);
        } else {
            // "Personalizado" or invalid
            setPrice('0');
            setTariffPrice('0');
            setProrationInfo({ isProrated: false, daysRemaining: 0 });
        }
    };

    const handlePay = async () => {
        // FIX: Prevent double-click submission
        if (loading) return;

        setLoading(true);
        try {
            const tariff = tariffs.find(t => t.id === Number(tariffId));

            // Use UTC date to set to 1st of month correctly in DB
            const utcDate = new Date(Date.UTC(year, month, 1)).toISOString();

            const success = await addPayment({
                customer_id: customer.id,
                amount: parseFloat(price),
                tariff_name: tariff ? tariff.name : 'Custom',
                payment_date: utcDate
            });

            if (success) onClose();
        } finally {
            setLoading(false);
        }
    };

    const handleRefund = async () => {
        // FIX: Prevent double-click submission
        if (!existingPayment || loading) return;

        setLoading(true);
        try {
            const success = await deletePayment(customer.id, existingPayment.id);
            if (success) onClose();
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen || !customer) return null;

    const monthName = new Date(year, month).toLocaleString('es-ES', { month: 'long' });
    const title = `${monthName.charAt(0).toUpperCase() + monthName.slice(1)} ${year}`;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
                className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
                onClick={onClose}
            ></div>

            <div className="relative w-full max-w-sm bg-slate-900 border border-white/10 rounded-2xl shadow-2xl p-6 transform transition-all animate-in fade-in zoom-in-95 duration-200">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-slate-500 hover:text-white transition-colors"
                >
                    <X size={20} />
                </button>

                {/* Header */}
                <div className="text-center mb-6">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-blue-500/10 text-blue-400 mb-3">
                        <Calendar size={24} />
                    </div>
                    <h2 className="text-xl font-bold text-white mb-1">
                        {existingPayment ? 'Detalles del Pago' : 'Registrar Pago'}
                    </h2>
                    <p className="text-slate-400 uppercase tracking-wider text-xs font-bold">
                        {title}
                    </p>
                </div>

                {existingPayment ? (
                    // VIEW MODE
                    <div className="space-y-6">
                        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-center">
                            <p className="text-xs text-emerald-400 uppercase font-bold tracking-wider mb-1">Pagado</p>
                            <p className="text-3xl font-mono font-bold text-emerald-300">{existingPayment.amount}€</p>
                            <p className="text-xs text-white/60 mt-2">
                                {existingPayment.tariff_name || 'Sin Tarifa'}
                            </p>
                        </div>

                        <button
                            onClick={handleRefund}
                            disabled={loading}
                            className="w-full py-3 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 hover:text-red-300 font-medium transition-all flex items-center justify-center gap-2"
                        >
                            {loading ? 'Procesando...' : <><Trash2 size={18} /> Anular Pago / Reembolsar</>}
                        </button>
                    </div>
                ) : (
                    // CREATE MODE
                    <div className="space-y-4">
                        {/* Tariff Selection */}
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-slate-500 uppercase">Tarifa</label>
                            <select
                                className="w-full glass-input text-white bg-slate-950/50 appearance-none focus:border-blue-500"
                                value={tariffId}
                                onChange={e => handleTariffChange(e.target.value)}
                            >
                                <option value="">Personalizado</option>
                                {tariffs.map(t => (
                                    <option key={t.id} value={t.id}>{t.name}</option>
                                ))}
                            </select>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            {/* Base Tariff Price (Read Only) */}
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-slate-500 uppercase">Precio Tarifa</label>
                                <div className="px-4 py-3 rounded-xl bg-slate-950/30 border border-white/5 text-slate-400 font-mono text-lg cursor-not-allowed">
                                    {tariffPrice}€
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="block text-slate-400 text-xs font-bold mb-2 uppercase tracking-wider">
                                    Precio a Cobrar
                                </label>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-400 text-xl font-bold">€</span>
                                    <input
                                        type="number"
                                        step="0.01"
                                        className={cn(
                                            "w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 pl-10 text-emerald-400 font-bold text-2xl outline-none focus:border-emerald-500 transition-colors",
                                            isFetchingHistory && "opacity-50 animate-pulse"
                                        )}
                                        value={price}
                                        onChange={(e) => setPrice(e.target.value)}
                                        disabled={isFetchingHistory}
                                    />
                                    {isFetchingHistory && (
                                        <div className="absolute right-4 top-1/2 -translate-y-1/2">
                                            <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Proration Badge */}
                        {prorationInfo.isProrated && (
                            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-medium">
                                <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                                <span>
                                    ℹ️ Prorrateado: Alta el <b>{prorationInfo.fromDate}</b> ({prorationInfo.daysRemaining} días).
                                </span>
                            </div>
                        )}

                        <div className="pt-4">
                            <button
                                onClick={handlePay}
                                disabled={loading || !price}
                                className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold shadow-lg shadow-blue-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                {loading ? 'Registrando...' : <><Check size={18} /> Confirmar Pago</>}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
