import React from 'react';
import { X, Settings2, FileSpreadsheet, Smartphone, Info, Pencil } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '../../context/ToastContext';
import LoadingSpinner from '../../components/ui/LoadingSpinner';

/**
 * Catálogo canónico — viene del main process via IPC:
 *   src/main/constants/field-catalog.js
 * Cargado al abrir el modal mediante window.api.training.getCatalog().
 * Mantener UNA SOLA copia en desktop (esta carga vía IPC, no duplicación).
 * El móvil sí tiene una copia espejo porque es otro binario.
 */

export default function FieldConfigModal({ isOpen, onClose }) {
    const toast = useToast();
    const queryClient = useQueryClient();

    const { data: configs = [], isLoading } = useQuery({
        queryKey: ['exercise-field-configs'],
        queryFn: async () => {
            const res = await window.api.training.getFieldConfigs();
            return res.success ? res.data : [];
        },
        enabled: isOpen,
    });

    // Single-source catalog from the main process. Replaces the previous
    // hand-synced inline array that drifted across three files.
    const { data: catalog = [], isLoading: catalogLoading } = useQuery({
        queryKey: ['exercise-field-catalog'],
        queryFn: async () => {
            const res = await window.api.training.getCatalog();
            // Handler returns the array directly (not wrapped in {success, data}).
            const list = Array.isArray(res) ? res : (res?.data || []);
            return list.map((f) => ({
                key: f.key,
                label: f.label,
                type: f.type,
                prescribable: !!f.prescribable,
                loggable: !!f.loggable,
                desc: f.description || '',
            }));
        },
        enabled: isOpen,
        staleTime: Infinity, // catalog is immutable for the session
    });
    const CATALOG = catalog;
    const showSpinner = isLoading || catalogLoading;

    const updateConfig = useMutation({
        mutationFn: ({ key, data }) => window.api.training.updateFieldConfig(key, data),
        onSuccess: (res) => {
            if (res.success) {
                queryClient.invalidateQueries(['exercise-field-configs']);
            } else {
                toast.error('Error al actualizar configuración');
            }
        },
    });

    if (!isOpen) return null;

    const configByKey = new Map(configs.map(c => [c.field_key.toLowerCase(), c]));

    const persistFlags = (entry, patch) => {
        const cfg = configByKey.get(entry.key) || {};
        updateConfig.mutate({
            key: entry.key,
            data: {
                ...cfg,
                field_key: entry.key,
                label: entry.label,
                type: entry.type,
                is_active: cfg.is_active ?? 1,
                is_mandatory_in_template: cfg.is_mandatory_in_template ?? 0,
                is_loggable: entry.loggable ? 1 : 0,
                is_prescribable: entry.prescribable ? 1 : 0,
                options: null,
                ...patch,
            },
        });
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
            <div className="bg-slate-900 w-full max-w-4xl rounded-2xl border border-white/10 shadow-2xl flex flex-col animate-in fade-in zoom-in duration-200">

                {/* HEAD */}
                <div className="p-6 border-b border-white/10 flex justify-between items-center bg-slate-800/50 rounded-t-2xl">
                    <div>
                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                            <Settings2 className="text-indigo-500" />
                            Catálogo de campos del ejercicio
                        </h2>
                        <p className="text-xs text-slate-400 mt-1">
                            Catálogo fijo. Eliges qué campos están activos en tu gimnasio y cuáles van al Excel.
                            <span className="text-slate-500"> El rol "Prescribir" y "Rellenable" viene definido por el campo.</span>
                        </p>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-white">
                        <X size={24} />
                    </button>
                </div>

                {/* BODY */}
                <div className="p-6 max-h-[60vh] overflow-y-auto">
                    {showSpinner ? (
                        <div className="py-12 flex justify-center"><LoadingSpinner /></div>
                    ) : (
                        <div className="space-y-2">
                            <div className="grid grid-cols-12 gap-3 px-4 py-2 border-b border-white/5 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                                <div className="col-span-5 text-left">Campo</div>
                                <div className="col-span-2 text-center">Activo</div>
                                <div className="col-span-2 text-center flex items-center justify-center gap-1">
                                    <Pencil size={11} /> Prescribir
                                </div>
                                <div className="col-span-2 text-center flex items-center justify-center gap-1">
                                    <Smartphone size={11} /> Rellenable
                                </div>
                                <div className="col-span-1 text-center">
                                    <FileSpreadsheet size={11} className="inline" />
                                </div>
                            </div>

                            {CATALOG.map((entry) => {
                                const cfg = configByKey.get(entry.key);
                                const isActive = cfg?.is_active ?? 1;
                                const isMandatory = cfg?.is_mandatory_in_template ?? 0;

                                return (
                                    <div
                                        key={entry.key}
                                        className={`p-3 rounded-xl border transition-all ${
                                            isActive
                                                ? 'bg-slate-950/50 border-white/5 hover:border-indigo-500/30'
                                                : 'bg-slate-950/30 border-white/5 opacity-70'
                                        }`}
                                    >
                                        <div className="grid grid-cols-12 gap-3 items-center">
                                            <div className="col-span-5 min-w-0">
                                                <p className="font-bold text-white text-sm">{entry.label}</p>
                                                <p className="text-[10px] text-slate-500">{entry.desc}</p>
                                            </div>

                                            {/* Active */}
                                            <div className="col-span-2 flex justify-center">
                                                <button
                                                    onClick={() => persistFlags(entry, { is_active: isActive ? 0 : 1 })}
                                                    className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all ${
                                                        isActive
                                                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                                            : 'bg-slate-800 text-slate-500 border border-transparent'
                                                    }`}
                                                >
                                                    {isActive ? 'Activo' : 'Inactivo'}
                                                </button>
                                            </div>

                                            {/* Prescribable (locked) */}
                                            <div className="col-span-2 flex justify-center">
                                                <span
                                                    title={entry.prescribable
                                                        ? 'El entrenador lo prescribe en el editor de mesociclos'
                                                        : 'No se prescribe — es puramente del cliente'}
                                                    className={`px-2 py-1.5 rounded-lg text-[10px] font-bold cursor-default ${
                                                        entry.prescribable
                                                            ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                                                            : 'bg-slate-800 text-slate-500 border border-white/5'
                                                    }`}
                                                >
                                                    {entry.prescribable ? 'Sí' : 'No'}
                                                </span>
                                            </div>

                                            {/* Loggable (locked) */}
                                            <div className="col-span-2 flex justify-center">
                                                <span
                                                    title={entry.loggable
                                                        ? 'El cliente lo rellena una vez por serie en la app móvil'
                                                        : 'Sólo informativo en la app móvil'}
                                                    className={`px-2 py-1.5 rounded-lg text-[10px] font-bold cursor-default ${
                                                        entry.loggable
                                                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                                            : 'bg-slate-800 text-slate-500 border border-white/5'
                                                    }`}
                                                >
                                                    {entry.loggable ? 'Sí' : 'No'}
                                                </span>
                                            </div>

                                            {/* Excel toggle */}
                                            <div className="col-span-1 flex justify-center">
                                                <button
                                                    onClick={() => persistFlags(entry, { is_mandatory_in_template: isMandatory ? 0 : 1 })}
                                                    disabled={!isActive}
                                                    title={isMandatory ? 'Se exporta a Excel' : 'No se exporta'}
                                                    className={`px-2 py-1.5 rounded-lg text-[10px] font-bold transition-all ${
                                                        !isActive
                                                            ? 'opacity-30 cursor-not-allowed'
                                                            : isMandatory
                                                                ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                                                                : 'bg-slate-800 text-slate-500 border border-transparent'
                                                    }`}
                                                >
                                                    {isMandatory ? 'Sí' : 'No'}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}

                            <div className="mt-4 p-3 bg-indigo-500/5 border border-indigo-500/10 rounded-lg flex items-start gap-2">
                                <Info size={14} className="text-indigo-400 shrink-0 mt-0.5" />
                                <p className="text-[11px] text-indigo-200/70 leading-relaxed">
                                    Algunos campos como Repeticiones, RPE, RIR o Peso se prescriben Y se rellenan: el entrenador
                                    pone un objetivo (ej. <strong>10-12</strong>) y el cliente registra el real (ej. <strong>11</strong>) en cada serie.
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                {/* FOOTER */}
                <div className="p-6 border-t border-white/10 flex justify-end">
                    <button
                        onClick={onClose}
                        className="bg-slate-800 hover:bg-slate-700 text-white px-6 py-2 rounded-xl font-bold transition-all border border-white/5 active:scale-95"
                    >
                        Cerrar
                    </button>
                </div>
            </div>
        </div>
    );
}
