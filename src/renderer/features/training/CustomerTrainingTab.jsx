import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Calendar, ChevronRight, Plus, AlertCircle, CheckCircle, Clock, Trash2, FileSpreadsheet, RefreshCw } from 'lucide-react';
import ConfirmationModal from '../../components/ui/ConfirmationModal';
import { useGym } from '../../context/GymContext';

export default function CustomerTrainingTab({ customerId, onNewMesocycle, onSelectMesocycle, readOnly = false }) {

    const queryClient = useQueryClient();
    const { customers } = useGym();
    const customer = customers?.find(c => c.id === customerId); // eslint-disable-line @typescript-eslint/no-unused-vars
    const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', children: null, onConfirm: () => { }, type: 'info' });

    // Helper to open modal
    const requestConfirm = ({ title, message, type = 'info', confirmText, onConfirm }) => {
        setConfirmModal({
            isOpen: true,
            title,
            children: message,
            type,
            confirmText,
            onConfirm
        });
    };

    // Fetch Mesocycles
    const { data: mesocycles = [], isLoading, isFetching, refetch } = useQuery({
        queryKey: ['mesocycles', customerId],
        queryFn: async () => {
            const res = await window.api.training.getMesocycles(customerId);
            return res.success ? res.data : [];
        },
        enabled: !!customerId
    });

    const handleRefresh = () => refetch();

    // Delete Mutation
    const deleteMutation = useMutation({
        mutationFn: async (mesoId) => await window.api.training.deleteMesocycle(mesoId),
        onSuccess: () => {
            queryClient.invalidateQueries(['mesocycles', customerId]);
        }
    });

    const getStatusConfig = (status) => {
        switch (status) {
            case 'active': return { color: 'border-l-emerald-500', badge: 'bg-emerald-500/10 text-emerald-400', icon: CheckCircle, label: 'Activo' };
            case 'future': return { color: 'border-l-blue-500', badge: 'bg-blue-500/10 text-blue-400', icon: Clock, label: 'Futuro' };
            case 'expired': return { color: 'border-l-slate-600', badge: 'bg-slate-700/50 text-slate-400', icon: Calendar, label: 'Finalizado' };
            default: return { color: 'border-l-slate-600', badge: 'bg-slate-800 text-slate-400', icon: Calendar, label: 'Archivado' };
        }
    };

    const handleExport = async (meso, e) => {
        e.stopPropagation();
        try {
            const fullMesoRes = await window.api.training.getMesocycle(meso.id);
            if (!fullMesoRes.success) return alert('Error al obtener datos del ciclo');

            const fullMeso = fullMesoRes.data;
            const exportData = {
                ...fullMeso,
                isTemplate: false,
                customerId: customerId,
                routines: fullMeso.routines
            };

            const result = await window.api.training.exportRoutine(exportData);

            if (result.success) {
                // Success feedback
                // alert('Rutina exportada correctamente en: ' + result.filePath);
            } else if (!result.cancelled) {
                alert('Error al exportar: ' + result.error);
            }
        } catch (err) {
            console.error(err);
            alert('Error inesperado al exportar.');
        }
    };

    const handleNewMesocycle = () => {
        // Check if there's an active mesocycle
        // Prioritize the one that ends later if multiple exist
        const activeMesocycles = mesocycles
            .filter(m => m.status === 'active')
            .sort((a, b) => {
                const dateA = a.end_date ? new Date(a.end_date) : new Date('9999-12-31');
                const dateB = b.end_date ? new Date(b.end_date) : new Date('9999-12-31');
                return dateB - dateA;
            });

        const activeMesocycle = activeMesocycles[0];

        if (activeMesocycle) {
            requestConfirm({
                title: 'Nuevo Mesociclo',
                message: (
                    <div className="space-y-3">
                        <p>⚠️ <strong>Ya existe un mesociclo activo:</strong> "{activeMesocycle.name}"</p>
                        <p className="text-sm text-slate-400">
                            Fecha: {new Date(activeMesocycle.start_date).toLocaleDateString()} - {activeMesocycle.end_date ? new Date(activeMesocycle.end_date).toLocaleDateString() : 'Indefinido'}
                        </p>
                        <p>¿Deseas crear uno nuevo? (Puedes crearlo como una excepción si las fechas coinciden).</p>
                    </div>
                ),
                type: 'warning',
                onConfirm: onNewMesocycle
            });
            return;
        }

        onNewMesocycle();
    };

    const handleDelete = async (meso, e) => {
        e.stopPropagation();

        requestConfirm({
            title: 'Eliminar Mesociclo',
            message: `¿Estás seguro de que deseas eliminar "${meso.name}"? Esta acción borrará todas las rutinas y ejercicios asociados.`,
            type: 'danger',
            confirmText: 'Eliminar Definitivamente',
            onConfirm: async () => {
                try {
                    await deleteMutation.mutateAsync(meso.id);
                } catch (err) {
                    console.error('Error deleting mesocycle:', err);
                    alert('Error al eliminar el mesociclo. Por favor, intenta de nuevo.');
                }
            }
        });
    };

    if (!customerId) return <div className="text-slate-500 p-4">Selecciona un cliente para ver su historial.</div>;

    return (
        <div className="flex flex-col h-full relative">
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <Calendar className="text-blue-400" />
                    Historial de Mesociclos
                </h3>
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleRefresh}
                        disabled={isFetching}
                        className="bg-slate-800/60 hover:bg-slate-700 text-slate-300 hover:text-white px-3 py-2 rounded-xl flex items-center gap-2 font-medium transition-all border border-white/5 disabled:opacity-50 disabled:cursor-wait"
                        title="Actualizar lista"
                    >
                        <RefreshCw size={16} className={isFetching ? 'animate-spin' : ''} />
                        Actualizar
                    </button>
                    {!readOnly && (
                        <button
                            onClick={handleNewMesocycle}
                            className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl flex items-center gap-2 font-bold transition-all shadow-lg shadow-blue-900/20"
                        >
                            <Plus size={18} />
                            Nuevo Mesociclo
                        </button>
                    )}
                </div>
            </div>

            <div className="flex-1 overflow-y-auto pr-2 space-y-4">
                {isLoading ? (
                    <div className="text-slate-500 text-center py-10">Cargando historial...</div>
                ) : mesocycles.length === 0 ? (
                    <div className="text-center py-12 bg-slate-900/30 rounded-2xl border border-dashed border-white/5">
                        <AlertCircle className="mx-auto text-slate-600 mb-2" size={32} />
                        <p className="text-slate-500 font-medium">Este cliente no tiene planes de entrenamiento.</p>
                        {!readOnly ? (
                            <button onClick={handleNewMesocycle} className="text-blue-400 hover:text-blue-300 text-sm mt-2 font-bold">
                                Crear el primero
                            </button>
                        ) : (
                            <p className="text-slate-600 text-sm mt-2">No existen más mesociclos.</p>
                        )}
                    </div>
                ) : (
                    mesocycles.map(meso => {
                        const style = getStatusConfig(meso.status);
                        return (
                            <div
                                key={meso.id}
                                onClick={() => onSelectMesocycle(meso)}
                                className={`bg-slate-900/50 rounded-xl p-4 border border-white/5 border-l-4 ${style.color} hover:bg-slate-800 transition-all cursor-pointer group flex items-center justify-between`}
                            >
                                <div>
                                    <div className="flex items-center gap-3 mb-1">
                                        <h4 className="font-bold text-white text-lg">{meso.name}</h4>
                                        <span className={`text-xs px-2 py-0.5 rounded-full flex items-center gap-1 font-bold uppercase tracking-wider ${style.badge}`}>
                                            <style.icon size={10} />
                                            {style.label}
                                        </span>
                                    </div>
                                    <p className="text-sm text-slate-400 flex items-center gap-2">
                                        <Calendar size={14} />
                                        {new Date(meso.start_date).toLocaleDateString()}
                                        {' -> '}
                                        {meso.end_date ? new Date(meso.end_date).toLocaleDateString() : 'Indefinido'}
                                    </p>
                                </div>
                                <div className="flex items-center gap-2">
                                    {!readOnly && (
                                        <button
                                            onClick={(e) => handleDelete(meso, e)}
                                            className="p-2 hover:bg-red-700 bg-slate-800/50 rounded-full text-red-400 hover:text-white transition-colors border border-white/5"
                                            title="Eliminar Mesociclo"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    )}
                                    <button
                                        onClick={(e) => handleExport(meso, e)}
                                        className="p-2 hover:bg-emerald-600 bg-slate-800/50 rounded-full text-emerald-400 hover:text-white transition-colors border border-white/5"
                                        title="Exportar a Excel"
                                    >
                                        <FileSpreadsheet size={18} />
                                    </button>
                                    <div className="bg-slate-950 p-2 rounded-full text-slate-500 group-hover:text-white group-hover:bg-blue-600 transition-all">
                                        <ChevronRight size={20} />
                                    </div>
                                </div>
                            </div>
                        );
                    })
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

