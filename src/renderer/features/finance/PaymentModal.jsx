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
    const calculateAutoPrice = (tId) => {
        const selectedTariff = tariffs.find(t => t.id === Number(tId));
        if (!selectedTariff) return null;

        const baseAmount = selectedTariff.amount;
        const now = new Date();
        const isCurrentMonth = now.getMonth() === month && now.getFullYear() === year;

        let finalPrice = baseAmount;
        let info = { isProrated: false, daysRemaining: 0 };

        if (isCurrentMonth) {
            const daysInMonth = new Date(year, month + 1, 0).getDate();
            const today = now.getDate();
            // Calculate remaining days (inclusive of today)
            // If today is 30th and month ends 30th, remaining = 30 - 30 + 1 = 1 day.
            const remaining = Math.max(0, daysInMonth - today + 1);

            if (remaining < daysInMonth) {
                finalPrice = (baseAmount / daysInMonth) * remaining;
                info = { isProrated: true, daysRemaining: remaining };
            }
        }

        return {
            base: baseAmount,
            charged: parseFloat(finalPrice.toFixed(2)),
            info
        };
    };

    // Initialize/Reset
    useEffect(() => {
        if (isOpen && customer) {
            if (existingPayment) {
                // View Mode
            } else {
                // Create Mode - Default Tariff
                const defaultTariff = tariffs.find(t => t.id === customer.tariff_id);
                if (defaultTariff) {
                    setTariffId(defaultTariff.id);
                    const calculation = calculateAutoPrice(defaultTariff.id);
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
    }, [isOpen, customer, existingPayment, tariffs, month, year]);

    // Update price when tariff changes
    const handleTariffChange = (id) => {
        setTariffId(id);
        const calculation = calculateAutoPrice(id);

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
        setLoading(true);
        const tariff = tariffs.find(t => t.id === Number(tariffId));

        // Use UTC date to set to 1st of month correctly in DB
        const utcDate = new Date(Date.UTC(year, month, 1)).toISOString();

        const success = await addPayment({
            customer_id: customer.id,
            amount: parseFloat(price),
            tariff_name: tariff ? tariff.name : 'Custom',
            payment_date: utcDate
        });

        setLoading(false);
        if (success) onClose();
    };

    const handleRefund = async () => {
        if (!existingPayment) return;
        setLoading(true);
        const success = await deletePayment(customer.id, existingPayment.id);
        setLoading(false);
        if (success) onClose();
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

                            {/* Charge Price (Editable) */}
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-emerald-500 uppercase">Precio a Cobrar</label>
                                <div className="flex rounded-xl bg-slate-950/50 border border-white/10 focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500/20 transition-all overflow-hidden">
                                    <input
                                        type="number"
                                        className="w-full bg-transparent text-emerald-400 px-4 py-3 font-mono text-lg focus:outline-none placeholder:text-slate-600 font-bold"
                                        value={price}
                                        onChange={e => setPrice(e.target.value)}
                                        placeholder="0.00"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Proration Badge */}
                        {prorationInfo.isProrated && (
                            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-medium">
                                <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                                ℹ️ Prorrateado: quedan {prorationInfo.daysRemaining} días este mes.
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
