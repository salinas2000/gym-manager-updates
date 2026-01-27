import React, { useState } from 'react';
import { Search, Plus, Calendar, MoreHorizontal, Check, X, Filter, Users, UserCheck, UserX, Clock, Wallet, Dumbbell } from 'lucide-react';
import { useGym } from '../../context/GymContext';
import { useLanguage } from '../../context/LanguageContext';
import { cn } from '../../lib/utils';

// Shared Colors (Consider moving to a constants file)
const COLORS = [
    { name: 'Obsidian', from: 'from-slate-700', to: 'to-slate-900', border: 'border-slate-600', id: 'obsidian' },
    { name: 'Emerald', from: 'from-emerald-600', to: 'to-emerald-900', border: 'border-emerald-500', id: 'emerald' },
    { name: 'Blue', from: 'from-blue-600', to: 'to-blue-900', border: 'border-blue-500', id: 'blue' },
    { name: 'Purple', from: 'from-purple-600', to: 'to-purple-900', border: 'border-purple-500', id: 'purple' },
    { name: 'Rose', from: 'from-rose-600', to: 'to-rose-900', border: 'border-rose-500', id: 'rose' },
    { name: 'Amber', from: 'from-amber-600', to: 'to-amber-900', border: 'border-amber-500', id: 'amber' },
];

