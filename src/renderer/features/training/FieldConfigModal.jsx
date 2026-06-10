import React from 'react';
import { X, Settings2, FileSpreadsheet, Info } from 'lucide-react';
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

// Mirror of constants/field-catalog.js::TRACKING_TYPES (renderer can't require a
// main-process module). `metrics` = the values the client logs per set in the
// app for that type; this is what actually drives which inputs appear.
const TRACKING_TYPES = [
    { key: 'strength',        label: 'Fuerza',                icon: '🏋', sub: 'peso · reps', metrics: ['weight', 'reps', 'rpe'] },
    { key: 'cardio_distance', label: 'Cardio distancia',      icon: '🏃', sub: 'tiempo · distancia · ritmo', metrics: ['duration', 'distance', 'pace'] },
    { key: 'cardio_time',     label: 'Cardio tiempo',         icon: '⏱', sub: 'solo tiempo', metrics: ['duration'] },
    { key: 'time_only',       label: 'Isométrico',            icon: '🧘', sub: 'solo tiempo', metrics: ['duration'] },
    { key: 'reps_only',       label: 'Peso corporal',         icon: '💪', sub: 'solo reps', metrics: ['reps', 'rpe'] },
];

// Which catalog field each tracking-type metric corresponds to. Used to show
// "Lo rellena el cliente" accurately: e.g. cardio logs tiempo/distancia/ritmo
// even though those fields are catalog loggable:false (they're logged via the
// exercise type, not as a generic per-set field).
const METRIC_FIELD = { weight: 'peso', reps: 'repeticiones', rpe: 'rpe', duration: 'tiempo', distance: 'distancia', pace: 'ritmo' };

// Does this field apply to a given tracking type? (universal = no modalities)
const fieldInType = (field, typeKey) =>
    !field.modalities || field.modalities.length === 0 || field.modalities.includes(typeKey);

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
                modalities: Array.isArray(f.modalities) ? f.modalities : null,
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

    // Render one field row inside a type group. `typeKey` null = "comunes".
    const renderFieldRow = (entry, typeKey) => {
        const cfg = configByKey.get(entry.key);
        const isActive = cfg?.is_active ?? 1;
        const isMandatory = cfg?.is_mandatory_in_template ?? 0;
        // The client fills this field in the app if it's a logged metric of the
        // type (e.g. cardio logs tiempo/distancia/ritmo) or a generic per-set field.
        const metricFields = typeKey
            ? new Set((TRACKING_TYPES.find(t => t.key === typeKey)?.metrics || []).map(m => METRIC_FIELD[m]).filter(Boolean))
            : new Set();
        const clientFills = metricFields.has(entry.key) || entry.loggable;

        return (
            <div
                key={`${typeKey || 'common'}-${entry.key}`}
                className={`flex items-center gap-2.5 p-2.5 rounded-lg border transition-all ${
                    isActive ? 'bg-slate-950/50 border-white/5' : 'bg-slate-950/30 border-white/5 opacity-60'
                }`}
            >
                <div className="min-w-0 flex-1">
                    <p className="font-bold text-white text-sm leading-tight">{entry.label}</p>
                    <p className="text-[10px] text-slate-500 leading-snug">{entry.desc}</p>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                    {entry.prescribable && (
                        <span title="El entrenador pone un objetivo en el mesociclo" className="px-2 py-0.5 rounded-md text-[9px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20 cursor-default">
                            Objetivo
                        </span>
                    )}
                    {clientFills && (
                        <span title="El cliente lo registra en la app móvil" className="px-2 py-0.5 rounded-md text-[9px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 cursor-default">
                            Rellenable
                        </span>
                    )}
                </div>

                <button
                    onClick={() => persistFlags(entry, { is_active: isActive ? 0 : 1 })}
                    title={isActive ? 'Activo en tu gimnasio — pulsa para ocultarlo' : 'Inactivo — pulsa para activarlo'}
                    className={`shrink-0 px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
                        isActive
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-slate-800 text-slate-500 border border-transparent'
                    }`}
                >
                    {isActive ? 'Activo' : 'Inactivo'}
                </button>

                <button
                    onClick={() => persistFlags(entry, { is_mandatory_in_template: isMandatory ? 0 : 1 })}
                    disabled={!isActive}
                    title={isMandatory ? 'Se exporta a Excel' : 'No se exporta a Excel'}
                    className={`shrink-0 w-7 h-7 flex items-center justify-center rounded-lg transition-all ${
                        !isActive
                            ? 'opacity-30 cursor-not-allowed text-slate-600'
                            : isMandatory
                                ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                                : 'bg-slate-800 text-slate-500'
                    }`}
                >
                    <FileSpreadsheet size={12} />
                </button>
            </div>
        );
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
                            Campos agrupados por tipo de ejercicio: ves qué campos tiene cada tipo.
                            <span className="text-slate-500"> <span className="text-blue-400 font-semibold">Objetivo</span> = lo pone el entrenador · <span className="text-emerald-400 font-semibold">Rellenable</span> = lo registra el cliente en la app.</span>
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
                        <div className="space-y-5">
                            {/* Comunes — universal fields (no modalities) shown once */}
                            {(() => {
                                const commons = CATALOG.filter((f) => !f.modalities || f.modalities.length === 0);
                                if (commons.length === 0) return null;
                                return (
                                    <section>
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="text-base">📋</span>
                                            <h3 className="text-sm font-black text-white">
                                                Comunes <span className="text-slate-500 font-medium">· todos los tipos</span>
                                            </h3>
                                        </div>
                                        <div className="space-y-1.5">
                                            {commons.map((f) => renderFieldRow(f, null))}
                                        </div>
                                    </section>
                                );
                            })()}

                            {/* One group per tracking type */}
                            {TRACKING_TYPES.map((t) => {
                                const fields = CATALOG.filter((f) => f.modalities && f.modalities.length > 0 && f.modalities.includes(t.key));
                                if (fields.length === 0) return null;
                                return (
                                    <section key={t.key}>
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="text-base">{t.icon}</span>
                                            <h3 className="text-sm font-black text-white">
                                                {t.label} <span className="text-slate-500 font-medium">· {t.sub}</span>
                                            </h3>
                                        </div>
                                        <div className="space-y-1.5">
                                            {fields.map((f) => renderFieldRow(f, t.key))}
                                        </div>
                                    </section>
                                );
                            })}

                            <div className="mt-2 p-3 bg-indigo-500/5 border border-indigo-500/10 rounded-lg flex items-start gap-2">
                                <Info size={14} className="text-indigo-400 shrink-0 mt-0.5" />
                                <p className="text-[11px] text-indigo-200/70 leading-relaxed">
                                    Un mismo campo puede estar en varios tipos (ej. <strong>Tiempo</strong> en los de cardio):
                                    activarlo o desactivarlo afecta a todos. El icono <FileSpreadsheet size={11} className="inline mb-0.5" /> exporta
                                    el campo al Excel. Los campos comunes (Series, RPE, Descanso, Notas) aplican a cualquier tipo.
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
