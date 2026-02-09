import React, { useState, useRef } from 'react';
import { X, Save, Check, AlertCircle, Settings2, Plus, Trash2, ChevronDown, Trash } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '../../context/ToastContext';
import LoadingSpinner from '../../components/ui/LoadingSpinner';

export default function FieldConfigModal({ isOpen, onClose }) {
    const toast = useToast();
    const queryClient = useQueryClient();
    const labelInputRef = useRef(null);

    // Form and UI state
    const [newFieldLabel, setNewFieldLabel] = useState('');
    const [newFieldType, setNewFieldType] = useState('text');
    const [newFieldOptions, setNewFieldOptions] = useState([]);
    const [currentOption, setCurrentOption] = useState('');

    // Deletion confirmation state
    const [fieldToDelete, setFieldToDelete] = useState(null);

    const { data: configs = [], isLoading } = useQuery({
        queryKey: ['exercise-field-configs'],
        queryFn: async () => {
            const res = await window.api.training.getFieldConfigs();
            return res.success ? res.data : [];
        },
        enabled: isOpen
    });

    const updateConfig = useMutation({
        mutationFn: ({ key, data }) => window.api.training.updateFieldConfig(key, data),
        onSuccess: (res) => {
            if (res.success) {
                queryClient.invalidateQueries(['exercise-field-configs']);
            } else {
                toast.error('Error al actualizar configuración');
            }
        }
    });

    const addConfig = useMutation({
        mutationFn: ({ label, type, options }) => window.api.training.addFieldConfig(label, type, options),
        onSuccess: (res) => {
            if (res.success) {
                queryClient.invalidateQueries(['exercise-field-configs']);
                setNewFieldLabel('');
                setNewFieldOptions([]);
                toast.success('Campo añadido');
                // Auto-focus back to name for rapid entry
                labelInputRef.current?.focus();
            } else {
                toast.error('Error al añadir campo');
            }
        }
    });

    const deleteConfig = useMutation({
        mutationFn: (key) => window.api.training.deleteFieldConfig(key),
        onSuccess: (res) => {
            if (res.success) {
                queryClient.invalidateQueries(['exercise-field-configs']);
                queryClient.invalidateQueries(['exercise-field-configs-all']);
                queryClient.invalidateQueries(['exercises']);
                queryClient.invalidateQueries(['templates']);
                toast.success('Campo eliminado');
                setFieldToDelete(null);
            } else {
                toast.error('Error al eliminar campo');
            }
        }
    });

    if (!isOpen) return null;

    const handleAddOption = () => {
        if (currentOption.trim() && !newFieldOptions.includes(currentOption.trim())) {
            setNewFieldOptions([...newFieldOptions, currentOption.trim()]);
            setCurrentOption('');
        }
    };

    const handleRemoveOption = (opt) => {
        setNewFieldOptions(newFieldOptions.filter(o => o !== opt));
    };

    const handleAddField = (e) => {
        e.preventDefault();
        if (!newFieldLabel.trim()) return;
        addConfig.mutate({
            label: newFieldLabel,
            type: newFieldType,
            options: newFieldType === 'select' ? newFieldOptions : null
        });
    };

    const handleToggleActive = (config) => {
        updateConfig.mutate({
            key: config.field_key,
            data: { ...config, is_active: !config.is_active }
        });
    };

    const handleToggleMandatory = (config) => {
        updateConfig.mutate({
            key: config.field_key,
            data: { ...config, is_mandatory_in_template: !config.is_mandatory_in_template }
        });
    };

    const handleUpdateOptions = (config, newOptions) => {
        updateConfig.mutate({
            key: config.field_key,
            data: { ...config, options: newOptions }
        });
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
            <div className="bg-slate-900 w-full max-w-2xl rounded-2xl border border-white/10 shadow-2xl flex flex-col animate-in fade-in zoom-in duration-200">

                {/* HEAD */}
                <div className="p-6 border-b border-white/10 flex justify-between items-center bg-slate-800/50 rounded-t-2xl">
                    <div>
                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                            <Settings2 className="text-indigo-500" />
                            Configuración de Campos
                        </h2>
                        <p className="text-xs text-slate-400 mt-1">Define qué información solicitar en cada ejercicio y qué columnas incluir en el Excel.</p>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-white">
                        <X size={24} />
                    </button>
                </div>

                {/* NEW FIELD FORM */}
                <form onSubmit={handleAddField} className="p-6 bg-slate-950/30 border-b border-white/5 flex gap-3 items-end">
                    <div className="flex-1">
                        <label className="text-[10px] font-bold text-slate-500 mb-1.5 block uppercase tracking-wider">Nombre del Campo</label>
                        <input
                            ref={labelInputRef}
                            type="text"
                            value={newFieldLabel}
                            onChange={(e) => setNewFieldLabel(e.target.value)}
                            className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-2 text-white text-sm outline-none focus:border-indigo-500 transition-all font-medium placeholder:text-slate-600"
                            placeholder="Ej: Maquinaria, Tempo..."
                        />
                    </div>
                    <div className="w-40">
                        <label className="text-[10px] font-bold text-slate-500 mb-1.5 block uppercase tracking-wider">Tipo</label>
                        <div className="relative">
                            <select
                                value={newFieldType}
                                onChange={(e) => setNewFieldType(e.target.value)}
                                className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-white text-sm outline-none focus:border-indigo-500 transition-all appearance-none pr-10"
                            >
                                <option value="text">Texto</option>
                                <option value="number">Número</option>
                                <option value="select">Desplegable</option>
                            </select>
                            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" size={16} />
                        </div>
                    </div>
                    <button
                        type="submit"
                        disabled={!newFieldLabel.trim() || addConfig.isPending || (newFieldType === 'select' && newFieldOptions.length === 0)}
                        className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-30 disabled:cursor-not-allowed text-white px-4 py-2 rounded-xl transition-all h-[42px] flex items-center gap-2 font-bold"
                    >
                        <Plus size={18} />
                        Añadir
                    </button>
                </form>

                {/* OPTIONS MANAGEMENT (Only for New Select) */}
                {newFieldType === 'select' && (
                    <div className="px-6 py-4 bg-indigo-500/5 border-b border-white/5 animate-in slide-in-from-top duration-300">
                        <label className="text-[10px] font-bold text-indigo-400 mb-2 block uppercase tracking-wider">Opciones del Nuevo Desplegable</label>
                        <div className="flex gap-2 mb-3">
                            <input
                                type="text"
                                value={currentOption}
                                onChange={(e) => setCurrentOption(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddOption())}
                                className="flex-1 bg-slate-900/50 border border-indigo-500/20 rounded-lg px-3 py-1.5 text-white text-xs outline-none focus:border-indigo-500 transition-all"
                                placeholder="Escribe una opción y pulsa Enter..."
                            />
                            <button
                                type="button"
                                onClick={handleAddOption}
                                className="bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500 hover:text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
                            >
                                Añadir
                            </button>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {newFieldOptions.map(opt => (
                                <span key={opt} className="bg-slate-800 text-slate-300 px-2 py-1 rounded-md text-[10px] font-bold border border-white/5 flex items-center gap-2 group">
                                    {opt}
                                    <button
                                        type="button"
                                        onClick={() => handleRemoveOption(opt)}
                                        className="text-slate-500 hover:text-red-400"
                                    >
                                        <X size={10} />
                                    </button>
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                {/* BODY: List of existing fields */}
                <div className="p-6 max-h-[50vh] overflow-y-auto relative">
                    {isLoading ? (
                        <div className="py-12 flex justify-center"><LoadingSpinner /></div>
                    ) : (
                        <div className="space-y-4">
                            <div className="grid grid-cols-12 gap-4 px-4 py-2 border-b border-white/5 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                                <div className="col-span-6 text-left">Campo</div>
                                <div className="col-span-3 text-center">Estado</div>
                                <div className="col-span-2 text-center">Excel</div>
                                <div className="col-span-1"></div>
                            </div>

                            {configs.map(config => (
                                <div key={config.field_key} className="flex flex-col p-3 rounded-xl bg-slate-950/50 border border-white/5 hover:border-indigo-500/30 transition-all group">
                                    <div className="grid grid-cols-12 gap-4 items-center">
                                        <div className="col-span-6 min-w-0">
                                            <p className="font-bold text-white truncate">{config.label}</p>
                                            <p className="text-[10px] text-slate-500 font-mono truncate uppercase">{config.type}</p>
                                        </div>

                                        <div className="col-span-3 flex justify-center">
                                            <button
                                                onClick={() => handleToggleActive(config)}
                                                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all ${config.is_active
                                                    ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                                                    : 'bg-slate-800 text-slate-500 border border-transparent'
                                                    }`}
                                            >
                                                {config.is_active ? <Check size={10} /> : null}
                                                {config.is_active ? 'Activo' : 'Inactivo'}
                                            </button>
                                        </div>

                                        <div className="col-span-2 flex justify-center">
                                            <button
                                                onClick={() => handleToggleMandatory(config)}
                                                disabled={!config.is_active}
                                                className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-[10px] font-bold transition-all ${!config.is_active ? 'opacity-20 cursor-not-allowed' :
                                                    config.is_mandatory_in_template
                                                        ? 'bg-blue-500/10 text-blue-500 border border-blue-500/20'
                                                        : 'bg-slate-800 text-slate-500 border border-transparent hover:text-white'
                                                    }`}
                                            >
                                                {config.is_mandatory_in_template ? <Check size={10} /> : null}
                                                {config.is_mandatory_in_template ? 'Fijo' : 'Op'}
                                            </button>
                                        </div>

                                        <div className="col-span-1 flex justify-end">
                                            <button
                                                onClick={() => setFieldToDelete(config)}
                                                className="p-2 text-slate-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all rounded-lg hover:bg-red-500/10"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Subtle Inline Options Editor for Select type */}
                                    {config.type === 'select' && config.is_active && (
                                        <div className="mt-3 pl-4 border-l-2 border-indigo-500/20 py-1 flex flex-wrap gap-2 items-center">
                                            <span className="text-[9px] font-bold text-slate-500 uppercase mr-1">Opciones:</span>
                                            {config.options?.map(opt => (
                                                <span
                                                    key={opt}
                                                    className="bg-slate-900 text-slate-400 px-2 py-0.5 rounded text-[10px] flex items-center gap-1.5 hover:text-red-400 cursor-pointer transition-colors border border-white/5 active:scale-95 group/opt"
                                                    title="Click para borrar"
                                                    onClick={() => handleUpdateOptions(config, config.options.filter(o => o !== opt))}
                                                >
                                                    {opt}
                                                    <X size={8} className="opacity-50 group-hover/opt:text-red-400" />
                                                </span>
                                            ))}
                                            <div className="relative">
                                                <input
                                                    type="text"
                                                    placeholder="+"
                                                    className="bg-transparent border-b border-white/10 text-[10px] text-white outline-none w-8 hover:w-20 focus:w-32 transition-all px-1 focus:border-indigo-500"
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter' && e.target.value.trim()) {
                                                            const val = e.target.value.trim();
                                                            if (!config.options?.includes(val)) {
                                                                handleUpdateOptions(config, [...(config.options || []), val]);
                                                            }
                                                            e.target.value = '';
                                                        }
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}

                            <div className="mt-6 p-4 bg-indigo-500/5 border border-indigo-500/10 rounded-xl flex items-start gap-3">
                                <AlertCircle size={18} className="text-indigo-400 shrink-0 mt-0.5" />
                                <div className="text-xs text-indigo-200/70 leading-relaxed">
                                    Los campos marcados como <strong>Fijo</strong> aparecerán automáticamente como columnas en todas las plantillas Excel que generes.
                                </div>
                            </div>
                        </div>
                    )}

                    {/* CUSTOM DELETION MODAL (OVERLAY) */}
                    {fieldToDelete && (
                        <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md rounded-b-2xl flex items-center justify-center p-8 z-[70] animate-in fade-in duration-200">
                            <div className="text-center max-w-xs">
                                <div className="bg-red-500/20 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-500/20">
                                    <Trash className="text-red-500" size={32} />
                                </div>
                                <h3 className="text-lg font-bold text-white mb-2">¿Eliminar campo?</h3>
                                <p className="text-sm text-slate-400 mb-6 leading-relaxed">
                                    Vas a borrar <span className="text-white font-semibold">"{fieldToDelete.label}"</span>. Esta acción no se puede deshacer y afectará a todos los ejercicios.
                                </p>
                                <div className="flex gap-3">
                                    <button
                                        onClick={() => setFieldToDelete(null)}
                                        className="flex-1 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold transition-all"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        onClick={() => deleteConfig.mutate(fieldToDelete.field_key)}
                                        disabled={deleteConfig.isPending}
                                        className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl font-bold transition-all active:scale-95 disabled:opacity-50"
                                    >
                                        {deleteConfig.isPending ? 'Borrando...' : 'Eliminar'}
                                    </button>
                                </div>
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
