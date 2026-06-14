import React, { useState, useEffect } from 'react';
import { X, User, Mail, Phone, CreditCard, Dumbbell, Calendar, TrendingUp, Clock, Wallet, MapPin, Heart, Ruler, Weight, Save, Pencil, FileText, Smartphone, CheckCircle2, XCircle, Send, KeyRound, ShieldOff } from 'lucide-react';
import { useGym } from '../../context/GymContext';
import { useToast } from '../../context/ToastContext';
import ConfirmationModal from '../../components/ui/ConfirmationModal';
import { can } from '../../lib/entitlements';

const TABS = [
    { id: 'overview', label: 'General' },
    { id: 'ficha', label: 'Ficha Medica' },
    { id: 'app', label: 'App Movil' },
];

export default function CustomerProfileCard({ isOpen, onClose, customer, onNavigateTraining, onOpenPayments }) {
    const { updateCustomer, refreshMobileLinks, settings } = useGym();
    const toast = useToast();
    // The mobile-app tab/actions only show if the gym's plan includes it.
    const hasMobileApp = can(settings?.plan, settings?.planFeatures, 'mobile_app');
    const [payments, setPayments] = useState([]);
    const [mesocycles, setMesocycles] = useState([]);
    const [membershipHistory, setMembershipHistory] = useState([]);
    const [mobileStatus, setMobileStatus] = useState(null);
    const [loadingMobile, setLoadingMobile] = useState(false);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('overview');
    const [fullCustomer, setFullCustomer] = useState(null);

    // Medical edit state
    const [editing, setEditing] = useState(false);
    const [editData, setEditData] = useState({});
    const [saving, setSaving] = useState(false);
    // Mobile-app action state (single in-flight indicator, distinguished by action)
    const [mobileAction, setMobileAction] = useState(null); // 'invite' | 'reset' | 'revoke' | null
    // Confirmation modal state — used by mobile-app actions instead of window.confirm
    const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: null, onConfirm: null, type: 'info', confirmText: 'Confirmar' });
    const closeConfirm = () => setConfirmModal(prev => ({ ...prev, isOpen: false }));

    useEffect(() => {
        if (!isOpen || !customer) return;
        let cancelled = false;
        setLoading(true);
        setActiveTab('overview');
        setEditing(false);

        Promise.all([
            window.api.payments.getByCustomer(customer.id),
            window.api.training.getMesocycles(customer.id),
            window.api.customers.getHistory(customer.id),
            window.api.customers.getById(customer.id),
        ]).then(([payRes, mesoRes, histRes, custRes]) => {
            if (cancelled) return; // Prevent stale data from overwriting
            setPayments(payRes.success ? payRes.data : []);
            setMesocycles(mesoRes.success ? mesoRes.data : []);
            setMembershipHistory(histRes.success ? histRes.data : []);
            const full = custRes.success ? custRes.data : customer;
            setFullCustomer(full);
            initEditData(full);
        }).catch(console.error).finally(() => { if (!cancelled) setLoading(false); });

        return () => { cancelled = true; };
    }, [isOpen, customer]);

    // Fetch mobile-app registration status when "App Movil" tab opens.
    // Weight tracking removed — that lives in its own tab/feature now.
    const refreshMobileStatus = React.useCallback(async () => {
        if (!customer) return;
        setLoadingMobile(true);
        try {
            const licData = await window.api.license.getData();
            const gymId = licData?.gym_id;
            if (!gymId) {
                setMobileStatus({ success: false, error: 'No se pudo obtener el gym_id' });
                return;
            }
            const statusRes = await window.api.cloud.getCustomerMobileStatus(gymId, customer.id);
            const status = statusRes?.success ? statusRes.data : { success: false, error: statusRes?.error };
            setMobileStatus(status);
        } catch (err) {
            setMobileStatus({ success: false, error: err.message });
        } finally {
            setLoadingMobile(false);
        }
    }, [customer]);

    useEffect(() => {
        if (!isOpen || !customer || activeTab !== 'app') return;
        refreshMobileStatus();
    }, [isOpen, customer, activeTab, refreshMobileStatus]);

    const initEditData = (c) => {
        let medInfo = c.medical_info;
        if (typeof medInfo === 'string') {
            try { medInfo = JSON.parse(medInfo); } catch (e) { medInfo = null; }
        }
        setEditData({
            dni: c.dni || '',
            address: c.address || '',
            height_cm: c.height_cm || '',
            weight_kg: c.weight_kg || '',
            birth_date: c.birth_date || '',
            medical_info: medInfo || { diseases: '', injuries: '', allergies: '', surgeries: '' },
        });
    };

    if (!isOpen || !customer) return null;

    const c = fullCustomer || customer;
    const totalPaid = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
    const activeMesos = mesocycles.filter(m => m.active);
    const currentMeso = activeMesos.find(m => m.status === 'active');
    const memberSince = c.created_at ? new Date(c.created_at).toLocaleDateString('es-ES', { year: 'numeric', month: 'long' }) : 'Desconocido';
    const createdDate = c.created_at ? new Date(c.created_at) : null;
    const monthsActive = createdDate ? Math.max(1, Math.round((Date.now() - createdDate.getTime()) / (1000 * 60 * 60 * 24 * 30))) : 0;

    // ── RGPD / GDPR ──────────────────────────────────────────────────────────
    const [gdprBusy, setGdprBusy] = useState(false);

    const handleExportGdpr = async () => {
        setGdprBusy(true);
        try {
            const res = await window.api.gdpr.export(c.id);
            const data = res?.success ? res.data : res;
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `rgpd_${(c.first_name || 'cliente').toLowerCase()}_${c.id}.json`;
            a.click();
            URL.revokeObjectURL(url);
            toast.success('Datos exportados');
        } catch (e) {
            toast.error('Error al exportar los datos');
        } finally {
            setGdprBusy(false);
        }
    };

    const handleAnonymizeGdpr = async () => {
        if (!window.confirm('¿Anonimizar a este cliente?\n\nSe borrarán sus datos personales y médicos (y sus datos en la nube). Se conservan los registros de pago por obligación legal. Esta acción NO se puede deshacer.')) return;
        setGdprBusy(true);
        try {
            const res = await window.api.gdpr.anonymize(c.id);
            if (res?.success) {
                toast.success('Cliente anonimizado');
                refreshMobileLinks?.();
                onClose?.();
            } else {
                toast.error(res?.error || 'Error al anonimizar');
            }
        } catch (e) {
            toast.error('Error al anonimizar');
        } finally {
            setGdprBusy(false);
        }
    };

    const handleSaveProfile = async () => {
        setSaving(true);
        try {
            const submitData = {
                ...editData,
                height_cm: editData.height_cm ? Number(editData.height_cm) : null,
                weight_kg: editData.weight_kg ? Number(editData.weight_kg) : null,
            };
            const success = await updateCustomer(c.id, submitData);
            if (success) {
                toast.success('Ficha actualizada correctamente');
                setEditing(false);
                // Refresh
                const res = await window.api.customers.getById(c.id);
                if (res.success) {
                    setFullCustomer(res.data);
                    initEditData(res.data);
                }
            }
        } catch (err) {
            toast.error(err.message || 'Error al guardar');
        } finally {
            setSaving(false);
        }
    };

    const handleInviteToMobile = async () => {
        if (!c.email) {
            toast.error('El cliente necesita un email para recibir la invitación');
            return;
        }
        setMobileAction('invite');
        try {
            const gymId = (await window.api.license.getData())?.gym_id;
            if (!gymId) throw new Error('No se pudo obtener el ID del gimnasio');
            const customerName = `${c.first_name || ''} ${c.last_name || ''}`.trim();
            const res = await window.api.cloud.inviteToMobile(gymId, c.id, c.email, customerName);
            if (res.success && res.data?.success) {
                toast.success(res.data.message || 'Invitación enviada');
                await refreshMobileStatus();
                // Refresh the shared mobile-link map so the icon in the
                // customer list updates immediately (no Ctrl+R needed).
                await refreshMobileLinks?.();
            } else {
                toast.error(res.data?.message || res.error || 'Error al enviar invitación');
            }
        } catch (err) {
            toast.error(err.message || 'Error al enviar invitación');
        } finally {
            setMobileAction(null);
        }
    };

    const handleResetPassword = async () => {
        setMobileAction('reset');
        try {
            const gymId = (await window.api.license.getData())?.gym_id;
            if (!gymId) throw new Error('No se pudo obtener el ID del gimnasio');
            const res = await window.api.cloud.resetMobilePassword(gymId, c.id);
            const inner = res?.data ?? res;
            if (inner?.success) {
                toast.success(inner.message || 'Email de recuperación enviado');
                // No status change but keep the list fresh anyway in case
                // an external admin invited/revoked since we last refreshed.
                await refreshMobileLinks?.();
            } else {
                toast.error(inner?.error || 'Error al enviar email de recuperación');
            }
        } catch (err) {
            toast.error(err.message || 'Error al enviar email de recuperación');
        } finally {
            setMobileAction(null);
        }
    };

    const performRevokeAccess = async () => {
        setMobileAction('revoke');
        try {
            const gymId = (await window.api.license.getData())?.gym_id;
            if (!gymId) throw new Error('No se pudo obtener el ID del gimnasio');
            const res = await window.api.cloud.revokeMobileAccess(gymId, c.id);
            const inner = res?.data ?? res;
            if (inner?.success) {
                toast.success(inner.message || 'Acceso revocado');
                await refreshMobileStatus();
                await refreshMobileLinks?.();
            } else {
                toast.error(inner?.error || 'Error al revocar acceso');
            }
        } catch (err) {
            toast.error(err.message || 'Error al revocar acceso');
        } finally {
            setMobileAction(null);
        }
    };

    const handleRevokeAccess = () => {
        setConfirmModal({
            isOpen: true,
            title: 'Quitar acceso a la app móvil',
            type: 'danger',
            confirmText: 'Quitar acceso',
            message: (
                <div className="space-y-2">
                    <p>
                        ¿Quitar el acceso a la app móvil de{' '}
                        <strong className="text-white">{c.first_name} {c.last_name}</strong>?
                    </p>
                    <p className="text-sm text-slate-400">
                        El cliente dejará de ver este gimnasio en la app. Si tiene acceso a otros gimnasios,
                        esos no se verán afectados — su cuenta sigue intacta.
                    </p>
                </div>
            ),
            onConfirm: performRevokeAccess,
        });
    };

    const updateMedical = (field, value) => {
        setEditData(prev => ({
            ...prev,
            medical_info: { ...prev.medical_info, [field]: value }
        }));
    };

    let medInfo = c.medical_info;
    if (typeof medInfo === 'string') {
        try { medInfo = JSON.parse(medInfo); } catch (e) { medInfo = null; }
    }

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
                            {(c.first_name || '?')[0]}{(c.last_name || '?')[0]}
                        </div>
                        <div className="flex-1">
                            <h2 className="text-2xl font-bold text-white">
                                {c.first_name} {c.last_name}
                            </h2>
                            <div className="flex items-center gap-4 mt-2">
                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${c.active
                                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                    : 'bg-red-500/20 text-red-400 border border-red-500/30'
                                    }`}>
                                    <div className={`w-1.5 h-1.5 rounded-full ${c.active ? 'bg-emerald-400' : 'bg-red-400'}`} />
                                    {c.active ? 'Activo' : 'Inactivo'}
                                </span>
                                <span className="text-xs text-slate-500 flex items-center gap-1">
                                    <Calendar size={12} />
                                    Miembro desde {memberSince}
                                </span>
                                {c.dni && (
                                    <span className="text-xs text-slate-500 flex items-center gap-1">
                                        <FileText size={12} />
                                        {c.dni}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Tabs */}
                    <div className="flex gap-1 mt-5">
                        {TABS.filter(tab => tab.id !== 'app' || hasMobileApp).map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => { setActiveTab(tab.id); setEditing(false); }}
                                className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${activeTab === tab.id
                                    ? 'bg-white/10 text-white'
                                    : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
                                    }`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Content */}
                <div className="overflow-y-auto max-h-[calc(85vh-240px)] p-6 space-y-6">
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <div className="w-8 h-8 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
                        </div>
                    ) : activeTab === 'overview' ? (
                        <OverviewTab
                            customer={c}
                            payments={payments}
                            mesocycles={mesocycles}
                            membershipHistory={membershipHistory}
                            totalPaid={totalPaid}
                            activeMesos={activeMesos}
                            currentMeso={currentMeso}
                            monthsActive={monthsActive}
                        />
                    ) : activeTab === 'ficha' ? (
                        <FichaTab
                            customer={c}
                            medInfo={medInfo}
                            editing={editing}
                            editData={editData}
                            setEditData={setEditData}
                            updateMedical={updateMedical}
                        />
                    ) : (
                        <MobileAppTab
                            customer={c}
                            mobileStatus={mobileStatus}
                            loading={loadingMobile}
                            onInvite={handleInviteToMobile}
                            onResetPassword={handleResetPassword}
                            onRevokeAccess={handleRevokeAccess}
                            mobileAction={mobileAction}
                        />
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-white/5 bg-slate-900/50 flex justify-between items-center">
                    <button
                        onClick={onClose}
                        className="text-slate-400 hover:text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-white/5 transition-all"
                    >
                        Cerrar
                    </button>
                    <div className="flex gap-2">
                        {activeTab === 'ficha' && !editing && (
                            <>
                                <button
                                    onClick={handleExportGdpr}
                                    disabled={gdprBusy}
                                    title="Exportar todos los datos del cliente (RGPD)"
                                    className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border border-white/5 disabled:opacity-50"
                                >
                                    <FileText size={14} /> Exportar (RGPD)
                                </button>
                                <button
                                    onClick={handleAnonymizeGdpr}
                                    disabled={gdprBusy}
                                    title="Anonimizar: borra datos personales/médicos, conserva pagos (RGPD)"
                                    className="bg-red-500/10 hover:bg-red-600 text-red-400 hover:text-white px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border border-red-500/20 disabled:opacity-50"
                                >
                                    <ShieldOff size={14} /> Anonimizar
                                </button>
                                <button
                                    onClick={() => setEditing(true)}
                                    className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2"
                                >
                                    <Pencil size={14} />
                                    Editar Ficha
                                </button>
                            </>
                        )}
                        {activeTab === 'ficha' && editing && (
                            <>
                                <button
                                    onClick={() => { setEditing(false); initEditData(c); }}
                                    className="text-slate-400 hover:text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-white/5 transition-all"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleSaveProfile}
                                    disabled={saving}
                                    className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2 disabled:opacity-50"
                                >
                                    <Save size={14} />
                                    {saving ? 'Guardando...' : 'Guardar'}
                                </button>
                            </>
                        )}
                        {activeTab === 'overview' && (
                            <>
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
                            </>
                        )}
                    </div>
                </div>
            </div>

            <ConfirmationModal
                isOpen={confirmModal.isOpen}
                title={confirmModal.title}
                type={confirmModal.type}
                confirmText={confirmModal.confirmText}
                onClose={closeConfirm}
                onConfirm={() => {
                    closeConfirm();
                    confirmModal.onConfirm?.();
                }}
            >
                {confirmModal.message}
            </ConfirmationModal>
        </div>
    );
}

