import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Layout, Plus, Edit2, Trash2, FileText } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import ConfirmationModal from '../../components/ui/ConfirmationModal';

export default function TemplateManager({ onEdit, onCreate }) {
    const toast = useToast();
    const [confirmModal, setConfirmModal] = React.useState({ isOpen: false, title: '', children: null, onConfirm: () => { }, type: 'info' });
    const queryClient = useQueryClient();
    const [daysFilter, setDaysFilter] = React.useState('all');

    // Fetch Templates
    const { data: templates = [], isLoading } = useQuery({
        queryKey: ['templates'],
        queryFn: async () => {
            const res = await window.api.training.getTemplates();
            const data = res.success ? res.data : (Array.isArray(res) ? res : []);
            return data;
        }
    });

    const deleteMutation = useMutation({
        mutationFn: async (id) => {
            await window.api.training.deleteMesocycle(id);
        },
        onSuccess: () => {
            queryClient.invalidateQueries(['templates']);
            toast.success('Plantilla eliminada correctamente');
        },
        onError: (error) => {
            toast.error('Error al eliminar la plantilla');
        }
    });

    // Unique day counts for filter options
    const availableDays = [...new Set(templates.map(t => t.days_per_week || t.routines?.length || 0))].sort((a, b) => a - b);

    const filteredTemplates = templates.filter(tpl => {
        if (daysFilter === 'all') return true;
        const days = tpl.days_per_week || tpl.routines?.length || 0;
        return days === parseInt(daysFilter);
    });

    return (
        <div className="flex flex-col h-full">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-1">
                        <Layout className="text-emerald-400" />
                        Biblioteca de Plantillas
                    </h3>
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                        <span>Filtrar por días:</span>
                        <select
                            value={daysFilter}
                            onChange={(e) => setDaysFilter(e.target.value)}
                            className="bg-slate-900 border border-white/10 rounded-lg px-2 py-1 focus:outline-none focus:border-emerald-500 text-slate-200"
                        >
                            <option value="all">Todos</option>
                            {availableDays.map(d => (
                                <option key={d} value={d}>{d} Días</option>
                            ))}
                        </select>
                    </div>
                </div>

                <button
                    onClick={onCreate}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl flex items-center gap-2 font-bold transition-all shadow-lg shadow-emerald-900/20"
                >
                    <Plus size={18} />
                    Nueva Plantilla
                </button>
            </div>

            <div className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar">
                {isLoading ? (
                    <div className="text-slate-500 text-center py-10">Cargando plantillas...</div>
                ) : filteredTemplates.length === 0 ? (
                    <div className="text-center py-12 bg-slate-900/30 rounded-2xl border border-dashed border-white/5">
                        <FileText className="mx-auto text-slate-600 mb-2" size={32} />
                        <p className="text-slate-500 font-medium">No se encontraron plantillas.</p>
                        {templates.length === 0 && (
                            <p className="text-xs text-slate-600 mt-1">Crea una para agilizar tu trabajo.</p>
                        )}
                    </div>
                ) : (
                    filteredTemplates.map(tpl => (
                        <div
                            key={tpl.id}
                            className="bg-slate-900/50 rounded-xl p-4 border border-white/5 hover:border-emerald-500/30 transition-all flex items-center justify-between group"
                        >
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-emerald-500/10 rounded-lg text-emerald-400">
                                    <FileText size={20} />
                                </div>
                                <div>
                                    <h4 className="font-bold text-white text-base">{tpl.name}</h4>
                                    <p className="text-xs text-slate-500 flex items-center gap-2">
                                        <span className="bg-slate-800 px-2 py-0.5 rounded text-slate-300">
                                            {tpl.days_per_week || tpl.routines?.length || 0} Días
                                        </span>
                                        <span>•</span>
                                        <span>{tpl.routines?.length || 0} rutinas</span>
                                    </p>
                                </div>
                            </div>

                            <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                    onClick={() => onEdit(tpl)}
                                    className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white"
                                    title="Editar Plantilla"
                                >
                                    <Edit2 size={16} />
                                </button>
                                <button
                                    onClick={() => {
                                        setConfirmModal({
                                            isOpen: true,
                                            title: 'Eliminar Plantilla',
                                            children: `¿Estás seguro de que quieres eliminar la plantilla "${tpl.name}"? Esta acción no se puede deshacer.`,
                                            type: 'danger',
                                            confirmText: 'Eliminar',
                                            onConfirm: () => deleteMutation.mutate(tpl.id)
                                        });
                                    }}
                                    className="p-2 hover:bg-red-500/20 rounded-lg text-slate-400 hover:text-red-400"
                                    title="Borrar"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>

            <ConfirmationModal
                isOpen={confirmModal.isOpen}
                title={confirmModal.title}
                onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                onConfirm={confirmModal.onConfirm}
                type={confirmModal.type}
                confirmText={confirmModal.confirmText || 'Confirmar'}
            >
                {confirmModal.children}
            </ConfirmationModal>
        </div>
    );
}
