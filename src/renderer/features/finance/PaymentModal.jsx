import React, { useState, useEffect } from 'react';
import { X, Check, Trash2, CreditCard, Banknote, Calendar, Smartphone, Building2, MoreHorizontal, AlertTriangle, Zap } from 'lucide-react';
import { useGym } from '../../context/GymContext';
import { useLanguage } from '../../context/LanguageContext';
import { cn } from '../../lib/utils';

export default function PaymentModal({ isOpen, onClose, customer, month, year, existingPayment = null }) {
    const { tariffs, addPayment, deletePayment, getPaymentForMonth, loadPaymentsForCustomer } = useGym();
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

        // Si la tarifa es trimestral/semestral/anual:
        //   - amount_is_total=true  → importe = baseAmount (ya es el total)
        //   - amount_is_total=false → importe = baseAmount * months
        const months = selectedTariff.billing_months || 1;
        if (months > 1 && !isProratedInThisMonth) {
            finalPrice = selectedTariff.amount_is_total
                ? Math.round(baseAmount * 100) / 100
                : Math.round(baseAmount * months * 100) / 100;
            info.billingMonths = months;
            info.amountIsTotal = !!selectedTariff.amount_is_total;
            info.periodStart = new Date(targetYear, targetMonth - 1, 1);
            info.periodEnd = new Date(targetYear, targetMonth - 1 + months, 0);
        }

        return {
            base: baseAmount,
            charged: finalPrice,
            info
        };
    };

    const [paymentMethod, setPaymentMethod] = useState('Efectivo');
    const [fetchedJoinDate, setFetchedJoinDate] = useState(null);
    const [isFetchingHistory, setIsFetchingHistory] = useState(false); // Explicit loading state
    const [coveredMonths, setCoveredMonths] = useState([]); // [{key, year, month, amount, prorated, days, daysInMonth}]

    const PAYMENT_METHODS = [
        { value: 'Efectivo',      icon: Banknote,         color: 'emerald' },
        { value: 'Tarjeta',       icon: CreditCard,       color: 'blue' },
        { value: 'Stripe',        icon: Zap,              color: 'indigo' },
        { value: 'Transferencia', icon: Building2,        color: 'purple' },
        { value: 'Bizum',         icon: Smartphone,       color: 'cyan' },
        { value: 'Otro',          icon: MoreHorizontal,   color: 'slate' },
    ];

    // fetchedJoin guarda la membresía más reciente: {id, start_date, end_date}
    const [fetchedJoin, setFetchedJoin] = useState(null);

    const loadJoin = async () => {
        if (!customer || !customer.id) return;
        setIsFetchingHistory(true);
        try {
            const response = await window.api.customers.getHistory(customer.id);
            const history = response.data || response;
            if (Array.isArray(history) && history.length > 0) {
                const m = history[0];
                setFetchedJoin({ id: m.id, start_date: m.start_date, end_date: m.end_date || null });
                setFetchedJoinDate(m.start_date);
            } else {
                setFetchedJoin(null);
                setFetchedJoinDate(null);
            }
        } catch (err) {
            console.error('Failed to fetch fresh history for proration', err);
            setFetchedJoin(null);
            setFetchedJoinDate(null);
        } finally {
            setIsFetchingHistory(false);
        }
    };

    useEffect(() => {
        if (isOpen) {
            setPaymentMethod('Efectivo');
            loadJoin();
            // Cargar pagos del cliente para poder detectar solapes
            if (customer?.id && loadPaymentsForCustomer) {
                loadPaymentsForCustomer(customer.id);
            }
        }
    }, [isOpen, customer]);

    // Construye los meses cubiertos por un pago multi-mes con prorrateo del 1º si aplica
    const buildCoveredMonths = (tariff, joinDate) => {
        if (!tariff) return [];
        const months = tariff.billing_months || 1;
        if (months <= 1) return [];
        const monthlyAmount = tariff.amount_is_total
            ? (tariff.amount / months)
            : tariff.amount;

        let joinDay = 1, joinMonth = -1, joinYear = -1;
        if (joinDate) {
            const parts = joinDate.split(/[-T ]/);
            if (parts.length >= 3) {
                joinYear = parseInt(parts[0], 10);
                joinMonth = parseInt(parts[1], 10) - 1;
                joinDay = parseInt(parts[2], 10);
            }
        }

        const result = [];
        const expectedTotal = tariff.amount_is_total
            ? tariff.amount
            : tariff.amount * months;
        let cumulativeTotal = 0;
        for (let i = 0; i < months; i++) {
            const m = ((month + i) % 12 + 12) % 12;
            const y = year + Math.floor((month + i) / 12);
            const daysInMonth = new Date(y, m + 1, 0).getDate();
            let prorated = false;
            let amount = monthlyAmount;
            let days = daysInMonth;
            if (i === 0 && y === joinYear && m === joinMonth && joinDay > 1) {
                prorated = true;
                days = Math.max(1, daysInMonth - joinDay + 1);
                amount = monthlyAmount * (days / daysInMonth);
            }
            amount = Math.round(amount * 100) / 100;
            // El último mes asume el residuo de redondeo SI no está prorrateado (mes completo)
            // y los anteriores tampoco lo están — solo cuadrar cuando todos los meses son completos.
            if (i === months - 1 && !prorated && !result.some(r => r.prorated)) {
                const remaining = Math.round((expectedTotal - cumulativeTotal) * 100) / 100;
                amount = remaining;
            }
            cumulativeTotal += amount;
            result.push({
                key: `${y}-${String(m + 1).padStart(2, '0')}`,
                year: y,
                month: m,
                amount,
                prorated,
                days,
                daysInMonth,
                included: true,
            });
        }
        return result;
    };

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
                        setPrice(defaultTariff.amount.toString());
                        setTariffPrice(defaultTariff.amount.toString());
                        setProrationInfo({ isProrated: false, daysRemaining: 0 });
                    }
                    // Construir meses cubiertos para tarifas multi-mes
                    setCoveredMonths(buildCoveredMonths(defaultTariff, dateToUse));
                } else {
                    setTariffId('');
                    setPrice('0');
                    setTariffPrice('0');
                    setProrationInfo({ isProrated: false, daysRemaining: 0 });
                    setCoveredMonths([]);
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
            setPrice('0');
            setTariffPrice('0');
            setProrationInfo({ isProrated: false, daysRemaining: 0 });
        }
        const selectedTariff = tariffs.find(t => t.id === Number(id));
        setCoveredMonths(buildCoveredMonths(selectedTariff, dateToUse));
    };

    // Total recalculado a partir de meses cubiertos seleccionados
    const coveredTotal = coveredMonths
        .filter(m => m.included)
        .reduce((s, m) => s + m.amount, 0);

    // Sincroniza el precio total mostrado con los meses cubiertos (solo multi-mes)
    useEffect(() => {
        if (coveredMonths.length > 0) {
            setPrice(coveredTotal.toFixed(2));
        }
    }, [coveredTotal, coveredMonths.length]);

    const toggleMonth = (key) => {
        setCoveredMonths(prev => prev.map(m => m.key === key ? { ...m, included: !m.included } : m));
    };

    // Estado para confirmación de quitar prorrateo
    const [pendingProrationFix, setPendingProrationFix] = useState(null); // { proratedMonth, newStart }
    // Estado para conflicto de solape (pago multi-mes que pisa otros pagos existentes)
    const [overlapConflict, setOverlapConflict] = useState(null); // { months: [{year, month, existingAmount}] }

    const requestRemoveProration = (proratedMonth) => {
        const newStart = `${proratedMonth.year}-${String(proratedMonth.month + 1).padStart(2, '0')}-01`;
        setPendingProrationFix({ proratedMonth, newStart });
    };

    const confirmRemoveProration = async () => {
        if (!pendingProrationFix || !fetchedJoin?.id) {
            setPendingProrationFix(null);
            return;
        }
        const { newStart } = pendingProrationFix;
        try {
            await window.api.memberships.update(fetchedJoin.id, {
                start_date: newStart,
                end_date: fetchedJoin.end_date || '',
            });
            await loadJoin();
            const tariff = tariffs.find(t => t.id === Number(tariffId));
            if (tariff) setCoveredMonths(buildCoveredMonths(tariff, newStart));
        } catch (err) {
            console.error('Error actualizando fecha de alta:', err);
        } finally {
            setPendingProrationFix(null);
        }
    };

    // Detectar si el mes seleccionado es anterior al alta del cliente
    const isBeforeMembership = (() => {
        if (!fetchedJoinDate) return false;
        const parts = fetchedJoinDate.split(/[-T ]/);
        if (parts.length < 3) return false;
        const jy = parseInt(parts[0], 10);
        const jm = parseInt(parts[1], 10) - 1; // 0-indexed
        // Comparamos: ¿el último día del mes seleccionado es anterior al alta?
        return year < jy || (year === jy && month < jm);
    })();

    const [showConfirmBeforeJoin, setShowConfirmBeforeJoin] = useState(false);

    const doRegisterPayment = async () => {
        setShowConfirmBeforeJoin(false);
        const tariff = tariffs.find(t => t.id === Number(tariffId));
        const tariffName = tariff ? tariff.name : 'Custom';
        const monthsIncluded = coveredMonths.filter(m => m.included);

        // Check de solape: si algún mes ya tiene un pago, bloquear
        if (monthsIncluded.length > 0 && getPaymentForMonth) {
            const conflicts = monthsIncluded.map(m => {
                const existing = getPaymentForMonth(customer.id, m.month, m.year);
                return existing ? { ...m, existingAmount: existing.amount, existingGroupId: existing.payment_group_id } : null;
            }).filter(Boolean);
            if (conflicts.length > 0) {
                setOverlapConflict({ months: conflicts });
                return;
            }
        }

        setLoading(true);
        try {
            if (monthsIncluded.length > 0) {
                // Tarifa multi-mes:
                //   - El mes ACTUAL del modal recibe el TOTAL.
                //   - Los demás meses incluidos se registran como 0€ (cobertura).
                //   - Todos comparten payment_group_id → anular uno = anular todos.
                const total = monthsIncluded.reduce((s, m) => s + m.amount, 0);
                const totalRounded = Math.round(total * 100) / 100;
                const groupId = `grp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

                let activeIdx = monthsIncluded.findIndex(m => m.year === year && m.month === month);
                if (activeIdx < 0) activeIdx = 0;

                let allOk = true;
                for (let i = 0; i < monthsIncluded.length; i++) {
                    const m = monthsIncluded[i];
                    const utc = new Date(Date.UTC(m.year, m.month, 1)).toISOString();
                    const amount = i === activeIdx ? totalRounded : 0;
                    const ok = await addPayment({
                        customer_id: customer.id,
                        amount,
                        tariff_name: tariffName,
                        payment_date: utc,
                        payment_method: paymentMethod,
                        payment_group_id: groupId,
                    });
                    if (!ok) { allOk = false; break; }
                }
                if (allOk) onClose();
            } else {
                // Tarifa mensual: un único pago
                const utcDate = new Date(Date.UTC(year, month, 1)).toISOString();
                const success = await addPayment({
                    customer_id: customer.id,
                    amount: parseFloat(price),
                    tariff_name: tariffName,
                    payment_date: utcDate,
                    payment_method: paymentMethod,
                });
                if (success) onClose();
            }
        } finally {
            setLoading(false);
        }
    };

    const handlePay = async () => {
        if (loading) return;
        if (isBeforeMembership) {
            setShowConfirmBeforeJoin(true);
            return;
        }
        await doRegisterPayment();
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

            <div className="relative w-full max-w-lg bg-slate-900 border border-white/10 rounded-2xl shadow-2xl p-6 transform transition-all animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
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
                        <div className={cn(
                            "p-4 border rounded-xl text-center",
                            existingPayment.payment_group_id
                                ? "bg-purple-500/10 border-purple-500/30"
                                : "bg-emerald-500/10 border-emerald-500/20"
                        )}>
                            <p className={cn(
                                "text-xs uppercase font-bold tracking-wider mb-1",
                                existingPayment.payment_group_id ? "text-purple-300" : "text-emerald-400"
                            )}>
                                {existingPayment.payment_group_id
                                    ? (existingPayment.amount > 0 ? 'Pago multi-mes' : 'Cubierto por pago multi-mes')
                                    : 'Pagado'}
                            </p>
                            <p className={cn(
                                "text-3xl font-mono font-bold",
                                existingPayment.payment_group_id ? "text-purple-200" : "text-emerald-300"
                            )}>
                                {existingPayment.amount}€
                            </p>
                            <p className="text-xs text-white/60 mt-2">
                                {existingPayment.tariff_name || 'Sin Tarifa'}
                            </p>
                            {existingPayment.payment_method && (
                                <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs text-slate-300 font-medium">
                                    {(() => {
                                        const m = PAYMENT_METHODS.find(p => p.value === existingPayment.payment_method);
                                        const Icon = m?.icon || Banknote;
                                        return <><Icon size={12} /> {existingPayment.payment_method}</>;
                                    })()}
                                </div>
                            )}
                        </div>

                        {existingPayment.payment_group_id && (
                            <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs">
                                <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
                                <span>
                                    Este pago forma parte de un <b>cobro multi-mes</b>. Al anular se eliminarán <b>todos los meses del grupo</b>.
                                </span>
                            </div>
                        )}

                        <button
                            onClick={handleRefund}
                            disabled={loading}
                            className="w-full py-3 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 hover:text-red-300 font-medium transition-all flex items-center justify-center gap-2"
                        >
                            {loading ? 'Procesando...' : (
                                <>
                                    <Trash2 size={18} />
                                    {existingPayment.payment_group_id ? 'Anular grupo completo' : 'Anular pago / Reembolsar'}
                                </>
                            )}
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

                        {/* Payment Method Selector */}
                        <div className="space-y-2">
                            <label className="text-xs font-medium text-slate-500 uppercase">Método de pago</label>
                            <div className="grid grid-cols-5 gap-1.5">
                                {PAYMENT_METHODS.map(m => {
                                    const Icon = m.icon;
                                    const selected = paymentMethod === m.value;
                                    const colorMap = {
                                        emerald: 'border-emerald-500 bg-emerald-500/10 text-emerald-300',
                                        blue:    'border-blue-500 bg-blue-500/10 text-blue-300',
                                        purple:  'border-purple-500 bg-purple-500/10 text-purple-300',
                                        cyan:    'border-cyan-500 bg-cyan-500/10 text-cyan-300',
                                        slate:   'border-slate-400 bg-slate-400/10 text-slate-300',
                                    };
                                    return (
                                        <button
                                            type="button"
                                            key={m.value}
                                            onClick={() => setPaymentMethod(m.value)}
                                            className={cn(
                                                'flex flex-col items-center justify-center gap-1 py-2 rounded-xl border transition-all',
                                                selected
                                                    ? colorMap[m.color]
                                                    : 'border-white/5 bg-slate-950/30 text-slate-500 hover:text-slate-300 hover:bg-slate-800/40'
                                            )}
                                            title={m.value}
                                        >
                                            <Icon size={16} />
                                            <span className="text-[10px] font-medium leading-none">{m.value}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Aviso si el mes es anterior al alta del cliente */}
                        {isBeforeMembership && (
                            <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs">
                                <span className="text-base leading-none">⚠️</span>
                                <span>
                                    <b>Aviso</b>: el cliente no estaba de alta en este mes
                                    (alta: {new Date(fetchedJoinDate).toLocaleDateString('es-ES')}).
                                    Pedirá confirmación al registrar.
                                </span>
                            </div>
                        )}

                        {/* Proration Badge */}
                        {prorationInfo.isProrated && (
                            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-medium">
                                <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                                <span>
                                    ℹ️ Prorrateado: Alta el <b>{prorationInfo.fromDate}</b> ({prorationInfo.daysRemaining} días).
                                </span>
                            </div>
                        )}

                        {/* Selector de meses cubiertos (tarifa multi-mes) */}
                        {coveredMonths.length > 0 && (
                            <div className="space-y-2 px-3 py-2 rounded-xl bg-purple-500/5 border border-purple-500/20">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold uppercase tracking-wider text-purple-300">
                                        Meses que cubre el pago
                                    </span>
                                    <span className="text-xs text-purple-200 font-mono">
                                        {coveredMonths.filter(m => m.included).length} {coveredMonths.filter(m => m.included).length === 1 ? 'mes' : 'meses'}
                                    </span>
                                </div>
                                <div className="space-y-1">
                                    {coveredMonths.map(m => {
                                        const label = new Date(m.year, m.month).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
                                        return (
                                            <label
                                                key={m.key}
                                                className={cn(
                                                    "flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-all border",
                                                    m.included
                                                        ? "bg-purple-500/15 border-purple-500/40 hover:bg-purple-500/20"
                                                        : "bg-slate-900/40 border-white/5 hover:bg-slate-800/40 opacity-60"
                                                )}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={m.included}
                                                    onChange={() => toggleMonth(m.key)}
                                                    className="w-4 h-4 rounded border-slate-600 bg-slate-900 text-purple-500 focus:ring-purple-500"
                                                />
                                                <span className="text-sm text-white font-medium capitalize flex-1">{label}</span>
                                                {m.prorated && (
                                                    <>
                                                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-bold uppercase tracking-wider">
                                                            Prorrateado {m.days}/{m.daysInMonth}d
                                                        </span>
                                                        <button
                                                            type="button"
                                                            onClick={(e) => { e.preventDefault(); requestRemoveProration(m); }}
                                                            className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-600 hover:bg-cyan-500 text-white font-bold uppercase tracking-wider transition-colors"
                                                            title={`Cambiar la fecha de alta a 01/${String(m.month + 1).padStart(2, '0')}/${m.year} para cobrar mes completo`}
                                                        >
                                                            Quitar prorrateo
                                                        </button>
                                                    </>
                                                )}
                                            </label>
                                        );
                                    })}
                                </div>
                                <p className="text-[10px] text-slate-500 mt-1">
                                    El cobro total ({coveredTotal.toFixed(2)}€) se registra en el mes actual; los demás meses quedan cubiertos sin importe.
                                </p>
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

            {/* Confirmación: pago antes del alta */}
            {showConfirmBeforeJoin && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-md" onClick={() => setShowConfirmBeforeJoin(false)} />
                    <div className="relative w-full max-w-sm bg-slate-900 border border-amber-500/40 rounded-2xl shadow-2xl p-6 animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex flex-col items-center text-center">
                            <div className="w-14 h-14 rounded-full bg-amber-500/15 flex items-center justify-center mb-4">
                                <AlertTriangle className="text-amber-400" size={28} />
                            </div>
                            <h3 className="text-lg font-bold text-white mb-2">Pago antes del alta</h3>
                            <p className="text-sm text-slate-400 leading-relaxed mb-1">
                                El cliente <span className="text-white font-semibold">{customer.first_name} {customer.last_name}</span> no estaba dado de alta en <span className="text-amber-300 font-semibold">{title}</span>.
                            </p>
                            <p className="text-xs text-slate-500 mb-5">
                                Alta del cliente: <b>{fetchedJoinDate ? new Date(fetchedJoinDate).toLocaleDateString('es-ES') : '—'}</b>
                            </p>
                            <div className="w-full flex flex-col gap-2">
                                <button
                                    onClick={doRegisterPayment}
                                    disabled={loading}
                                    className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                                >
                                    {loading ? 'Registrando…' : 'Registrar de todas formas'}
                                </button>
                                <button
                                    onClick={() => setShowConfirmBeforeJoin(false)}
                                    disabled={loading}
                                    className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-medium transition-all"
                                >
                                    Cancelar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Conflicto de solape: bloquear pago */}
            {overlapConflict && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-md" onClick={() => setOverlapConflict(null)} />
                    <div className="relative w-full max-w-md bg-slate-900 border border-red-500/40 rounded-2xl shadow-2xl p-6 animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex flex-col items-center text-center">
                            <div className="w-14 h-14 rounded-full bg-red-500/15 flex items-center justify-center mb-4">
                                <AlertTriangle className="text-red-400" size={28} />
                            </div>
                            <h3 className="text-lg font-bold text-white mb-2">Pago bloqueado</h3>
                            <p className="text-sm text-slate-400 leading-relaxed mb-3">
                                No se puede registrar este pago multi-mes porque solapa con pagos ya existentes en los siguientes meses:
                            </p>
                            <div className="w-full bg-slate-950/40 border border-red-500/20 rounded-xl p-3 mb-4 max-h-48 overflow-y-auto space-y-1">
                                {overlapConflict.months.map(m => {
                                    const label = new Date(m.year, m.month).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
                                    return (
                                        <div key={m.key} className="flex items-center justify-between text-xs">
                                            <span className="text-slate-300 capitalize">{label}</span>
                                            <span className="text-red-300 font-mono">
                                                {m.existingGroupId ? '🔗 Grupo multi-mes' : `${Number(m.existingAmount).toFixed(2)}€ ya pagado`}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                            <p className="text-xs text-slate-500 mb-5">
                                Para registrar este pago debes anular primero los pagos existentes que solapan, o desmarcar esos meses en el selector.
                            </p>
                            <button
                                onClick={() => setOverlapConflict(null)}
                                className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-medium transition-all"
                            >
                                Entendido
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Confirmación: quitar prorrateo (cambia fecha de alta) */}
            {pendingProrationFix && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-md" onClick={() => setPendingProrationFix(null)} />
                    <div className="relative w-full max-w-sm bg-slate-900 border border-cyan-500/40 rounded-2xl shadow-2xl p-6 animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex flex-col items-center text-center">
                            <div className="w-14 h-14 rounded-full bg-cyan-500/15 flex items-center justify-center mb-4">
                                <Calendar className="text-cyan-400" size={28} />
                            </div>
                            <h3 className="text-lg font-bold text-white mb-2">Cambiar fecha de alta</h3>
                            <p className="text-sm text-slate-400 leading-relaxed mb-1">
                                Para cobrar el mes completo, la fecha de alta de <span className="text-white font-semibold">{customer.first_name} {customer.last_name}</span> pasará a:
                            </p>
                            <p className="text-cyan-300 font-bold text-lg my-3">
                                {(() => {
                                    const d = new Date(pendingProrationFix.proratedMonth.year, pendingProrationFix.proratedMonth.month, 1);
                                    return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' });
                                })()}
                            </p>
                            <p className="text-xs text-slate-500 mb-5">
                                Esta acción modifica el historial de membresía. Confirma si es correcto.
                            </p>
                            <div className="w-full flex flex-col gap-2">
                                <button
                                    onClick={confirmRemoveProration}
                                    className="w-full py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold transition-all flex items-center justify-center gap-2"
                                >
                                    <Check size={16} /> Sí, cambiar fecha
                                </button>
                                <button
                                    onClick={() => setPendingProrationFix(null)}
                                    className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-medium transition-all"
                                >
                                    Cancelar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
