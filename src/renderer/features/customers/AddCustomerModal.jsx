import React, { useState, useEffect } from 'react';
import { X, Check, ChevronDown, ChevronUp } from 'lucide-react';
import { useGym } from '../../context/GymContext';
import { useLanguage } from '../../context/LanguageContext';
import { useToast } from '../../context/ToastContext';
import LoadingSpinner from '../../components/ui/LoadingSpinner';

export default function AddCustomerModal({ isOpen, onClose, customerToEdit = null }) {
    const { addCustomer, updateCustomer, tariffs = [] } = useGym();
    const { t } = useLanguage();
    const toast = useToast();

    const initialForm = {
        first_name: '',
        last_name: '',
        email: '',
        phone: '',
        tariff_id: null,
        dni: '',
        address: '',
        height_cm: '',
        weight_kg: '',
        birth_date: '',
        medical_info: { diseases: '', injuries: '', allergies: '', surgeries: '' },
        mobile_show_schedule: 1,
    };

    const [formData, setFormData] = useState(initialForm);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [showProfile, setShowProfile] = useState(false);
    const [showMedical, setShowMedical] = useState(false);

    useEffect(() => {
        if (isOpen) {
            if (customerToEdit) {
                let medInfo = customerToEdit.medical_info;
                if (typeof medInfo === 'string') {
                    try { medInfo = JSON.parse(medInfo); } catch (e) { medInfo = null; }
                }

                setFormData({
                    first_name: customerToEdit.first_name,
                    last_name: customerToEdit.last_name,
                    email: customerToEdit.email,
                    phone: customerToEdit.phone || '',
                    tariff_id: customerToEdit.tariff_id,
                    dni: customerToEdit.dni || '',
                    address: customerToEdit.address || '',
                    height_cm: customerToEdit.height_cm || '',
                    weight_kg: customerToEdit.weight_kg || '',
                    birth_date: customerToEdit.birth_date || '',
                    medical_info: medInfo || { diseases: '', injuries: '', allergies: '', surgeries: '' },
                    mobile_show_schedule: customerToEdit.mobile_show_schedule != null ? customerToEdit.mobile_show_schedule : 1,
                });
                setShowProfile(false);
                setShowMedical(false);
            } else {
                setFormData(initialForm);
                setShowProfile(false);
                setShowMedical(false);
            }
            setError('');
        }
    }, [isOpen, customerToEdit]);

    if (!isOpen) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const submitData = {
                ...formData,
                height_cm: formData.height_cm ? Number(formData.height_cm) : null,
                weight_kg: formData.weight_kg ? Number(formData.weight_kg) : null,
            };

            let success;
            if (customerToEdit) {
                success = await updateCustomer(customerToEdit.id, submitData);
                if (success) toast.success(`Cliente "${formData.first_name} ${formData.last_name}" actualizado correctamente`);
            } else {
                success = await addCustomer(submitData);
                if (success) toast.success(`Cliente "${formData.first_name} ${formData.last_name}" creado correctamente`);
            }

            if (success) {
                onClose();
            } else {
                const errorMsg = 'Error al guardar. El email podria estar duplicado.';
                setError(errorMsg);
                toast.error(errorMsg);
            }
        } catch (err) {
            const errorMsg = err.message || 'Ocurrio un error inesperado';
            setError(errorMsg);
            toast.error(errorMsg);
        } finally {
            setLoading(false);
        }
    };

    const updateMedical = (field, value) => {
        setFormData(prev => ({
            ...prev,
            medical_info: { ...prev.medical_info, [field]: value }
        }));
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm transition-all" onClick={onClose} />

            <div className="relative w-full max-w-lg max-h-[90vh] bg-slate-900 border border-white/10 rounded-2xl shadow-2xl transform transition-all animate-in fade-in zoom-in-95 duration-200 flex flex-col">
                <div className="p-6 pb-0">
                    <button onClick={onClose} className="absolute top-4 right-4 text-slate-500 hover:text-white transition-colors">
                        <X size={20} />
                    </button>

                    <h2 className="text-xl font-bold text-white mb-1">
                        {customerToEdit ? t('modals.editMember') : t('modals.addMember')}
                    </h2>
                    <p className="text-sm text-slate-400 mb-6">
                        {customerToEdit ? t('modals.editDescription') : t('modals.addDescription')}
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
                    <div className="overflow-y-auto flex-1 px-6 space-y-4">
                        {/* Basic Info */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-slate-400 uppercase">{t('modals.fields.firstName')}</label>
                                <input
                                    required
                                    type="text"
                                    className="w-full glass-input text-white placeholder:text-slate-600 focus:border-blue-500"
                                    placeholder="Juan"
                                    value={formData.first_name}
                                    onChange={e => setFormData({ ...formData, first_name: e.target.value })}
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-slate-400 uppercase">{t('modals.fields.lastName')}</label>
                                <input
                                    required
                                    type="text"
                                    className="w-full glass-input text-white placeholder:text-slate-600 focus:border-blue-500"
                                    placeholder="Perez"
                                    value={formData.last_name}
                                    onChange={e => setFormData({ ...formData, last_name: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs font-medium text-slate-400 uppercase">
                                {t('modals.fields.email')} <span className="text-slate-600 normal-case">(opcional)</span>
                            </label>
                            <input
                                type="email"
                                className="w-full glass-input text-white placeholder:text-slate-600 focus:border-blue-500"
                                placeholder="juan.perez@example.com"
                                value={formData.email || ''}
                                onChange={e => setFormData({ ...formData, email: e.target.value })}
                            />
                            <p className="text-[10px] text-slate-500 mt-1">
                                Sin email no podrá enviar rutinas por Google Drive.
                            </p>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-slate-400 uppercase">{t('modals.fields.phone')}</label>
                                <input
                                    type="tel"
                                    className="w-full glass-input text-white placeholder:text-slate-600 focus:border-blue-500"
                                    placeholder="+34 600 ..."
                                    value={formData.phone}
                                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-slate-400 uppercase">{t('modals.fields.tariff')}</label>
                                <select
                                    className="w-full glass-input text-white bg-slate-950/50 appearance-none focus:border-blue-500"
                                    value={formData.tariff_id || ''}
                                    onChange={e => setFormData({ ...formData, tariff_id: e.target.value ? Number(e.target.value) : null })}
                                >
                                    <option value="">Sin tarifa</option>
                                    {tariffs.map(t => (
                                        <option key={t.id} value={t.id}>{t.name} - {t.amount}€</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Collapsible Profile Section */}
                        <button
                            type="button"
                            onClick={() => setShowProfile(!showProfile)}
                            className="w-full flex items-center justify-between py-3 px-4 bg-slate-800/50 rounded-xl border border-white/5 hover:bg-slate-800/80 transition-colors"
                        >
                            <span className="text-xs font-bold text-slate-300 uppercase tracking-widest">Ficha Personal y Medica</span>
                            {showProfile ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                        </button>

                        {showProfile && (
                            <div className="space-y-4 animate-in slide-in-from-top-2 duration-200">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <label className="text-xs font-medium text-slate-400 uppercase">DNI / NIE</label>
                                        <input
                                            type="text"
                                            className="w-full glass-input text-white placeholder:text-slate-600 focus:border-blue-500"
                                            placeholder="12345678A"
                                            value={formData.dni}
                                            onChange={e => setFormData({ ...formData, dni: e.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-medium text-slate-400 uppercase">Fecha de Nacimiento</label>
                                        <input
                                            type="date"
                                            className="w-full glass-input text-white focus:border-blue-500"
                                            value={formData.birth_date}
                                            onChange={e => setFormData({ ...formData, birth_date: e.target.value })}
                                        />
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-slate-400 uppercase">Direccion</label>
                                    <input
                                        type="text"
                                        className="w-full glass-input text-white placeholder:text-slate-600 focus:border-blue-500"
                                        placeholder="Calle, numero, piso, CP, ciudad"
                                        value={formData.address}
                                        onChange={e => setFormData({ ...formData, address: e.target.value })}
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <label className="text-xs font-medium text-slate-400 uppercase">Altura (cm)</label>
                                        <input
                                            type="number"
                                            className="w-full glass-input text-white placeholder:text-slate-600 focus:border-blue-500"
                                            placeholder="175"
                                            value={formData.height_cm}
                                            onChange={e => setFormData({ ...formData, height_cm: e.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-medium text-slate-400 uppercase">Peso (kg)</label>
                                        <input
                                            type="number"
                                            step="0.1"
                                            className="w-full glass-input text-white placeholder:text-slate-600 focus:border-blue-500"
                                            placeholder="75"
                                            value={formData.weight_kg}
                                            onChange={e => setFormData({ ...formData, weight_kg: e.target.value })}
                                        />
                                    </div>
                                </div>

                                <div className="border-t border-white/5 pt-4">
                                    <button
                                        type="button"
                                        onClick={() => setShowMedical(!showMedical)}
                                        className="w-full flex items-center justify-between py-2 px-3 -mx-1 rounded-lg hover:bg-white/5 transition-colors mb-2"
                                    >
                                        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Informacion Medica</span>
                                        {showMedical ? <ChevronUp size={14} className="text-slate-500" /> : <ChevronDown size={14} className="text-slate-500" />}
                                    </button>
                                    {showMedical && (
                                        <div className="space-y-3 animate-in slide-in-from-top-2 duration-200">
                                            <div className="space-y-1">
                                                <label className="text-xs font-medium text-slate-500">Enfermedades</label>
                                                <textarea
                                                    rows={2}
                                                    className="w-full glass-input text-white placeholder:text-slate-600 focus:border-blue-500 resize-none"
                                                    placeholder="Ninguna"
                                                    value={formData.medical_info.diseases}
                                                    onChange={e => updateMedical('diseases', e.target.value)}
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-xs font-medium text-slate-500">Lesiones</label>
                                                <textarea
                                                    rows={2}
                                                    className="w-full glass-input text-white placeholder:text-slate-600 focus:border-blue-500 resize-none"
                                                    placeholder="Ninguna"
                                                    value={formData.medical_info.injuries}
                                                    onChange={e => updateMedical('injuries', e.target.value)}
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-xs font-medium text-slate-500">Alergias</label>
                                                <textarea
                                                    rows={2}
                                                    className="w-full glass-input text-white placeholder:text-slate-600 focus:border-blue-500 resize-none"
                                                    placeholder="Ninguna"
                                                    value={formData.medical_info.allergies}
                                                    onChange={e => updateMedical('allergies', e.target.value)}
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-xs font-medium text-slate-500">Cirugias</label>
                                                <textarea
                                                    rows={2}
                                                    className="w-full glass-input text-white placeholder:text-slate-600 focus:border-blue-500 resize-none"
                                                    placeholder="Ninguna"
                                                    value={formData.medical_info.surgeries}
                                                    onChange={e => updateMedical('surgeries', e.target.value)}
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* App móvil — feature toggles */}
                        <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-slate-950/40 border border-white/5">
                            <div className="min-w-0">
                                <p className="text-sm font-semibold text-white">Horario y clases en la app</p>
                                <p className="text-[11px] text-slate-500">Desactívalo para clientes que solo quieren sus rutinas (no acuden al gimnasio).</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setFormData({ ...formData, mobile_show_schedule: formData.mobile_show_schedule ? 0 : 1 })}
                                className={`shrink-0 relative w-12 h-7 rounded-full transition-all ${formData.mobile_show_schedule ? 'bg-emerald-500' : 'bg-slate-700'}`}
                                title={formData.mobile_show_schedule ? 'Visible para el cliente' : 'Oculto para el cliente'}
                            >
                                <span className={`absolute top-1 left-1 w-5 h-5 rounded-full bg-white transition-transform ${formData.mobile_show_schedule ? 'translate-x-5' : ''}`} />
                            </button>
                        </div>

                        {error && (
                            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                                {error}
                            </div>
                        )}
                    </div>

                    <div className="p-6 pt-4 flex justify-end gap-3 border-t border-white/5">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 rounded-lg text-slate-300 hover:text-white hover:bg-white/5 transition-colors"
                        >
                            {t('modals.cancel')}
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-6 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium shadow-lg shadow-blue-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 min-w-[120px] justify-center"
                        >
                            {loading ? (
                                <LoadingSpinner size="sm" color="white" />
                            ) : (
                                <><Check size={18} /> {customerToEdit ? t('modals.update') : t('modals.save')}</>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
