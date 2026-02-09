import React from 'react';
import { Columns, Plus, Trash2 } from 'lucide-react';
import { cn } from '../../../lib/utils';
import ControlSection from './ControlSection';
import { useToast } from '../../../context/ToastContext';

function FieldToggle({ active, onClick, label }) {
    return (
        <button
            onClick={onClick}
            className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-lg border text-[9px] font-black uppercase transition-all",
                active ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" : "bg-slate-900/50 border-white/5 text-slate-600"
            )}
        >
            <div className={cn("w-1.5 h-1.5 rounded-full", active ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]" : "bg-slate-700")} />
            {label}
        </button>
    );
}

export default function FieldsTab({ config, setConfig }) {
    const toast = useToast();

    const toggleColumn = (key) => {
        setConfig(prev => ({
            ...prev,
            visibleColumns: { ...prev.visibleColumns, [key]: !prev.visibleColumns[key] }
        }));
    };

    const addCustomColumn = () => {
        if (config.customColumns.length >= 2) {
            toast.warning('Máximo 2 campos extra permitidos');
            return;
        }
        const name = prompt('Nombre del campo (ej: Tempo, Fase):');
        if (name) {
            setConfig(prev => ({
                ...prev,
                customColumns: [...prev.customColumns, { id: Date.now(), name }]
            }));
        }
    };

    const deleteCustomColumn = (id) => {
        setConfig(prev => ({
            ...prev,
            customColumns: prev.customColumns.filter(c => c.id !== id)
        }));
    };

    return (
        <div className="space-y-4">
            <ControlSection title="Columnas Opcionales" icon={Columns}>
                <div className="flex flex-wrap gap-2">
                    <FieldToggle active={config.visibleColumns.rpe} onClick={() => toggleColumn('rpe')} label="RPE" />
                    <FieldToggle active={config.visibleColumns.rest} onClick={() => toggleColumn('rest')} label="Descanso" />
                    <FieldToggle active={config.visibleColumns.weight} onClick={() => toggleColumn('weight')} label="Peso" />
                    <FieldToggle active={config.visibleColumns.next} onClick={() => toggleColumn('next')} label="Proyección" />
                </div>
            </ControlSection>

            <ControlSection title="Campos Personalizados" icon={Plus}>
                <div className="space-y-2">
                    {config.customColumns.map(col => (
                        <div key={col.id} className="flex items-center justify-between p-2 bg-slate-900/50 rounded-lg border border-white/5">
                            <span className="text-xs text-white">{col.name}</span>
                            <button
                                onClick={() => deleteCustomColumn(col.id)}
                                className="text-red-400 hover:text-red-300 transition-colors"
                            >
                                <Trash2 size={14} />
                            </button>
                        </div>
                    ))}
                    {config.customColumns.length < 2 && (
                        <button
                            onClick={addCustomColumn}
                            className="w-full flex items-center justify-center gap-2 p-2 bg-slate-900/30 hover:bg-slate-800/50 rounded-lg border border-dashed border-white/10 text-slate-500 hover:text-white text-xs transition-all"
                        >
                            <Plus size={14} /> Añadir Campo
                        </button>
                    )}
                </div>
            </ControlSection>
        </div>
    );
}
