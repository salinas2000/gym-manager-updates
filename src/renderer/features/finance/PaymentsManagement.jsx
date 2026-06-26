import React, { useState, useEffect } from 'react';
import { normalizeText, textIncludes } from '../../lib/text';
import { useGym } from '../../context/GymContext';
import {
    CreditCard,
    Search,
    Filter,
    ChevronLeft,
    ChevronRight,
    CheckCircle2,
    AlertCircle,
    Calendar,
    User,
    TrendingUp,
    AlertTriangle,
    Download,
    RotateCcw
} from 'lucide-react';
import { Card, Title, Text, TabGroup, TabList, Tab, TabPanels, TabPanel, Badge, Button, TextInput } from '@tremor/react';
import PaymentModal from './PaymentModal';
import ConfirmationModal from '../../components/ui/ConfirmationModal';
import { useLanguage } from '../../context/LanguageContext';

export default function PaymentsManagement() {
    const { getMonthlyReport, getDebtors, addPayment, getPaymentForMonth, customers, loadPaymentsForCustomer, deletePayment } = useGym();
    const { t } = useLanguage();

    // State
    const [activeTab, setActiveTab] = useState(0);
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [monthlyData, setMonthlyData] = useState([]);
    const [debtors, setDebtors] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('all'); // all, paid, unpaid
    const [filterMethod, setFilterMethod] = useState('all'); // all, Efectivo, Tarjeta, ...
    const [multiMonthData, setMultiMonthData] = useState([]);
    const [filterTariff, setFilterTariff] = useState('all'); // all, "Básica", "VIP", ...

    // Filtros del panel Multi-mes
    const [multiSearch, setMultiSearch] = useState('');
    const [multiStatusFilter, setMultiStatusFilter] = useState('all'); // all | vigente | expirado
    const [multiSort, setMultiSort] = useState('recent'); // recent | name | endDate

    // Modal State
    const [modalOpen, setModalOpen] = useState(false);
    const [selectedCustomer, setSelectedCustomer] = useState(null);

    // Confirmation Modal State
    const [confirmModal, setConfirmModal] = useState({
        isOpen: false,
        title: '',
        message: '',
        type: 'info',
        onConfirm: () => { }
    });

    const year = selectedDate.getFullYear();
    const month = selectedDate.getMonth() + 1;

    const fetchData = async () => {
        setLoading(true);
        try {
            const [reportRes, debtorsRes, multiRes] = await Promise.all([
                getMonthlyReport(year, month),
                getDebtors(),
                window.api?.payments?.getMultiMonth?.() ?? Promise.resolve({ success: true, data: [] })
            ]);

            if (reportRes.success) setMonthlyData(reportRes.data);
            if (debtorsRes.success) setDebtors(debtorsRes.data);
            if (multiRes?.success) setMultiMonthData(multiRes.data);
        } catch (e) {
            console.error('Error fetching payments data:', e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [selectedDate]);

    // Refrescar también al cambiar de tab (especialmente útil al volver a Multi-mes
    // tras hacer un pago desde el panel del cliente).
    useEffect(() => {
        fetchData();
    }, [activeTab]);

    const handlePrevMonth = () => {
        const newDate = new Date(selectedDate);
        newDate.setMonth(newDate.getMonth() - 1);
        setSelectedDate(newDate);
    };

    const handleNextMonth = () => {
        const newDate = new Date(selectedDate);
        newDate.setMonth(newDate.getMonth() + 1);
        setSelectedDate(newDate);
    };

    const handleOpenModal = async (item) => {
        // Find full customer object from GymContext to pass to modal
        const fullCustomer = customers.find(c => c.id === item.id);
        if (fullCustomer) {
            await loadPaymentsForCustomer(fullCustomer.id);
            setSelectedCustomer(fullCustomer);
            setModalOpen(true);
        }
    };

    const handleQuickPay = async (customer) => {
        handleOpenModal(customer);
    };

    const handleRefundDirect = async (item) => {
        if (!item.payment_id) {
            setConfirmModal({
                isOpen: true,
                title: 'Error de Datos',
                message: 'No se puede anular: No se encontró el registro del pago para este mes.',
                type: 'danger',
                showCancel: false,
                onConfirm: () => { }
            });
            return;
        }

        // Si es multi-mes, obtenemos los pagos del grupo para mostrar al usuario
        // exactamente qué meses se borrarán antes de confirmar.
        let groupPayments = [];
        if (item.payment_group_id && window.api?.payments?.getGroup) {
            try {
                const res = await window.api.payments.getGroup(item.payment_group_id);
                groupPayments = (res?.data || res || []).filter(Boolean);
            } catch (err) {
                console.error('No se pudo cargar el grupo:', err);
            }
        }

        const isGroup = groupPayments.length > 1;
        const totalGroup = groupPayments.reduce((s, p) => s + (p.amount || 0), 0);

        const messageNode = isGroup ? (
            <div className="space-y-3 text-left">
                <p>
                    Se anulará el <span className="font-bold text-white">pago multi-mes</span> de{' '}
                    <span className="font-bold text-white">{item.first_name} {item.last_name}</span>.
                </p>
                <div className="bg-slate-900/50 border border-red-500/20 rounded-lg p-3">
                    <div className="text-[10px] uppercase tracking-wider text-red-400 font-bold mb-2">
                        Se borrarán {groupPayments.length} pagos · Total {totalGroup.toFixed(2)}€
                    </div>
                    <ul className="space-y-1 max-h-40 overflow-y-auto pr-1">
                        {groupPayments.map(p => {
                            const d = p.payment_date ? new Date(p.payment_date) : null;
                            const monthLabel = d
                                ? d.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })
                                : '—';
                            return (
                                <li key={p.id} className="flex items-center justify-between gap-3 text-xs">
                                    <span className="capitalize text-slate-300">{monthLabel}</span>
                                    <span className={`font-mono font-semibold ${p.amount > 0 ? 'text-emerald-300' : 'text-slate-500 italic'}`}>
                                        {p.amount > 0 ? `${p.amount.toFixed(2)}€` : '0€ (cobertura)'}
                                    </span>
                                </li>
                            );
                        })}
                    </ul>
                </div>
                <p className="text-[11px] text-slate-500 italic">
                    Esta acción no se puede deshacer. Todos los meses del grupo (incluidas las coberturas de 0€) serán eliminados.
                </p>
            </div>
        ) : (
            <p>
                ¿Anular el pago de <span className="font-bold text-white">{item.paid_amount}€</span> de{' '}
                <span className="font-bold text-white">{item.first_name} {item.last_name}</span>?
                <span className="block mt-2 text-[11px] text-slate-500 italic">Esta acción no se puede deshacer.</span>
            </p>
        );

        setConfirmModal({
            isOpen: true,
            title: isGroup ? 'Anular pago multi-mes' : 'Anular Pago',
            message: messageNode,
            type: 'danger',
            confirmText: isGroup ? `Anular grupo (${groupPayments.length} meses)` : 'Anular Pago',
            showCancel: true,
            onConfirm: async () => {
                try {
                    const success = await deletePayment(item.id, item.payment_id);
                    if (success) {
                        fetchData();
                    }
                } catch (err) {
                    console.error('Refund error:', err);
                }
            }
        });
    };

    const [exporting, setExporting] = useState(false);
    const handleExport = async (scope) => {
        if (!window.api?.payments?.exportExcel) return;
        setExporting(true);
        try {
            const options = scope === 'month'
                ? { year: selectedDate.getFullYear(), month: selectedDate.getMonth() + 1 }
                : scope === 'year'
                    ? { year: selectedDate.getFullYear() }
                    : {};
            const res = await window.api.payments.exportExcel(options);
            if (res?.cancelled) return;
            if (res?.success) {
                setConfirmModal({
                    isOpen: true,
                    title: 'Exportación completada',
                    message: `Se exportaron ${res.count} pagos (total ${res.total.toFixed(2)}€) a:\n${res.filePath}`,
                    type: 'info',
                    showCancel: false,
                    confirmText: 'OK',
                    onConfirm: () => {}
                });
            } else {
                setConfirmModal({
                    isOpen: true,
                    title: 'Error',
                    message: res?.error || 'No se pudo exportar.',
                    type: 'danger',
                    showCancel: false,
                    confirmText: 'OK',
                    onConfirm: () => {}
                });
            }
        } catch (e) {
            console.error('Export error:', e);
        } finally {
            setExporting(false);
        }
    };

    const filteredReport = monthlyData.filter(item => {
        const matchesSearch = textIncludes(`${item.first_name} ${item.last_name}`, searchTerm);
        const matchesStatus = filterStatus === 'all'
            || (filterStatus === 'paid' && item.is_paid)
            || (filterStatus === 'unpaid' && !item.is_paid);
        const matchesMethod = filterMethod === 'all'
            || (item.payment_method === filterMethod);

        return matchesSearch && matchesStatus && matchesMethod;
    });

    // Resumen por método: cuenta el dinero REAL recibido este mes (revenue_this_month)
    const methodStats = monthlyData.reduce((acc, item) => {
        if (item.payment_id && item.payment_method && (item.revenue_this_month || 0) > 0) {
            acc[item.payment_method] = (acc[item.payment_method] || 0) + (item.revenue_this_month || 0);
        }
        return acc;
    }, {});

    const stats = {
        total: monthlyData.length,
        paid: monthlyData.filter(i => i.is_paid).length,
        unpaid: monthlyData.filter(i => !i.is_paid).length,
        // Ingresos del mes = dinero realmente recibido este mes (no acumulado del periodo)
        revenue: monthlyData.reduce((acc, curr) => acc + (curr.revenue_this_month || 0), 0),
        pending: monthlyData.reduce((acc, curr) => acc + curr.debt, 0)
    };

    return (
        <div className="space-y-6 pb-20">
            {/* Header / Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card decoration="top" decorationColor="blue" className="bg-slate-900/50 border-white/5">
                    <Text className="text-slate-400">{t('finance.revenue')}</Text>
                    <Title className="text-white text-3xl font-bold">{stats.revenue.toLocaleString()}€</Title>
                    <Badge color="emerald" icon={TrendingUp} className="mt-2">Realizado</Badge>
                </Card>
                <Card decoration="top" decorationColor="amber" className="bg-slate-900/50 border-white/5">
                    <Text className="text-slate-400">{t('finance.pending')}</Text>
                    <Title className="text-white text-3xl font-bold">{stats.pending.toLocaleString()}€</Title>
                    <Badge color="amber" icon={AlertCircle} className="mt-2">Por recibir</Badge>
                </Card>
                <Card decoration="top" decorationColor="emerald" className="bg-slate-900/50 border-white/5">
                    <Text className="text-slate-400">{t('finance.paidCount')}</Text>
                    <Title className="text-white text-3xl font-bold">{stats.paid} / {stats.total}</Title>
                    <div className="w-full bg-slate-800 h-1.5 rounded-full mt-4">
                        <div
                            className="bg-emerald-500 h-1.5 rounded-full transition-all duration-1000"
                            style={{ width: `${(stats.paid / stats.total) * 100 || 0}%` }}
                        ></div>
                    </div>
                </Card>
                <Card decoration="top" decorationColor="red" className="bg-slate-900/50 border-white/5">
                    <Text className="text-slate-400">{t('finance.globalDebtors')}</Text>
                    <Title className="text-white text-3xl font-bold">{debtors.length}</Title>
                    <Badge color="red" icon={AlertTriangle} className="mt-2">Atención requerida</Badge>
                </Card>
            </div>

            <TabGroup index={activeTab} onIndexChange={setActiveTab}>
                <div className="flex items-center justify-between mb-4">
                    <TabList className="bg-slate-900/50 p-1 rounded-xl border border-white/5 h-12">
                        <Tab className="text-sm font-bold min-w-[140px] ui-selected:bg-blue-600 ui-selected:text-white transition-all rounded-lg">{t('finance.monthly')}</Tab>
                        <Tab className="text-sm font-bold min-w-[140px] ui-selected:bg-red-600 ui-selected:text-white transition-all rounded-lg text-red-400">{t('finance.debtors')}</Tab>
                        <Tab className="text-sm font-bold min-w-[140px] ui-selected:bg-purple-600 ui-selected:text-white transition-all rounded-lg text-purple-400">Multi-mes ({multiMonthData.length})</Tab>
                    </TabList>

                    {activeTab === 0 && (
                        <div className="flex items-center gap-4 bg-slate-900/50 px-4 py-2 rounded-xl border border-white/5">
                            <button onClick={handlePrevMonth} className="p-1 hover:bg-slate-800 rounded-lg transition-colors text-slate-400 hover:text-white">
                                <ChevronLeft size={20} />
                            </button>
                            <div className="flex items-center gap-2 min-w-[120px] justify-center">
                                <Calendar size={16} className="text-blue-400" />
                                <span className="font-bold text-white capitalize">
                                    {selectedDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}
                                </span>
                            </div>
                            <button onClick={handleNextMonth} className="p-1 hover:bg-slate-800 rounded-lg transition-colors text-slate-400 hover:text-white">
                                <ChevronRight size={20} />
                            </button>
                        </div>
                    )}
                </div>

                <TabPanels>
                    {/* MONTHLY PANEL */}
                    <TabPanel>
                        <div className="space-y-4">
                            {/* Toolbar */}
                            <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                                <div className="relative w-full md:w-96 group">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <Search size={18} className="text-slate-500 group-focus-within:text-blue-500 transition-colors" />
                                    </div>
                                    <input
                                        type="text"
                                        placeholder={t('finance.searchPlaceholder')}
                                        className="w-full bg-slate-900/50 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                    />
                                </div>

                                <div className="flex flex-wrap items-center gap-2">
                                    <Filter size={18} className="text-slate-500 mr-2" />
                                    {['all', 'paid', 'unpaid'].map((status) => (
                                        <button
                                            key={status}
                                            onClick={() => setFilterStatus(status)}
                                            className={`
                                                px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all
                                                ${filterStatus === status
                                                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20'
                                                    : 'bg-slate-900/50 text-slate-400 border border-white/5 hover:bg-slate-800'}
                                            `}
                                        >
                                            {status === 'all' ? 'Todos' : status === 'paid' ? 'Pagados' : 'Pendientes'}
                                        </button>
                                    ))}

                                    <div className="w-px h-6 bg-white/10 mx-1" />

                                    <button
                                        onClick={() => handleExport('month')}
                                        disabled={exporting}
                                        className="px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wider bg-emerald-600/90 hover:bg-emerald-500 text-white transition-all flex items-center gap-1.5 shadow-lg shadow-emerald-900/20 disabled:opacity-50"
                                        title="Exportar a Excel los pagos del mes seleccionado"
                                    >
                                        <Download size={14} />
                                        Mes
                                    </button>
                                    <button
                                        onClick={() => handleExport('year')}
                                        disabled={exporting}
                                        className="px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wider bg-slate-800 hover:bg-slate-700 text-slate-200 border border-white/5 transition-all flex items-center gap-1.5 disabled:opacity-50"
                                        title="Exportar a Excel todos los pagos del año seleccionado"
                                    >
                                        <Download size={14} />
                                        Año
                                    </button>
                                    <button
                                        onClick={() => handleExport('all')}
                                        disabled={exporting}
                                        className="px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wider bg-slate-800 hover:bg-slate-700 text-slate-200 border border-white/5 transition-all flex items-center gap-1.5 disabled:opacity-50"
                                        title="Exportar a Excel todos los pagos históricos"
                                    >
                                        <Download size={14} />
                                        Todo
                                    </button>
                                </div>
                            </div>

                            {/* Filtro por método de pago */}
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="text-xs text-slate-500 uppercase tracking-wider mr-1">Método:</span>
                                {['all', 'Efectivo', 'Tarjeta', 'Stripe', 'Transferencia', 'Bizum', 'Otro'].map((m) => {
                                    const count = m === 'all' ? null : (methodStats[m] || 0);
                                    return (
                                        <button
                                            key={m}
                                            onClick={() => setFilterMethod(m)}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 ${
                                                filterMethod === m
                                                    ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/20'
                                                    : 'bg-slate-900/50 text-slate-400 border border-white/5 hover:bg-slate-800'
                                            }`}
                                        >
                                            <span>{m === 'all' ? 'Todos' : m}</span>
                                            {count != null && count > 0 && (
                                                <span className="text-[10px] opacity-70">({count.toFixed(0)}€)</span>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Table */}
                            <div className="overflow-hidden rounded-2xl border border-white/5 bg-slate-900/30 backdrop-blur-sm">
                                <table className="w-full text-left">
                                    <thead className="bg-slate-950/50 text-slate-400 text-xs font-bold uppercase tracking-widest border-b border-white/5">
                                        <tr>
                                            <th className="px-6 py-4">{t('customers.columns.member')}</th>
                                            <th className="px-6 py-4">{t('customers.columns.membership')}</th>
                                            <th className="px-6 py-4">{t('customers.columns.status')}</th>
                                            <th className="px-6 py-4 text-right">{t('customers.columns.actions')}</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {filteredReport.length > 0 ? filteredReport.map((item) => (
                                            <tr key={item.id} className="hover:bg-white/5 transition-colors group">
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center border border-white/5 text-slate-400 group-hover:text-blue-400 transition-colors">
                                                            <User size={20} />
                                                        </div>
                                                        <div>
                                                            <div className="text-sm font-bold text-white">{item.first_name} {item.last_name}</div>
                                                            <div className="text-[10px] text-slate-500 uppercase tracking-tighter">
                                                                Ult. Pago: {item.last_payment_date ? new Date(item.last_payment_date).toLocaleDateString() : 'Nunca'}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    {/* Si hay un pago > 0 mostramos la tarifa SNAPSHOTEADA con la que se cobró.
                                                        Si no hay pago, mostramos el plan actual (lo que se cobrará en el futuro). */}
                                                    {(() => {
                                                        const months = item.billing_months || 1;
                                                        const billingLabel = months === 1 ? 'Mensual'
                                                            : months === 3 ? 'Trimestral'
                                                            : months === 6 ? 'Semestral'
                                                            : months === 12 ? 'Anual'
                                                            : `${months} meses`;
                                                        const billingColor = months === 1 ? 'text-slate-500 border-slate-600/40 bg-slate-600/10'
                                                            : months === 3 ? 'text-purple-300 border-purple-500/40 bg-purple-500/10'
                                                            : months === 6 ? 'text-pink-300 border-pink-500/40 bg-pink-500/10'
                                                            : 'text-amber-300 border-amber-500/40 bg-amber-500/10';
                                                        return (
                                                            <>
                                                                {item.paid_amount > 0 && item.paid_tariff_name ? (
                                                                    <>
                                                                        <div className="text-sm font-medium text-slate-300">{item.paid_tariff_name}</div>
                                                                        <div className="text-xs text-emerald-400 font-bold">{item.paid_amount}€</div>
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <div className="text-sm font-medium text-slate-300">{item.tariff_name || 'Sin Plan'}</div>
                                                                        <div className="text-xs text-blue-400 font-bold">{item.tariff_amount}€</div>
                                                                    </>
                                                                )}
                                                                {item.tariff_name && (
                                                                    <span className={`mt-1 inline-block text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${billingColor}`}>
                                                                        {billingLabel}
                                                                    </span>
                                                                )}
                                                            </>
                                                        );
                                                    })()}
                                                </td>
                                                <td className="px-6 py-4">
                                                    {item.is_paid ? (() => {
                                                        // Detectar si la cobertura viene de otro mes (multi-mes)
                                                        const realDate = item.real_payment_date ? new Date(item.real_payment_date) : null;
                                                        const realMonth = realDate ? realDate.getMonth() : null;
                                                        const realYear = realDate ? realDate.getFullYear() : null;
                                                        const currentMonth = month - 1; // month es 1-12 aquí
                                                        const isThisMonth = realDate && realYear === year && realMonth === currentMonth;
                                                        const monthLabel = realDate
                                                            ? realDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })
                                                            : null;
                                                        return (
                                                            <div className="flex flex-col gap-1">
                                                                <Badge color="emerald" icon={CheckCircle2} size="xs" className="px-2 py-0.5 font-bold uppercase">
                                                                    {isThisMonth || !realDate ? 'Pagado' : 'Cubierto'}
                                                                </Badge>
                                                                {realDate && !isThisMonth && (
                                                                    <span className="text-[10px] text-slate-500 italic capitalize">
                                                                        Pago real: {monthLabel}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        );
                                                    })() : (
                                                        <div className="flex flex-col gap-1">
                                                            <Badge color="red" icon={AlertCircle} size="xs" className="px-2 py-0.5 font-bold uppercase">Debe {item.debt}€</Badge>
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    {!item.is_paid ? (
                                                        <button
                                                            onClick={() => handleQuickPay(item)}
                                                            className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-lg shadow-emerald-900/20 active:scale-95"
                                                        >
                                                            {t('finance.registerPayment')}
                                                        </button>
                                                    ) : (
                                                        <div className="flex items-center justify-end gap-3">
                                                            <div className="text-emerald-500 font-medium text-xs flex items-center gap-1">
                                                                Completo <CheckCircle2 size={12} />
                                                            </div>
                                                            <button
                                                                onClick={() => handleRefundDirect(item)}
                                                                className="text-slate-500 hover:text-red-400 p-1.5 hover:bg-red-500/10 rounded-lg transition-all"
                                                                title="Devolver / Anular Pago"
                                                            >
                                                                <RotateCcw size={14} />
                                                            </button>
                                                        </div>
                                                    )}
                                                </td>
                                            </tr>
                                        )) : (
                                            <tr>
                                                <td colSpan="4" className="px-6 py-12 text-center text-slate-500 text-sm italic">
                                                    No se encontraron registros para este periodo.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </TabPanel>

                    {/* DEBTORS PANEL */}
                    <TabPanel>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {debtors.length > 0 ? debtors.map((debtor) => (
                                <Card key={debtor.id} className="bg-slate-900/50 border-red-500/20 hover:border-red-500/40 transition-all border shadow-lg group">
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="w-12 h-12 rounded-2xl bg-red-500/10 flex items-center justify-center text-red-500">
                                            <AlertTriangle size={24} />
                                        </div>
                                        <Badge color="red" size="xs">Moroso Crítico</Badge>
                                    </div>
                                    <Title className="text-white group-hover:text-red-400 transition-colors">{debtor.first_name} {debtor.last_name}</Title>
                                    <Text className="text-slate-400 mt-1">{t('customers.columns.membership')}: {debtor.tariff_name} ({debtor.tariff_amount}€)</Text>

                                    <div className="mt-6 pt-4 border-t border-white/5 space-y-3">
                                        <div className="flex justify-between items-center text-xs tracking-wide mb-2">
                                            <span className="text-slate-500 uppercase font-bold">Meses sin pagar:</span>
                                            <span className="text-red-400 font-bold bg-red-500/10 px-2 py-0.5 rounded border border-red-500/20">
                                                TOTAL: {debtor.total_debt}€
                                            </span>
                                        </div>

                                        <div className="space-y-3">
                                            {Object.entries(
                                                (debtor.unpaid_months || []).reduce((acc, m) => {
                                                    acc[m.year] = acc[m.year] || [];
                                                    acc[m.year].push(m);
                                                    return acc;
                                                }, {})
                                            ).sort(([a], [b]) => b - a).map(([year, months]) => (
                                                <div key={year}>
                                                    <div className="text-[10px] font-bold text-slate-600 mb-1">{year}</div>
                                                    <div className="flex flex-wrap gap-1">
                                                        {months.map((m, idx) => (
                                                            <div
                                                                key={idx}
                                                                title={`${m.month + 1}/${m.year} - ${m.amount}€`}
                                                                className="w-8 h-8 rounded-full bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-colors flex items-center justify-center font-bold text-xs border border-red-500/20 cursor-default"
                                                            >
                                                                {m.letter}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                </Card>
                            )) : (
                                <div className="col-span-full py-12 text-center">
                                    <CheckCircle2 size={48} className="mx-auto text-emerald-500 mb-4 opacity-20" />
                                    <h3 className="text-white font-bold text-lg">¡Gimnasio al día!</h3>
                                    <p className="text-slate-500 text-sm">No hay socios con deudas pendientes superiores a un mes.</p>
                                </div>
                            )}
                        </div>
                    </TabPanel>

                    {/* MULTI-MES PANEL */}
                    <TabPanel>
                        {(() => {
                            const filteredMulti = multiMonthData.filter(m => {
                                const q = normalizeText(multiSearch);
                                const matchesSearch = !q
                                    || normalizeText(`${m.first_name || ''} ${m.last_name || ''}`).includes(q)
                                    || normalizeText(m.tariff_name).includes(q)
                                    || normalizeText(m.payment_method).includes(q);
                                const matchesStatus = multiStatusFilter === 'all' || m.status === multiStatusFilter;
                                return matchesSearch && matchesStatus;
                            }).sort((a, b) => {
                                if (multiSort === 'name') {
                                    return (`${a.last_name} ${a.first_name}`).localeCompare(`${b.last_name} ${b.first_name}`);
                                }
                                if (multiSort === 'endDate') {
                                    return new Date(a.period_end) - new Date(b.period_end);
                                }
                                // recent (default): por último pago descendente
                                return new Date(b.last_payment_date) - new Date(a.last_payment_date);
                            });

                            const vigentesAll = multiMonthData.filter(m => m.status === 'vigente').length;
                            const expiradosAll = multiMonthData.filter(m => m.status === 'expirado').length;
                            const pendientesAll = multiMonthData.filter(m => m.status === 'pendiente').length;
                            const totalAll = filteredMulti
                                .filter(m => m.status !== 'pendiente')
                                .reduce((s, m) => s + (m.total_amount || 0), 0);

                            const handleAnularGroup = async (item) => {
                                if (!item.sample_payment_id || !item.payment_group_id) {
                                    setConfirmModal({
                                        isOpen: true,
                                        title: 'No se puede anular',
                                        message: 'No se encontró el identificador del grupo de pagos.',
                                        type: 'danger',
                                        showCancel: false,
                                        confirmText: 'OK',
                                        onConfirm: () => {}
                                    });
                                    return;
                                }
                                // Cargar los pagos individuales del grupo para mostrar los meses
                                let groupPayments = [];
                                try {
                                    const res = await window.api.payments.getGroup(item.payment_group_id);
                                    groupPayments = (res?.data || res || []).filter(Boolean);
                                } catch (err) {
                                    console.error('No se pudo cargar el grupo:', err);
                                }
                                const totalGroup = groupPayments.reduce((s, p) => s + (p.amount || 0), 0) || item.total_amount;
                                const messageNode = (
                                    <div className="space-y-3 text-left">
                                        <p>
                                            Se anulará el <span className="font-bold text-white">grupo multi-mes</span> de{' '}
                                            <span className="font-bold text-white">{item.first_name} {item.last_name}</span>.
                                        </p>
                                        <div className="bg-slate-900/50 border border-red-500/20 rounded-lg p-3">
                                            <div className="text-[10px] uppercase tracking-wider text-red-400 font-bold mb-2">
                                                Se borrarán {groupPayments.length || item.billing_months} pagos · Total {totalGroup.toFixed(2)}€
                                            </div>
                                            <ul className="space-y-1 max-h-40 overflow-y-auto pr-1">
                                                {(groupPayments.length > 0 ? groupPayments : []).map(p => {
                                                    const d = p.payment_date ? new Date(p.payment_date) : null;
                                                    const monthLabel = d
                                                        ? d.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })
                                                        : '—';
                                                    return (
                                                        <li key={p.id} className="flex items-center justify-between gap-3 text-xs">
                                                            <span className="capitalize text-slate-300">{monthLabel}</span>
                                                            <span className={`font-mono font-semibold ${p.amount > 0 ? 'text-emerald-300' : 'text-slate-500 italic'}`}>
                                                                {p.amount > 0 ? `${p.amount.toFixed(2)}€` : '0€ (cobertura)'}
                                                            </span>
                                                        </li>
                                                    );
                                                })}
                                            </ul>
                                        </div>
                                        <p className="text-[11px] text-slate-500 italic">
                                            Esta acción no se puede deshacer. Todos los meses del grupo (incluidas las coberturas de 0€) serán eliminados.
                                        </p>
                                    </div>
                                );
                                setConfirmModal({
                                    isOpen: true,
                                    title: 'Anular grupo de pagos',
                                    message: messageNode,
                                    type: 'danger',
                                    confirmText: `Anular grupo (${groupPayments.length || item.billing_months} meses)`,
                                    showCancel: true,
                                    onConfirm: async () => {
                                        try {
                                            const ok = await deletePayment(item.customer_id, item.sample_payment_id);
                                            if (ok) await fetchData();
                                        } catch (err) {
                                            console.error('Anular grupo error:', err);
                                        }
                                    }
                                });
                            };

                            const handlePayPending = (item) => {
                                // Abre el modal de pago para el cliente pendiente (mes actual)
                                const customer = customers.find(c => c.id === item.customer_id);
                                if (customer) {
                                    setSelectedCustomer(customer);
                                    setModalOpen(true);
                                }
                            };

                            if (multiMonthData.length === 0) {
                                return (
                                    <div className="text-center py-16 bg-slate-900/30 rounded-2xl border border-dashed border-white/5">
                                        <Calendar className="mx-auto text-slate-600 mb-3" size={40} />
                                        <h3 className="text-white font-bold text-lg">Sin clientes multi-mes</h3>
                                        <p className="text-slate-500 text-sm">Crea una tarifa Trimestral / Semestral / Anual y registra un pago multi-mes para empezar.</p>
                                    </div>
                                );
                            }

                            return (
                                <div className="space-y-4">
                                    {/* Stats multi-mes */}
                                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                                        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4">
                                            <div className="text-3xl font-bold text-emerald-400">{vigentesAll}</div>
                                            <div className="text-xs text-emerald-300/70 uppercase tracking-wider mt-1">Vigentes</div>
                                        </div>
                                        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
                                            <div className="text-3xl font-bold text-amber-400">{expiradosAll}</div>
                                            <div className="text-xs text-amber-300/70 uppercase tracking-wider mt-1">Expirados</div>
                                        </div>
                                        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
                                            <div className="text-3xl font-bold text-red-400">{pendientesAll}</div>
                                            <div className="text-xs text-red-300/70 uppercase tracking-wider mt-1">Sin pagar</div>
                                        </div>
                                        <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-4">
                                            <div className="text-3xl font-bold text-purple-300">{totalAll.toFixed(0)}€</div>
                                            <div className="text-xs text-purple-200/70 uppercase tracking-wider mt-1">Recaudado (filtro)</div>
                                        </div>
                                        <div className="bg-slate-800/60 border border-white/5 rounded-xl p-4">
                                            <div className="text-3xl font-bold text-slate-200">{filteredMulti.length}<span className="text-slate-500 text-base font-medium">/{multiMonthData.length}</span></div>
                                            <div className="text-xs text-slate-400 uppercase tracking-wider mt-1">Mostrados</div>
                                        </div>
                                    </div>

                                    {/* Barra de filtros */}
                                    <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between bg-slate-900/30 border border-white/5 rounded-xl p-3">
                                        <div className="relative flex-1 max-w-md">
                                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                                                <Search size={16} />
                                            </div>
                                            <input
                                                type="text"
                                                placeholder="Buscar por cliente, tarifa o método…"
                                                className="w-full bg-slate-950/50 border border-white/10 rounded-lg py-2 pl-9 pr-3 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-purple-500/60"
                                                value={multiSearch}
                                                onChange={(e) => setMultiSearch(e.target.value)}
                                            />
                                        </div>

                                        <div className="flex items-center gap-2 flex-wrap">
                                            {[
                                                { key: 'all', label: 'Todos' },
                                                { key: 'vigente', label: 'Vigentes' },
                                                { key: 'expirado', label: 'Expirados' },
                                                { key: 'pendiente', label: 'Sin pagar' },
                                            ].map(opt => (
                                                <button
                                                    key={opt.key}
                                                    onClick={() => setMultiStatusFilter(opt.key)}
                                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                                                        multiStatusFilter === opt.key
                                                            ? 'bg-purple-600 text-white shadow-lg shadow-purple-900/20'
                                                            : 'bg-slate-900/50 text-slate-400 border border-white/5 hover:bg-slate-800'
                                                    }`}
                                                >
                                                    {opt.label}
                                                </button>
                                            ))}

                                            <div className="w-px h-6 bg-white/10 mx-1" />

                                            <select
                                                value={multiSort}
                                                onChange={(e) => setMultiSort(e.target.value)}
                                                className="bg-slate-900/50 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-purple-500"
                                                title="Ordenar"
                                            >
                                                <option value="recent">Más reciente</option>
                                                <option value="name">Cliente A-Z</option>
                                                <option value="endDate">Próximo a vencer</option>
                                            </select>

                                            <button
                                                onClick={fetchData}
                                                disabled={loading}
                                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/60 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold uppercase tracking-wider transition-all border border-white/5 disabled:opacity-50"
                                                title="Refrescar"
                                            >
                                                <RotateCcw size={12} className={loading ? 'animate-spin' : ''} />
                                                Refrescar
                                            </button>
                                        </div>
                                    </div>

                                    {/* Lista grupos multi-mes */}
                                    {filteredMulti.length === 0 ? (
                                        <div className="text-center py-12 bg-slate-900/30 rounded-2xl border border-dashed border-white/5">
                                            <Search className="mx-auto text-slate-600 mb-3" size={32} />
                                            <h3 className="text-white font-bold">Sin resultados</h3>
                                            <p className="text-slate-500 text-sm">Prueba a cambiar los filtros o limpiar la búsqueda.</p>
                                        </div>
                                    ) : (
                                        <div className="overflow-hidden rounded-2xl border border-white/5 bg-slate-900/30 backdrop-blur-sm">
                                            <table className="w-full text-left">
                                                <thead className="bg-slate-950/50 text-slate-400 text-xs font-bold uppercase tracking-widest border-b border-white/5">
                                                    <tr>
                                                        <th className="px-4 py-3">Cliente</th>
                                                        <th className="px-4 py-3">Tarifa</th>
                                                        <th className="px-4 py-3">Periodo</th>
                                                        <th className="px-4 py-3">Método</th>
                                                        <th className="px-4 py-3 text-right">Total</th>
                                                        <th className="px-4 py-3 text-center">Estado</th>
                                                        <th className="px-4 py-3 text-right">Acciones</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-white/5">
                                                    {filteredMulti.map(item => {
                                                        const isPendiente = item.status === 'pendiente';
                                                        const periodLabel = isPendiente
                                                            ? 'Sin iniciar'
                                                            : `${new Date(item.period_start).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: '2-digit' })} → ${new Date(item.period_end).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: '2-digit' })}`;
                                                        const billingLabel = item.billing_months === 3 ? 'Trimestral'
                                                            : item.billing_months === 6 ? 'Semestral'
                                                            : item.billing_months === 12 ? 'Anual'
                                                            : `${item.billing_months} meses`;
                                                        const rowKey = item.payment_group_id || `pending-${item.customer_id}`;
                                                        return (
                                                            <tr key={rowKey} className="hover:bg-white/5 transition-colors group">
                                                                <td className="px-4 py-3">
                                                                    <div className="flex items-center gap-3">
                                                                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center border transition-colors ${isPendiente
                                                                            ? 'bg-red-500/10 border-red-500/20 text-red-400 group-hover:text-red-300'
                                                                            : 'bg-slate-800 border-white/5 text-slate-400 group-hover:text-purple-300'}`}>
                                                                            <User size={18} />
                                                                        </div>
                                                                        <div>
                                                                            <div className="text-sm font-bold text-white">{item.first_name} {item.last_name}</div>
                                                                            {isPendiente ? (
                                                                                <div className="text-[10px] text-red-400">Aún sin pago multi-mes</div>
                                                                            ) : (
                                                                                <div className="text-[10px] text-slate-500">Pagado el {new Date(item.first_payment_date).toLocaleDateString('es-ES')}</div>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                </td>
                                                                <td className="px-4 py-3">
                                                                    <div className="text-sm text-slate-300 font-medium">{item.tariff_name || 'Custom'}</div>
                                                                    <div className="text-[10px] text-purple-400 font-bold uppercase tracking-wider">{billingLabel}</div>
                                                                </td>
                                                                <td className="px-4 py-3 text-sm text-slate-400 font-mono">
                                                                    {periodLabel}
                                                                    {item.status === 'vigente' && (
                                                                        <div className="text-[10px] text-emerald-400 mt-0.5">{item.days_remaining} días restantes</div>
                                                                    )}
                                                                    {item.status === 'expirado' && (
                                                                        <div className="text-[10px] text-amber-400 mt-0.5">Expiró hace {-item.days_remaining} días</div>
                                                                    )}
                                                                    {isPendiente && (
                                                                        <div className="text-[10px] text-slate-600 mt-0.5 italic">Esperando primer pago</div>
                                                                    )}
                                                                </td>
                                                                <td className="px-4 py-3 text-xs text-slate-400">
                                                                    {item.payment_method || '—'}
                                                                </td>
                                                                <td className="px-4 py-3 text-right">
                                                                    <div className={`text-sm font-mono font-bold ${isPendiente ? 'text-slate-400' : 'text-purple-200'}`}>
                                                                        {item.total_amount.toFixed(2)}€
                                                                    </div>
                                                                    {isPendiente && (
                                                                        <div className="text-[9px] text-slate-600 uppercase tracking-wider">a cobrar</div>
                                                                    )}
                                                                </td>
                                                                <td className="px-4 py-3 text-center">
                                                                    {item.status === 'vigente' && (
                                                                        <Badge color="emerald">Vigente</Badge>
                                                                    )}
                                                                    {item.status === 'expirado' && (
                                                                        <Badge color="amber">Expirado</Badge>
                                                                    )}
                                                                    {item.status === 'pendiente' && (
                                                                        <Badge color="red">Sin pagar</Badge>
                                                                    )}
                                                                </td>
                                                                <td className="px-4 py-3 text-right">
                                                                    {isPendiente ? (
                                                                        <button
                                                                            onClick={() => handlePayPending(item)}
                                                                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold uppercase tracking-wider transition-all shadow-lg shadow-emerald-900/20"
                                                                            title="Registrar el primer pago multi-mes"
                                                                        >
                                                                            <CreditCard size={12} />
                                                                            Cobrar
                                                                        </button>
                                                                    ) : (
                                                                        <button
                                                                            onClick={() => handleAnularGroup(item)}
                                                                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 text-xs font-bold uppercase tracking-wider transition-all border border-red-500/20 hover:border-red-500/40"
                                                                            title="Anular el grupo completo de pagos"
                                                                        >
                                                                            <RotateCcw size={12} />
                                                                            Anular
                                                                        </button>
                                                                    )}
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            );
                        })()}
                    </TabPanel>
                </TabPanels>
            </TabGroup>

            {/* Modal de Pago */}
            {modalOpen && selectedCustomer && (
                <PaymentModal
                    isOpen={modalOpen}
                    onClose={() => {
                        setModalOpen(false);
                        fetchData(); // Refresh list after closing
                    }}
                    customer={selectedCustomer}
                    month={month - 1} // 0-indexed for the modal
                    year={year}
                    existingPayment={getPaymentForMonth(selectedCustomer.id, month - 1, year)}
                />
            )}

            {/* Modal de Confirmación Genérico */}
            <ConfirmationModal
                isOpen={confirmModal.isOpen}
                title={confirmModal.title}
                type={confirmModal.type}
                confirmText={confirmModal.confirmText}
                showCancel={confirmModal.showCancel}
                onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                onConfirm={confirmModal.onConfirm}
            >
                {confirmModal.message}
            </ConfirmationModal>
        </div>
    );
}