export default function CustomerTable({ onOpenHistory, onAddCustomer, onManageTariffs, onEditCustomer, onEditHistory, onOpenTraining }) {
    const { customers, toggleCustomerStatus, tariffs } = useGym();
    const { t } = useLanguage();
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('all'); // all, active, inactive
    const [tariffFilter, setTariffFilter] = useState('all'); // all, id...

    // Deactivation Modal State
    const [deactivateModalOpen, setDeactivateModalOpen] = useState(false);
    const [selectedCustomer, setSelectedCustomer] = useState(null);

    const getTariffTheme = (tariff) => {
        if (!tariff) return COLORS[1]; // Default Emerald
        return COLORS.find(c => c.id === tariff.color_theme) || COLORS[1];
    };

    const safeCustomers = Array.isArray(customers) ? customers : [];

    // Filtering Logic
    const filtered = safeCustomers.filter(c => {
        // Text Search
        const matchesSearch =
            c.first_name.toLowerCase().includes(search.toLowerCase()) ||
            c.last_name.toLowerCase().includes(search.toLowerCase()) ||
            c.email.toLowerCase().includes(search.toLowerCase());

        // Status Filter
        const matchesStatus =
            statusFilter === 'all' ||
            (statusFilter === 'active' && c.active) ||
            (statusFilter === 'inactive' && !c.active);

        // Tariff Filter
        const matchesTariff =
            tariffFilter === 'all' ||
            (c.tariff_id && c.tariff_id.toString() === tariffFilter);

        return matchesSearch && matchesStatus && matchesTariff;
    });

    const handleToggleClick = (customer) => {
        if (customer.active) {
            // If active, ask confirmation (Immediate vs End of Month)
            setSelectedCustomer(customer);
            setDeactivateModalOpen(true);
        } else {
            // If inactive, just reactivate (Immediate)
            toggleCustomerStatus(customer.id, 'immediate');
        }
    };

    const confirmDeactivate = (mode) => {
        if (selectedCustomer) {
            toggleCustomerStatus(selectedCustomer.id, mode);
            setDeactivateModalOpen(false);
            setSelectedCustomer(null);
        }
    };

    return (
        <div className="flex flex-col h-full bg-slate-950/50 backdrop-blur-sm rounded-3xl border border-white/5 overflow-hidden">

            {/* Custom Modal for Deactivation Confirmation */}
            {deactivateModalOpen && selectedCustomer && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div
                        className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
                        onClick={() => setDeactivateModalOpen(false)}
                    />
                    <div className="relative w-full max-w-sm bg-slate-900 border border-white/10 rounded-2xl shadow-2xl p-6 animate-in fade-in zoom-in-95 duration-200">
                        <h3 className="text-lg font-bold text-white mb-2">Confirmar Baja</h3>
                        <p className="text-slate-400 text-sm mb-6">
                            ¿Deseas finalizar la suscripción de <span className="text-white font-medium">{selectedCustomer.first_name}</span> ahora mismo o programarla para final de mes?
                        </p>
                        <div className="space-y-3">
                            <button
                                onClick={() => confirmDeactivate('end_of_month')}
                                className="w-full py-3 rounded-xl bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white font-bold shadow-lg shadow-orange-500/20 text-sm flex items-center justify-center gap-2"
                            >
                                <Calendar size={16} />
                                Final de Mes (Recomendado)
                            </button>
                            <button
                                onClick={() => confirmDeactivate('immediate')}
                                className="w-full py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-medium border border-white/5 text-sm"
                            >
                                Finalizar Ahora
                            </button>
                            <button
                                onClick={() => setDeactivateModalOpen(false)}
                                className="w-full py-2 text-xs text-slate-500 hover:text-white mt-2"
                            >
                                Cancelar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* TOOLBAR */}
            <div className="p-6 border-b border-white/5 space-y-4">
                {/* Row 1: Search & Main Actions */}
                <div className="flex justify-between items-center gap-4">
                    <div className="relative flex-1 max-w-md group">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500 group-focus-within:text-blue-400 transition-colors">
                            <Search size={18} />
                        </div>
                        <input
                            type="text"
                            placeholder={t('customers.searchPlaceholder')}
                            className="w-full bg-slate-900/50 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-sm text-slate-200 placeholder:text-slate-600 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 focus:outline-none transition-all"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>

                    <button
                        onClick={onAddCustomer}
                        className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium shadow-lg shadow-blue-500/20 transition-all flex items-center gap-2"
                    >
                        <Plus size={18} />
                        <span>{t('customers.newMember')}</span>
                    </button>
                </div>

                {/* Row 2: Filters */}
                <div className="flex flex-wrap items-center gap-2">
                    {/* Status Filters */}
                    <div className="flex p-1 bg-slate-900/80 rounded-lg border border-white/5">
                        <button
                            onClick={() => setStatusFilter('all')}
                            className={cn("px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1.5", statusFilter === 'all' ? "bg-slate-700 text-white shadow" : "text-slate-400 hover:text-slate-200")}
                        >
                            <Users size={14} /> {t('customers.filters.all')}
                        </button>
                        <button
                            onClick={() => setStatusFilter('active')}
                            className={cn("px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1.5", statusFilter === 'active' ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "text-slate-400 hover:text-slate-200")}
                        >
                            <UserCheck size={14} /> {t('customers.filters.active')}
                        </button>
                        <button
                            onClick={() => setStatusFilter('inactive')}
                            className={cn("px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1.5", statusFilter === 'inactive' ? "bg-red-500/20 text-red-400 border border-red-500/30" : "text-slate-400 hover:text-slate-200")}
                        >
                            <UserX size={14} /> {t('customers.filters.inactive')}
                        </button>
                    </div>

                    <div className="w-px h-6 bg-white/10 mx-2" />

                    {/* Tariff Dropdown Filter */}
                    <select
                        className="bg-slate-900/80 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-blue-500"
                        value={tariffFilter}
                        onChange={(e) => setTariffFilter(e.target.value)}
                    >
                        <option value="all">{t('customers.filters.allPlans')}</option>
                        {tariffs.map(t => (
                            <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* TABLE HEADER */}
            <div className="grid grid-cols-12 gap-4 px-6 py-3 border-b border-white/5 bg-slate-900/30 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                <div className="col-span-4 pl-2">{t('customers.columns.member')}</div>
                <div className="col-span-3">{t('customers.columns.contact')}</div>
                <div className="col-span-2">{t('customers.columns.membership')}</div>
                <div className="col-span-1 text-center">{t('customers.columns.status')}</div>
                <div className="col-span-2 text-center">{t('customers.columns.actions')}</div>
            </div>

            {/* TABLE BODY */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">
                {filtered.map((customer) => {
                    const tariff = tariffs.find(t => t.id === customer.tariff_id);
                    const theme = getTariffTheme(tariff);

                    // Check if scheduled for unsubscribe
                    const isScheduledInactive = customer.active === 1 && customer.latest_end_date && new Date(customer.latest_end_date) > new Date();
                    const scheduledDate = isScheduledInactive ? new Date(customer.latest_end_date).toLocaleDateString('es-ES') : '';

                    return (
                        <div
                            key={customer.id}
                            className="grid grid-cols-12 gap-4 px-6 py-4 items-center hover:bg-slate-900/40 transition-colors border-b border-white/5 last:border-0 group"
                        >
                            {/* Member */}
                            <div className="col-span-4 flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center text-sm font-bold text-slate-300 border border-white/5 shadow-inner">
                                    {customer.first_name[0]}{customer.last_name[0]}
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-white group-hover:text-blue-400 transition-colors">{customer.first_name} {customer.last_name}</p>
                                    <p className="text-xs text-slate-500 font-mono">#{customer.id.toString().padStart(4, '0')}</p>
                                </div>
                            </div>

                            {/* Contact */}
                            <div className="col-span-3">
                                <p className="text-sm text-slate-300 truncate" title={customer.email}>{customer.email}</p>
                                <p className="text-xs text-slate-500 font-mono">{customer.phone || '—'}</p>
                            </div>

                            {/* Membership Card */}
                            <div className="col-span-2">
                                {tariff ? (
                                    <div className={cn(
                                        "px-2.5 py-1.5 rounded-lg border flex items-center gap-2 w-max max-w-full shadow-sm",
                                        "bg-gradient-to-r", theme.from, theme.to, theme.border
                                    )}>
                                        <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                                        <div className="flex flex-col">
                                            <span className="text-[10px] font-bold text-white uppercase tracking-wider leading-none shadow-black drop-shadow-sm">{tariff.name}</span>
                                            <span className="text-[9px] text-white/80 leading-none mt-0.5">{tariff.amount}€</span>
                                        </div>
                                    </div>
                                ) : (
                                    <span className="text-xs text-slate-600 italic px-2 py-1 rounded bg-slate-900 border border-slate-800">No Plan</span>
                                )}
                            </div>

                            {/* Status */}
                            <div className="col-span-1 flex justify-center">
                                <div className="relative group/status">
                                    <button
                                        onClick={() => handleToggleClick(customer)}
                                        className={cn(
                                            "relative w-9 h-5 rounded-full transition-colors flex items-center p-0.5",
                                            !customer.active ? "bg-slate-700/50 border border-slate-600" :
                                                isScheduledInactive ? "bg-amber-500/20 border border-amber-500/50" :
                                                    "bg-emerald-500/20 border border-emerald-500/50"
                                        )}
                                    >
                                        <div className={cn(
                                            "w-3.5 h-3.5 rounded-full shadow-sm transition-transform duration-200 flex items-center justify-center",
                                            customer.active ? "translate-x-4" : "translate-x-0",
                                            !customer.active ? "bg-slate-400" :
                                                isScheduledInactive ? "bg-amber-400" : "bg-emerald-400"
                                        )}>
                                            {isScheduledInactive && <Clock size={8} className="text-amber-900 stroke-[3]" />}
                                        </div>
                                    </button>

                                    {isScheduledInactive && (
                                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-slate-800 text-xs text-amber-400 rounded border border-amber-500/20 whitespace-nowrap opacity-0 group-hover/status:opacity-100 transition-opacity pointer-events-none z-10">
                                            Baja: {scheduledDate}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="col-span-2 flex justify-center gap-1 opacity-100 lg:opacity-60 group-hover:opacity-100 transition-opacity">
                                <button
                                    onClick={() => onEditCustomer(customer)}
                                    className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-blue-400 transition-colors tooltip"
                                    title="Edit Details"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /><path d="m15 5 4 4" /></svg>
                                </button>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onOpenHistory(customer);
                                    }}
                                    className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-emerald-400 transition-colors tooltip"
                                    title="Ver Pagos"
                                >
                                    <Wallet size={16} />
                                </button>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onEditHistory(customer); // New prop
                                    }}
                                    className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-purple-400 transition-colors tooltip"
                                    title="Historial de Actividad"
                                >
                                    <Clock size={16} />
                                </button>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onOpenTraining(customer);
                                    }}
                                    className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-orange-400 transition-colors tooltip"
                                    title="Gestionar Entrenamientos"
                                >
                                    <Dumbbell size={16} />
                                </button>
                            </div>
                        </div>
                    );
                })}

                {filtered.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-20 text-slate-600">
                        <div className="w-16 h-16 rounded-full bg-slate-900 flex items-center justify-center mb-4">
                            <Search size={24} className="opacity-50" />
                        </div>
                        <p>{t('customers.empty')}</p>
                    </div>
                )}
            </div>
        </div >
    );
}
