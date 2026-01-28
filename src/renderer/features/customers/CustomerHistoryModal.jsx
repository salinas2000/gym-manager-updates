import React, { useEffect, useState } from 'react';
import { X, Save, Trash2, Clock, Calendar } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useGym } from '../../context/GymContext';
import { useToast } from '../../context/ToastContext';
import ConfirmationModal from '../../components/ui/ConfirmationModal';

export default function CustomerHistoryModal({ isOpen, onClose, customer }) {
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(false);
    const { refreshData } = useGym();
    const toast = useToast();
    const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', children: null, onConfirm: () => { }, type: 'info' });

    // Load initial history
    useEffect(() => {
        if (isOpen && customer) {
            loadHistory();
        }
    }, [isOpen, customer]);

    const loadHistory = async () => {
        setLoading(true);
        try {
            const res = await window.api.customers.getHistory(customer.id);
            if (res.success) {
                setHistory(res.data);
            }
        } catch (error) {
            console.error("Failed to load history", error);
        } finally {
            setLoading(false);
        }
    };

    const handleUpdate = async (id, startDate, endDate) => {
        try {
            // endDate from input might be empty string '' if active
            const res = await window.api.memberships.update(id, {
                start_date: startDate,
                end_date: endDate || null
            });
            if (res.success) {
                loadHistory();
                refreshData(); // Refresh global list to reflect status changes
            }
        } catch (error) {
            console.error("Failed to update membership", error);
        }
    };

    const handleDelete = async (id) => {
        setConfirmModal({
            isOpen: true,
            title: 'Eliminar Periodo',
            children: '¿Estás seguro de que quieres eliminar este periodo? Esto podría cambiar el estado del usuario.',
            type: 'danger',
            confirmText: 'Eliminar',
            onConfirm: async () => {
                try {
                    const res = await window.api.memberships.delete(id);
                    if (res.success) {
                        loadHistory();
                        refreshData();
                        toast.success('Periodo eliminado correctamente');
                    } else {
                        toast.error('Error al eliminar el periodo');
                    }
                } catch (error) {
                    console.error("Failed to delete membership", error);
                    toast.error('Error inesperado al eliminar');
                }
            }
        });
    };

    if (!isOpen || !customer) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
                className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
                onClick={onClose}
            ></div>

            <div className="relative w-full max-w-2xl bg-slate-900 border border-white/10 rounded-2xl shadow-2xl p-6 flex flex-col max-h-[80vh]">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-slate-500 hover:text-white transition-colors"
                >
                    <X size={20} />
                </button>

                <div className="mb-6 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-400">
                        <Clock size={24} />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-white">Historial de Altas/Bajas</h2>
                        <p className="text-slate-400 text-sm">Editar periodos de {customer.first_name}</p>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3 pr-2">
                    {loading ? (
                        <div className="text-center p-8 text-slate-500">Cargando historial...</div>
                    ) : history.length === 0 ? (
                        <div className="text-center p-8 text-slate-500">No hay historial disponible.</div>
                    ) : (
                        history.map((record) => (
                            <MembershipRow
                                key={record.id}
                                record={record}
                                onUpdate={handleUpdate}
                                onDelete={handleDelete}
                            />
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
        </div>
    );
}

function MembershipRow({ record, onUpdate, onDelete }) {
    // Local state for inputs
    const [startDate, setStartDate] = useState(record.start_date ? record.start_date.split('T')[0] : '');
    const [endDate, setEndDate] = useState(record.end_date ? record.end_date.split('T')[0] : '');
    const [isModified, setIsModified] = useState(false);

    // Initial values to detect changes
    const initialStart = record.start_date ? record.start_date.split('T')[0] : '';
    const initialEnd = record.end_date ? record.end_date.split('T')[0] : '';

    useEffect(() => {
        const changed = startDate !== initialStart || endDate !== initialEnd;
        setIsModified(changed);
    }, [startDate, endDate, initialStart, initialEnd]);

    const handleSave = () => {
        onUpdate(record.id, new Date(startDate).toISOString(), endDate ? new Date(endDate).toISOString() : null);
        setIsModified(false);
    };

    return (
        <div className="group flex items-center gap-4 p-4 rounded-xl bg-slate-950/50 border border-white/5 hover:border-white/10 transition-colors">

            {/* Start Date */}
            <div className="flex-1 space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
                    <Calendar size={10} /> Inicio
                </label>
                <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full bg-transparent text-white text-sm font-mono focus:outline-none focus:text-indigo-400 transition-colors"
                />
            </div>

            {/* Arrow */}
            <div className="text-slate-600">→</div>

            {/* End Date */}
            <div className="flex-1 space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
                    <Calendar size={10} /> Fin
                </label>
                <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className={cn(
                        "w-full bg-transparent text-sm font-mono focus:outline-none transition-colors",
                        !endDate ? "text-emerald-400 font-bold" : "text-white focus:text-indigo-400"
                    )}
                />
                {!endDate && <span className="text-[10px] text-emerald-500/50 absolute -bottom-3 disabled pointer-events-none">ACTIVO</span>}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 pl-4 border-l border-white/5">
                {isModified && (
                    <button
                        onClick={handleSave}
                        className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500 hover:text-white transition-all animate-in zoom-in"
                        title="Guardar Cambios"
                    >
                        <Save size={16} />
                    </button>
                )}

                <button
                    onClick={() => onDelete(record.id)}
                    className="p-2 rounded-lg text-slate-600 hover:bg-red-500/10 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                    title="Eliminar registro"
                >
                    <Trash2 size={16} />
                </button>
            </div>
        </div>
    );
}