function OverviewTab({ customer, payments, mesocycles, membershipHistory, totalPaid, activeMesos, currentMeso, monthsActive }) {
    return (
        <>
            {/* Contact Info */}
            <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-800/50 rounded-xl p-4 border border-white/5 flex items-center gap-3">
                    <div className="p-2 bg-blue-500/10 rounded-lg">
                        <Mail size={16} className="text-blue-400" />
                    </div>
                    <div className="min-w-0">
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

            {customer.address && (
                <div className="bg-slate-800/50 rounded-xl p-4 border border-white/5 flex items-center gap-3">
                    <div className="p-2 bg-amber-500/10 rounded-lg">
                        <MapPin size={16} className="text-amber-400" />
                    </div>
                    <div>
                        <p className="text-[10px] uppercase font-bold text-slate-500 tracking-widest">Direccion</p>
                        <p className="text-sm text-white">{customer.address}</p>
                    </div>
                </div>
            )}

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
                            <span className="text-xs font-bold text-blue-400 bg-blue-500/10 px-2 py-1 rounded-lg">
                                {currentMeso.routines?.length || 0} rutinas
                            </span>
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
                    Historial de Membresia
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
                    Ultimos Pagos
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
    );
}

function FichaTab({ customer, medInfo, editing, editData, setEditData, updateMedical }) {
    // Render helper (NO sub-componente — declararlo dentro del padre desmonta
    // los inputs en cada render y pierde el foco al escribir).
    const renderInfoRow = ({ icon: Icon, color, label, value, editKey, type = 'text', step }) => (
        <div key={editKey || label} className="bg-slate-800/50 rounded-xl p-4 border border-white/5 flex items-center gap-3">
            <div className={`p-2 ${color} rounded-lg flex-shrink-0`}>
                <Icon size={16} className={color.replace('bg-', 'text-').replace('/10', '')} />
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-[10px] uppercase font-bold text-slate-500 tracking-widest">{label}</p>
                {editing && editKey ? (
                    <input
                        type={type}
                        step={step}
                        className="w-full bg-transparent text-sm text-white border-b border-white/20 focus:border-blue-500 outline-none py-1"
                        value={editData[editKey] || ''}
                        onChange={e => setEditData(prev => ({ ...prev, [editKey]: e.target.value }))}
                    />
                ) : (
                    <p className="text-sm text-white">{value || <span className="text-slate-600 italic">No registrado</span>}</p>
                )}
            </div>
        </div>
    );

    // Render helper (NO sub-componente — declararlo como componente dentro del padre
    // hace que React lo desmonte en cada render y los inputs pierdan el foco).
    const renderMedicalField = (label, field) => {
        const value = editing ? editData.medical_info?.[field] : (medInfo?.[field] || '');
        const hasValue = value && value.toLowerCase() !== 'no' && value.trim() !== '';

        return (
            <div key={field} className="bg-slate-800/30 rounded-xl p-4 border border-white/5">
                <p className="text-[10px] uppercase font-bold text-slate-500 tracking-widest mb-2">{label}</p>
                {editing ? (
                    <textarea
                        rows={2}
                        className="w-full bg-transparent text-sm text-white border border-white/10 rounded-lg p-2 focus:border-blue-500 outline-none resize-none"
                        value={editData.medical_info?.[field] || ''}
                        onChange={e => updateMedical(field, e.target.value)}
                    />
                ) : (
                    <p className={`text-sm ${hasValue ? 'text-amber-300' : 'text-slate-500'}`}>
                        {value || 'Sin observaciones'}
                    </p>
                )}
            </div>
        );
    };

    return (
        <div className="space-y-4">
            {/* Personal Data */}
            <h3 className="text-xs uppercase font-bold text-slate-400 tracking-widest flex items-center gap-2">
                <User size={14} />
                Datos Personales
            </h3>
            <div className="grid grid-cols-2 gap-3">
                {renderInfoRow({ icon: FileText, color: 'bg-blue-500/10', label: 'DNI / NIE', value: customer.dni, editKey: 'dni' })}
                {renderInfoRow({ icon: Calendar, color: 'bg-purple-500/10', label: 'Fecha de Nacimiento', value: customer.birth_date, editKey: 'birth_date', type: 'date' })}
            </div>
            {renderInfoRow({ icon: MapPin, color: 'bg-amber-500/10', label: 'Direccion', value: customer.address, editKey: 'address' })}
            <div className="grid grid-cols-2 gap-3">
                {renderInfoRow({ icon: Ruler, color: 'bg-cyan-500/10', label: 'Altura', value: customer.height_cm ? `${customer.height_cm} cm` : null, editKey: 'height_cm', type: 'number' })}
                {renderInfoRow({ icon: Weight, color: 'bg-orange-500/10', label: 'Peso', value: customer.weight_kg ? `${customer.weight_kg} kg` : null, editKey: 'weight_kg', type: 'number', step: '0.1' })}
            </div>

            {/* Medical Info */}
            <h3 className="text-xs uppercase font-bold text-slate-400 tracking-widest flex items-center gap-2 pt-2">
                <Heart size={14} />
                Informacion Medica
            </h3>
            <div className="grid grid-cols-2 gap-3">
                {renderMedicalField('Enfermedades', 'diseases')}
                {renderMedicalField('Lesiones', 'injuries')}
                {renderMedicalField('Alergias', 'allergies')}
                {renderMedicalField('Cirugias', 'surgeries')}
            </div>
        </div>
    );
}

