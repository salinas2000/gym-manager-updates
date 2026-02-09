import React, { useState, useEffect } from 'react';
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
            const [reportRes, debtorsRes] = await Promise.all([
                getMonthlyReport(year, month),
                getDebtors()
            ]);

            if (reportRes.success) setMonthlyData(reportRes.data);
            if (debtorsRes.success) setDebtors(debtorsRes.data);
        } catch (e) {
            console.error('Error fetching payments data:', e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [selectedDate]);

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

    const handleRefundDirect = (item) => {
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

        setConfirmModal({
            isOpen: true,
            title: 'Anular Pago',
            message: `¿Estás seguro de que deseas anular el pago de ${item.paid_amount}€ de ${item.first_name} ${item.last_name}? Esta acción no se puede deshacer.`,
            type: 'danger',
            confirmText: 'Anular Pago',
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

    const filteredReport = monthlyData.filter(item => {
        const matchesSearch = `${item.first_name} ${item.last_name}`.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus = filterStatus === 'all'
            || (filterStatus === 'paid' && item.is_paid)
            || (filterStatus === 'unpaid' && !item.is_paid);

        return matchesSearch && matchesStatus;
    });

    const stats = {
        total: monthlyData.length,
        paid: monthlyData.filter(i => i.is_paid).length,
        unpaid: monthlyData.filter(i => !i.is_paid).length,
        revenue: monthlyData.reduce((acc, curr) => acc + curr.paid_amount, 0),
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

                                <div className="flex items-center gap-2">
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
                                </div>
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
                                                    <div className="text-sm font-medium text-slate-300">{item.tariff_name || 'Sin Plan'}</div>
                                                    <div className="text-xs text-blue-400 font-bold">{item.tariff_amount}€</div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    {item.is_paid ? (
                                                        <Badge color="emerald" icon={CheckCircle2} size="xs" className="px-2 py-0.5 font-bold uppercase">Pagado</Badge>
                                                    ) : (
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
