import React, { useState, useEffect } from 'react';
import { X, Check } from 'lucide-react';
import { useGym } from '../../context/GymContext';
import { useLanguage } from '../../context/LanguageContext';
import { useToast } from '../../context/ToastContext';
import { cn } from '../../lib/utils';
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
        tariff_id: null
    };

    const [formData, setFormData] = useState(initialForm);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (isOpen) {
            if (customerToEdit) {
                setFormData({
                    first_name: customerToEdit.first_name,
                    last_name: customerToEdit.last_name,
                    email: customerToEdit.email,
                    phone: customerToEdit.phone || '',
                    tariff_id: customerToEdit.tariff_id
                });
            } else {
                setFormData(initialForm);
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
            let success;
            if (customerToEdit) {
                success = await updateCustomer(customerToEdit.id, formData);
                if (success) {
                    toast.success(`Cliente "${formData.first_name} ${formData.last_name}" actualizado correctamente`);
                }
            } else {
                success = await addCustomer(formData);
                if (success) {
                    toast.success(`Cliente "${formData.first_name} ${formData.last_name}" creado correctamente`);
                }
            }

            if (success) {
                onClose();
            } else {
                const errorMsg = 'Error al guardar. El email podría estar duplicado.';
                setError(errorMsg);
                toast.error(errorMsg);
            }
        } catch (err) {
            const errorMsg = err.message || 'Ocurrió un error inesperado';
            setError(errorMsg);
            toast.error(errorMsg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm transition-all"
                onClick={onClose}
            ></div>

            {/* Modal */}
            <div className="relative w-full max-w-md bg-slate-900 border border-white/10 rounded-2xl shadow-2xl p-6 transform transition-all animate-in fade-in zoom-in-95 duration-200">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-slate-500 hover:text-white transition-colors"
                >
                    <X size={20} />
                </button>

                <h2 className="text-xl font-bold text-white mb-1">
                    {customerToEdit ? t('modals.editMember') : t('modals.addMember')}
                </h2>
                <p className="text-sm text-slate-400 mb-6">
                    {customerToEdit ? t('modals.editDescription') : t('modals.addDescription')}
                </p>

                <form onSubmit={handleSubmit} className="space-y-4">
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
                        <label className="text-xs font-medium text-slate-400 uppercase">{t('modals.fields.email')}</label>
                        <input
                            required
                            type="email"
                            className="w-full glass-input text-white placeholder:text-slate-600 focus:border-blue-500"
                            placeholder="juan.perez@example.com"
                            value={formData.email}
                            onChange={e => setFormData({ ...formData, email: e.target.value })}
                        />
                    </div>

                    <div className="space-y-1">
                        <label className="text-xs font-medium text-slate-400 uppercase">{t('modals.fields.phone')}</label>
                        <input
                            type="tel"
                            className="w-full glass-input text-white placeholder:text-slate-600 focus:border-blue-500"
                            placeholder="+54 9 11 ..."
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
                            <option value="">No Tariff</option>
                            {tariffs.map(t => (
                                <option key={t.id} value={t.id}>{t.name} - {t.amount}€</option>
                            ))}
                        </select>
                    </div>

                    {error && (
                        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                            {error}
                        </div>
                    )}

                    <div className="pt-4 flex justify-end gap-3">
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