function MobileAppTab({ customer, mobileStatus, loading, onInvite, onResetPassword, onRevokeAccess, mobileAction }) {
    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="w-8 h-8 border-2 border-violet-500/20 border-t-violet-500 rounded-full animate-spin" />
            </div>
        );
    }

    const status = mobileStatus || {};
    const isRegistered = status.registered === true;
    const isInvited = status.invited === true && !isRegistered;
    const linkedDate = status.linked_at ? new Date(status.linked_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' }) : null;
    const invitedDate = status.invited_at ? new Date(status.invited_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' }) : null;
    const busy = mobileAction !== null;

    return (
        <div className="space-y-6">
            {/* Registration Status card */}
            <div className={`rounded-xl p-5 border ${isRegistered
                ? 'bg-emerald-500/5 border-emerald-500/20'
                : isInvited
                ? 'bg-amber-500/5 border-amber-500/20'
                : 'bg-slate-800/30 border-white/5'}`}>
                <div className="flex items-start gap-4">
                    <div className={`p-3 rounded-xl ${isRegistered
                        ? 'bg-emerald-500/10'
                        : isInvited
                        ? 'bg-amber-500/10'
                        : 'bg-slate-700/30'}`}>
                        {isRegistered ? (
                            <CheckCircle2 size={24} className="text-emerald-400" />
                        ) : isInvited ? (
                            <Clock size={24} className="text-amber-400" />
                        ) : (
                            <XCircle size={24} className="text-slate-400" />
                        )}
                    </div>
                    <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                            <Smartphone size={16} className="text-slate-400" />
                            <h3 className="text-base font-bold text-white">Estado en la App Móvil</h3>
                        </div>
                        {isRegistered && (
                            <>
                                <p className="text-sm text-emerald-300 font-medium">Registrado y activo</p>
                                {status.auth_email && (
                                    <p className="text-xs text-slate-400 mt-1">
                                        Cuenta: <span className="text-emerald-300">{status.auth_email}</span>
                                    </p>
                                )}
                                {linkedDate && (
                                    <p className="text-xs text-slate-500 mt-1">Vinculado el {linkedDate}</p>
                                )}
                            </>
                        )}
                        {isInvited && (
                            <>
                                <p className="text-sm text-amber-300 font-medium">Invitación pendiente</p>
                                <p className="text-xs text-slate-400 mt-1">El cliente ha sido invitado pero aún no ha completado el registro.</p>
                                {invitedDate && (
                                    <p className="text-xs text-slate-500 mt-1">Invitado el {invitedDate}</p>
                                )}
                            </>
                        )}
                        {!isRegistered && !isInvited && (
                            <>
                                <p className="text-sm text-slate-300 font-medium">No registrado</p>
                                <p className="text-xs text-slate-400 mt-1">Este cliente todavía no tiene acceso a la app móvil.</p>
                            </>
                        )}
                        {status.error && (
                            <p className="text-xs text-red-400 mt-2">Error: {status.error}</p>
                        )}
                    </div>
                </div>
            </div>

            {/* Actions card */}
            <div className="bg-slate-800/30 rounded-xl border border-white/5 p-5">
                <h3 className="text-xs uppercase font-bold text-slate-400 tracking-widest mb-4 flex items-center gap-2">
                    <Smartphone size={14} />
                    Acciones
                </h3>

                {!customer.email && (
                    <div className="mb-4 bg-amber-500/5 border border-amber-500/20 rounded-lg p-3">
                        <p className="text-xs text-amber-300">
                            El cliente no tiene email registrado. Añádelo en la pestaña General para poder enviarle invitaciones o emails de recuperación.
                        </p>
                    </div>
                )}

                <div className="space-y-2">
                    {/* INVITE — visible when there's no link at all */}
                    {!isRegistered && !isInvited && (
                        <ActionButton
                            icon={Send}
                            label={mobileAction === 'invite' ? 'Enviando…' : 'Enviar invitación'}
                            description="Crea la cuenta del cliente y le envía un email para que establezca su contraseña."
                            onClick={onInvite}
                            disabled={busy || !customer.email}
                            color="violet"
                        />
                    )}

                    {/* RE-INVITE — visible when invited but not yet registered (resend) */}
                    {isInvited && (
                        <ActionButton
                            icon={Send}
                            label={mobileAction === 'invite' ? 'Reenviando…' : 'Reenviar invitación'}
                            description="Vuelve a enviar el email de invitación al cliente."
                            onClick={onInvite}
                            disabled={busy || !customer.email}
                            color="violet"
                        />
                    )}

                    {/* RESET PASSWORD — visible only when registered */}
                    {isRegistered && (
                        <ActionButton
                            icon={KeyRound}
                            label={mobileAction === 'reset' ? 'Enviando…' : 'Restablecer contraseña'}
                            description="Envía al cliente un email para crear una nueva contraseña."
                            onClick={onResetPassword}
                            disabled={busy}
                            color="blue"
                        />
                    )}

                    {/* REVOKE ACCESS — visible whenever there's any link (invited or registered) */}
                    {(isRegistered || isInvited) && (
                        <ActionButton
                            icon={ShieldOff}
                            label={mobileAction === 'revoke' ? 'Quitando acceso…' : 'Quitar acceso'}
                            description="Elimina el vínculo con este gimnasio. El cliente dejará de verlo en la app, pero conservará su cuenta para otros gimnasios."
                            onClick={onRevokeAccess}
                            disabled={busy}
                            color="red"
                        />
                    )}
                </div>
            </div>
        </div>
    );
}

function ActionButton({ icon: Icon, label, description, onClick, disabled, color }) {
    const palette = {
        violet: 'bg-violet-600 hover:bg-violet-500 text-white',
        blue: 'bg-blue-600 hover:bg-blue-500 text-white',
        red: 'bg-red-600/90 hover:bg-red-500 text-white',
    }[color] || 'bg-slate-700 hover:bg-slate-600 text-white';
    return (
        <div className="flex items-center justify-between gap-4 bg-slate-900/40 border border-white/5 rounded-lg p-3">
            <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-white">{label.replace(/…/g, '')}</p>
                <p className="text-xs text-slate-400 mt-0.5">{description}</p>
            </div>
            <button
                onClick={onClick}
                disabled={disabled}
                className={`shrink-0 px-3 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed ${palette}`}
            >
                <Icon size={14} />
                <span className="hidden sm:inline">{label}</span>
            </button>
        </div>
    );
}
