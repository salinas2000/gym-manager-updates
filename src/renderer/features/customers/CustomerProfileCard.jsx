import React, { useState, useEffect } from 'react';
import { X, User, Mail, Phone, CreditCard, Dumbbell, Calendar, TrendingUp, Clock, Wallet } from 'lucide-react';

export default function CustomerProfileCard({ isOpen, onClose, customer, onNavigateTraining, onOpenPayments }) {
    const [payments, setPayments] = useState([]);
    const [mesocycles, setMesocycles] = useState([]);
    const [membershipHistory, setMembershipHistory] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!isOpen || !customer) return;
        setLoading(true);

        Promise.all([
            window.api.payments.getByCustomer(customer.id),
            window.api.training.getMesocycles(customer.id),
            window.api.customers.getHistory(customer.id)
        ]).then(([payRes, mesoRes, histRes]) => {
            setPayments(payRes.success ? payRes.data : []);
            setMesocycles(mesoRes.success ? mesoRes.data : []);
            setMembershipHistory(histRes.success ? histRes.data : []);
        }).catch(console.error).finally(() => setLoading(false));
    }, [isOpen, customer]);

    if (!isOpen || !customer) return null;

    const totalPaid = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
    const activeMesos = mesocycles.filter(m => m.active);
    const currentMeso = activeMesos.find(m => m.status === 'active');
    const memberSince = customer.created_at ? new Date(customer.created_at).toLocaleDateString('es-ES', { year: 'numeric', month: 'long' }) : 'Desconocido';

    // Calculate membership duration
    const createdDate = customer.created_at ? new Date(customer.created_at) : null;
    const monthsActive = createdDate ? Math.max(1, Math.round((Date.now() - createdDate.getTime()) / (1000 * 60 * 60 * 24 * 30))) : 0;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={onClose} />
            <div className="relative w-full max-w-2xl max-h-[85vh] bg-slate-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">

                {/* Header */}
                <div className="relative bg-gradient-to-br from-slate-800 to-slate-900 p-6 border-b border-white/5">
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 p-2 hover:bg-white/5 rounded-lg text-slate-400 hover:text-white transition-colors"
                    >
                        <X size={18} />
                    </button>

                    <div className="flex items-center gap-5">
                        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-2xl font-black text-white shadow-xl shadow-blue-500/20 border border-white/10">
                            {customer.first_name[0]}{customer.last_name[0]}
                        </div>
                        <div className="flex-1">
                            <h2 className="text-2xl font-bold text-white">
                                {customer.first_name} {customer.last_name}
                            </h2>
                            <div className="flex items-center gap-4 mt-2">
                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${customer.active
                                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                    : 'bg-red-500/20 text-red-400 border border-red-500/30'
                                    }`}>
                                    <div className={`w-1.5 h-1.5 rounded-full ${customer.active ? 'bg-emerald-400' : 'bg-red-400'}`} />
                                    {customer.active ? 'Activo' : 'Inactivo'}
                                </span>
                                <span className="text-xs text-slate-500 flex items-center gap-1">
                                    <Calendar size={12} />
                                    Miembro desde {memberSince}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="overflow-y-auto max-h-[calc(85vh-180px)] p-6 space-y-6">

                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <div className="w-8 h-8 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
                        </div>
                    ) : (
                        <>
                            {/* Contact Info */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-slate-800/50 rounded-xl p-4 border border-white/5 flex items-center gap-3">
                                    <div className="p-2 bg-blue-500/10 rounded-lg">
                                        <Mail size={16} className="text-blue-400" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] uppercase font-bold text-slate-500 tracking-widest">Email</p>
                                        <p className="text-sm text-white truncate">{customer.email}</p>
                                    </div>
                                </div>
                                <div className="bg-slate-800/50 rounded-xl p-4 border border-white/5 flex items-center gap-3">
                                    <div className="p-2 bg-purple-500/10 rounded-lg">
                                        <Phone size={16} className="text-purple-400" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] uppercase font-bold text-slate-500 tracking-widest">Telefono</p>
                                        <p className="text-sm text-white">{customer.phone || 'No registrado'}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Stats Grid */}
                            <div className="grid grid-cols-4 gap-3">
                                <div className="bg-slate-800/50 rounded-xl p-4 border border-white/5 text-center">
                                    <CreditCard size={20} className="mx-auto text-emerald-400 mb-2" />
                                    <p className="text-lg font-black text-white">{customer.tariff_name || 'Sin Plan'}</p>
                                    <p className="text-[10px] uppercase font-bold text-slate-500 tracking-widest">Tarifa</p>
                                    {customer.tariff_amount && (
                                        <p className="text-xs text-emerald-400 font-bold mt-1">{customer.tariff_amount}€/mes</p>
                                    )}
                                </div>
                                <div className="bg-slate-800/50 rounded-xl p-4 border border-white/5 text-center">
                                    <Wallet size={20} className="mx-auto text-amber-400 mb-2" />
                                    <p className="text-lg font-black text-white">{totalPaid.toFixed(0)}€</p>
                                    <p className="text-[10px] uppercase font-bold text-slate-500 tracking-widest">Total Pagado</p>
                                    <p className="text-xs text-slate-400 mt-1">{payments.length} pagos</p>
                                </div>
                                <div className="bg-slate-800/50 rounded-xl p-4 border border-white/5 text-center">
                                    <Dumbbell size={20} className="mx-auto text-orange-400 mb-2" />
                                    <p className="text-lg font-black text-white">{mesocycles.length}</p>
                                    <p className="text-[10px] uppercase font-bold text-slate-500 tracking-widest">Mesociclos</p>
                                    <p className="text-xs text-slate-400 mt-1">{activeMesos.length} activos</p>
                                </div>
                                <div className="bg-slate-800/50 rounded-xl p-4 border border-white/5 text-center">
                                    <TrendingUp size={20} className="mx-auto text-blue-400 mb-2" />
                                    <p className="text-lg font-black text-white">{monthsActive}</p>
                                    <p className="text-[10px] uppercase font-bold text-slate-500 tracking-widest">Meses</p>
                                    <p className="text-xs text-slate-400 mt-1">de antiguedad</p>
                                </div>
                            </div>

                            {/* Current Training Plan */}
                            <div>
                                <h3 className="text-xs uppercase font-bold text-slate-400 tracking-widest mb-3 flex items-center gap-2">
                                    <Dumbbell size={14} />
                                    Plan de Entrenamiento Actual
                                </h3>
                                {currentMeso ? (
                                    <div className="bg-gradient-to-r from-blue-500/10 to-indigo-500/10 rounded-xl p-4 border border-blue-500/20">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="font-bold text-white">{currentMeso.name}</p>
                                                <p className="text-xs text-slate-400 mt-1">
                                                    {currentMeso.start_date ? new Date(currentMeso.start_date).toLocaleDateString('es-ES') : ''}
                                                    {currentMeso.end_date ? ` - ${new Date(currentMeso.end_date).toLocaleDateString('es-ES')}` : ''}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-bold text-blue-400 bg-blue-500/10 px-2 py-1 rounded-lg">
                                                    {currentMeso.routines?.length || 0} rutinas
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="bg-slate-800/30 rounded-xl p-4 border border-dashed border-white/10 text-center">
                                        <p className="text-sm text-slate-500">Sin plan de entrenamiento activo</p>
                                    </div>
                                )}
                            </div>

                            {/* Membership Timeline */}
                            <div>
                                <h3 className="text-xs uppercase font-bold text-slate-400 tracking-widest mb-3 flex items-center gap-2">
                                    <Clock size={14} />
                                    Historial de Membresía
                                </h3>
                                <div className="space-y-2 max-h-40 overflow-y-auto">
                                    {membershipHistory.length === 0 ? (
                                        <p className="text-xs text-slate-600 italic">Sin registros</p>
                                    ) : (
                                        membershipHistory.map((m, i) => (
                                            <div key={m.id || i} className="flex items-center gap-3 bg-slate-800/30 rounded-lg p-3 border border-white/5">
                                                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${!m.end_date ? 'bg-emerald-400' : 'bg-slate-600'}`} />
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-xs text-white font-medium">
                                                        {new Date(m.start_date).toLocaleDateString('es-ES')}
                                                        {m.end_date ? ` - ${new Date(m.end_date).toLocaleDateString('es-ES')}` : ' - Actual'}
                                                    </p>
                                                </div>
                                                <span className={`text-[9px] uppercase font-bold tracking-widest ${!m.end_date ? 'text-emerald-400' : 'text-slate-500'}`}>
                                                    {!m.end_date ? 'Activa' : 'Finalizada'}
                                                </span>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>

                            {/* Recent Payments */}
                            <div>
                                <h3 className="text-xs uppercase font-bold text-slate-400 tracking-widest mb-3 flex items-center gap-2">
                                    <Wallet size={14} />
                                    Últimos Pagos
                                </h3>
                                <div className="space-y-2 max-h-40 overflow-y-auto">
                                    {payments.length === 0 ? (
                                        <p className="text-xs text-slate-600 italic">Sin pagos registrados</p>
                                    ) : (
                                        payments.slice(0, 5).map((p, i) => (
                                            <div key={p.id || i} className="flex items-center justify-between bg-slate-800/30 rounded-lg p-3 border border-white/5">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                                                        <span className="text-xs font-bold text-emerald-400">€</span>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs text-white font-medium">{p.tariff_name || 'Pago'}</p>
                                                        <p className="text-[10px] text-slate-500">
                                                            {new Date(p.payment_date).toLocaleDateString('es-ES')}
                                                        </p>
                                                    </div>
                                                </div>
                                                <span className="text-sm font-bold text-emerald-400">+{p.amount}€</span>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </>
                    )}
                </div>

                {/* Footer Actions */}
                <div className="p-4 border-t border-white/5 bg-slate-900/50 flex justify-between items-center">
                    <button
                        onClick={onClose}
                        className="text-slate-400 hover:text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-white/5 transition-all"
                    >
                        Cerrar
                    </button>
                    <div className="flex gap-2">
                        {onOpenPayments && (
                            <button
                                onClick={() => { onClose(); onOpenPayments(customer); }}
                                className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2"
                            >
                                <Wallet size={14} />
                                Ver Pagos
                            </button>
                        )}
                        {onNavigateTraining && (
                            <button
                                onClick={() => { onClose(); onNavigateTraining(customer); }}
                                className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2"
                            >
                                <Dumbbell size={14} />
                                Entrenamientos
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
