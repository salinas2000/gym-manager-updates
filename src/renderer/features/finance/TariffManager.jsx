import React, { useState } from 'react';
import { useGym } from '../../context/GymContext';
import { useLanguage } from '../../context/LanguageContext';
import { Plus, Trash2, X, CreditCard, Sparkles, Check, Edit2 } from 'lucide-react';
import { cn } from '../../lib/utils';

const COLORS = [
    { name: 'Obsidian', from: 'from-slate-700', to: 'to-slate-900', border: 'border-slate-600', id: 'obsidian' },
    { name: 'Emerald', from: 'from-emerald-600', to: 'to-emerald-900', border: 'border-emerald-500', id: 'emerald' },
    { name: 'Blue', from: 'from-blue-600', to: 'to-blue-900', border: 'border-blue-500', id: 'blue' },
    { name: 'Purple', from: 'from-purple-600', to: 'to-purple-900', border: 'border-purple-500', id: 'purple' },
    { name: 'Rose', from: 'from-rose-600', to: 'to-rose-900', border: 'border-rose-500', id: 'rose' },
    { name: 'Amber', from: 'from-amber-600', to: 'to-amber-900', border: 'border-amber-500', id: 'amber' },
];

export default function TariffManager() {
    const { tariffs, addTariff, updateTariff, deleteTariff } = useGym();
    const { t } = useLanguage();

    // Form State
    const [editingId, setEditingId] = useState(null);
    const [name, setName] = useState('');
    const [amount, setAmount] = useState('');
    const [colorId, setColorId] = useState('emerald');
    const [loading, setLoading] = useState(false);

    const handleEdit = (tariff) => {
        setEditingId(tariff.id);
        setName(tariff.name);
        setAmount(tariff.amount.toString());
        // Load saved theme or fallback to emerald if undefined
        setColorId(tariff.color_theme || 'emerald');
    };

    const handleCancelEdit = () => {
        setEditingId(null);
        setName('');
        setAmount('');
        setColorId('emerald');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!name || !amount) return;

        setLoading(true);

        let success;
        const payload = {
            name,
            amount: parseFloat(amount),
            color_theme: colorId
        };

        if (editingId) {
            success = await updateTariff(editingId, payload);
        } else {
            success = await addTariff(payload);
        }

        if (success) {
            handleCancelEdit(); // Reset form
        }

        setLoading(false);
    };

    // Helper to find color object from ID string
    const getTheme = (id) => COLORS.find(c => c.id === id) || COLORS[1]; // Fallback emerald
    const selectedColor = getTheme(colorId);

    return (
        <div className="w-full h-full bg-slate-900 rounded-3xl border border-white/10 shadow-2xl flex overflow-hidden">

            {/* LEFT COLUMN: EDITOR */}
            <div className="w-1/3 border-r border-white/5 p-8 flex flex-col relative bg-slate-900/50">
                <div className="mb-8">
                    <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                        {editingId ? <Edit2 className="text-yellow-400" /> : <Sparkles className="text-blue-400" />}
                        {editingId ? t('tariffs.editPlan') : t('tariffs.designPlan')}
                    </h2>
                    <p className="text-slate-400 text-sm">
                        {editingId ? t('tariffs.editPlanDescription') : t('tariffs.designPlanDescription')}
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6 flex-1">
                    <div className="space-y-2">
                        <label className="text-xs uppercase font-medium text-slate-500">{t('tariffs.form.name')}</label>
                        <input
                            type="text"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            placeholder={t('tariffs.form.namePlaceholder')}
                            className={cn(
                                "w-full bg-slate-800/50 border rounded-xl px-4 py-3 text-white placeholder:text-slate-600 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all",
                                editingId ? "border-yellow-500/20" : "border-white/10"
                            )}
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs uppercase font-medium text-slate-500">{t('tariffs.form.price')}</label>
                        <input
                            type="number"
                            value={amount}
                            onChange={e => setAmount(e.target.value)}
                            placeholder="0.00"
                            className={cn(
                                "w-full bg-slate-800/50 border rounded-xl px-4 py-3 text-white placeholder:text-slate-600 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all font-mono",
                                editingId ? "border-yellow-500/20" : "border-white/10"
                            )}
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs uppercase font-medium text-slate-500">{t('tariffs.form.theme')}</label>
                        <div className="flex gap-3">
                            {COLORS.map((c) => (
                                <button
                                    key={c.id}
                                    type="button"
                                    onClick={() => setColorId(c.id)}
                                    className={cn(
                                        "w-8 h-8 rounded-full bg-gradient-to-br transition-transform hover:scale-110",
                                        c.from, c.to,
                                        colorId === c.id ? "ring-2 ring-white scale-110" : "opacity-70 hover:opacity-100"
                                    )}
                                />
                            ))}
                        </div>
                    </div>

                    {/* Preview Card */}
                    <div className="mt-8">
                        <label className="text-xs uppercase font-medium text-slate-500 mb-2 block">{t('tariffs.form.preview')}</label>
                        <div className={cn(
                            "w-full aspect-[1.586] rounded-2xl bg-gradient-to-br p-6 shadow-xl relative overflow-hidden transition-all duration-500 border border-white/10",
                            selectedColor.from, selectedColor.to
                        )}>
                            {/* Shimmer Effect */}
                            <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-3xl transform translate-x-10 -translate-y-10" />
                            <div className="absolute bottom-0 left-0 w-24 h-24 bg-black/10 rounded-full blur-2xl transform -translate-x-5 translate-y-5" />

                            <div className="relative z-10 flex flex-col h-full justify-between">
                                <div className="flex justify-between items-start">
                                    <CreditCard className="text-white/80" size={24} />
                                    <span className="font-mono text-white/90 font-bold text-lg">
                                        {amount ? `${parseFloat(amount).toFixed(2)}€` : '0.00€'}
                                        <span className="text-xs font-normal opacity-70"> {t('common.perMonthAbbr')}</span>
                                    </span>
                                </div>

                                <div>
                                    <p className="text-white/60 text-xs uppercase tracking-widest mb-1">{t('tariffs.preview.membership')}</p>
                                    <h3 className="text-white font-bold text-xl tracking-wide truncate">
                                        {name || t('tariffs.preview.newPlan')}
                                    </h3>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="pt-4 flex flex-col gap-2">
                        <button
                            type="submit"
                            disabled={!name || !amount || loading}
                            className={cn(
                                "w-full py-3 rounded-xl  text-slate-950 font-bold hover:brightness-110 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2",
                                editingId ? "bg-yellow-400" : "bg-white"
                            )}
                        >
                            {loading ? t('common.processing') : (editingId ? <><Check size={18} /> {t('tariffs.updatePlan')}</> : <><Check size={18} /> {t('tariffs.createPlan')}</>)}
                        </button>

                        {editingId && (
                            <button
                                type="button"
                                onClick={handleCancelEdit}
                                className="w-full py-3 rounded-xl bg-slate-800 text-slate-400 font-bold hover:bg-slate-700 transition-colors"
                            >
                                {t('tariffs.cancelEdit')}
                            </button>
                        )}
                    </div>
                </form>
            </div>

            {/* RIGHT COLUMN: GALLERY */}
            <div className="w-2/3 p-8 overflow-y-auto bg-slate-950/30">
                <h2 className="text-xl font-bold text-white mb-6">{t('tariffs.activePlans')}</h2>

                <div className="grid grid-cols-2 gap-4">
                    {tariffs.map((tItem) => {
                        const theme = getTheme(tItem.color_theme);
                        const isEditing = tItem.id === editingId;

                        return (
                            <div
                                key={tItem.id}
                                onClick={() => handleEdit(tItem)}
                                className={cn(
                                    "relative group aspect-[1.586] rounded-2xl bg-gradient-to-br p-6 border transition-all hover:scale-[1.02] hover:shadow-2xl cursor-pointer",
                                    theme.from, theme.to,
                                    isEditing ? "ring-4 ring-yellow-400/50 border-yellow-400 scale-[1.02]" : "border-white/5"
                                )}
                            >
                                {/* Delete Button (Stop propagation to avoid triggering edit) */}
                                <button
                                    onClick={(e) => { e.stopPropagation(); deleteTariff(tItem.id); }}
                                    className="absolute top-4 right-4 p-2 bg-black/20 hover:bg-red-500/80 rounded-full text-white/70 hover:text-white transition-all opacity-0 group-hover:opacity-100"
                                >
                                    <Trash2 size={16} />
                                </button>

                                <div className="flex flex-col h-full justify-between">
                                    <div className="flex justify-between items-start">
                                        <div className="px-2 py-1 bg-white/10 backdrop-blur-md rounded-lg text-xs font-medium text-white/90">
                                            {t('common.id')}: {tItem.id}
                                        </div>
                                        <span className="font-mono text-white font-bold text-2xl">
                                            {tItem.amount}€
                                        </span>
                                    </div>

                                    <div>
                                        <p className="text-white/60 text-xs uppercase tracking-widest mb-1">{t('tariffs.preview.tier')}</p>
                                        <h3 className="text-white font-bold text-2xl tracking-wide truncate">
                                            {tItem.name}
                                        </h3>
                                    </div>
                                </div>
                            </div>
                        );
                    })}

                    {/* Empty State */}
                    {tariffs.length === 0 && (
                        <div className="col-span-2 h-40 flex flex-col items-center justify-center border-2 border-dashed border-slate-800 rounded-2xl text-slate-600">
                            <CreditCard size={32} className="mb-2 opacity-50" />
                            <p>{t('tariffs.empty')}</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
