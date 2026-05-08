import React, { useState } from 'react';
import { X, Upload, FileJson, Check, FolderOpen, Users } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { useGym } from '../../context/GymContext';

export default function ImportCustomersJsonModal({ isOpen, onClose }) {
    const toast = useToast();
    const { refreshData } = useGym();

    const [step, setStep] = useState('idle');
    const [dataset, setDataset] = useState(null);
    const [fileName, setFileName] = useState('');
    const [result, setResult] = useState(null);

    if (!isOpen) return null;

    const reset = () => {
        setStep('idle');
        setDataset(null);
        setFileName('');
        setResult(null);
    };
    const handleClose = () => { reset(); onClose(); };

    const handlePickFile = async () => {
        try {
            const res = await window.api.customers.pickDatasetFile();
            if (res?.cancelled) return;
            if (!res?.dataset || !Array.isArray(res.dataset.customers)) {
                toast.error('JSON inválido: falta el array customers[]');
                return;
            }
            setDataset(res.dataset);
            setFileName(res.filePath?.split(/[\\/]/).pop() || 'dataset.json');
            setStep('preview');
        } catch (err) {
            toast.error(err.message || 'Error al leer el archivo');
        }
    };

    const handleImport = async () => {
        setStep('importing');
        try {
            const res = await window.api.customers.importDataset(dataset);
            const data = res?.success ? res.data : res;
            setResult(data);
            setStep('done');
            if (data?.imported > 0 && refreshData) await refreshData();
            toast.success(`${data.imported} clientes importados`);
        } catch (err) {
            toast.error(err.message || 'Error al importar');
            setStep('preview');
        }
    };

    const total = dataset?.customers?.length || 0;
    const sample = dataset?.customers?.slice(0, 5) || [];

    return (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
                <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                        <Users className="text-blue-400" size={20} />
                        Importar Clientes (JSON)
                    </h2>
                    <button onClick={handleClose} className="text-slate-400 hover:text-white">
                        <X size={20} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6">
                    {step === 'idle' && (
                        <div className="text-center py-8 space-y-4">
                            <FileJson size={48} className="mx-auto text-slate-600" />
                            <p className="text-slate-300">
                                Selecciona un archivo <code className="text-amber-400">.json</code> con los clientes.
                            </p>
                            <p className="text-xs text-slate-500">
                                <strong>Add-only por email</strong>: si un cliente con el mismo email ya existe, se respeta (no se sobrescribe).
                            </p>
                            <button
                                onClick={handlePickFile}
                                className="mt-4 px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold inline-flex items-center gap-2"
                            >
                                <FolderOpen size={18} />
                                Seleccionar archivo JSON
                            </button>
                        </div>
                    )}

                    {step === 'preview' && (
                        <div className="space-y-4">
                            <div className="bg-slate-800/50 rounded-xl p-4 border border-white/5">
                                <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">Archivo</div>
                                <div className="text-white font-medium truncate">{fileName}</div>
                                <div className="mt-3 text-3xl font-bold text-blue-400">{total}</div>
                                <div className="text-xs text-slate-500 uppercase tracking-wider">Clientes en el archivo</div>
                            </div>
                            {sample.length > 0 && (
                                <div>
                                    <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">Muestra (5 primeros)</div>
                                    <div className="space-y-1 max-h-48 overflow-y-auto pr-2">
                                        {sample.map((c, i) => (
                                            <div key={i} className="bg-slate-800/30 rounded-lg px-3 py-2 text-sm">
                                                <span className="text-slate-200 font-medium">{c.first_name} {c.last_name}</span>
                                                <span className="text-slate-500 ml-2">{c.email || 'sin email'}</span>
                                            </div>
                                        ))}
                                        {total > 5 && <div className="text-xs text-slate-500 text-center pt-2">… y {total - 5} más</div>}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {step === 'importing' && (
                        <div className="text-center py-12">
                            <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                            <p className="text-slate-300">Importando...</p>
                        </div>
                    )}

                    {step === 'done' && result && (
                        <div className="space-y-4">
                            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 flex items-start gap-3">
                                <Check className="text-emerald-400 mt-0.5" size={20} />
                                <div>
                                    <div className="text-emerald-300 font-bold">Importación completa</div>
                                    <div className="text-slate-400 text-sm mt-1">
                                        Clientes con email duplicado se han respetado.
                                    </div>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <Stat label="Importados" value={result.imported} color="emerald" />
                                <Stat label="Saltados (duplicado)" value={result.skipped} color="amber" />
                            </div>
                            {result.errors?.length > 0 && (
                                <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-3 text-xs text-slate-400 max-h-32 overflow-y-auto">
                                    {result.errors.slice(0, 10).map((e, i) => <div key={i}>• {e}</div>)}
                                    {result.errors.length > 10 && <div>… y {result.errors.length - 10} más</div>}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="flex justify-end gap-2 px-6 py-4 border-t border-white/10 bg-slate-900/80">
                    {step === 'preview' && (
                        <>
                            <button onClick={reset} className="px-4 py-2 rounded-xl text-slate-300 hover:text-white">Cambiar archivo</button>
                            <button onClick={handleImport} className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold flex items-center gap-2">
                                <Upload size={16} />
                                Importar {total} clientes
                            </button>
                        </>
                    )}
                    {(step === 'idle' || step === 'done') && (
                        <button onClick={handleClose} className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white">Cerrar</button>
                    )}
                </div>
            </div>
        </div>
    );
}

function Stat({ label, value, color = 'slate' }) {
    const colors = {
        emerald: 'text-emerald-400',
        amber: 'text-amber-400',
        slate: 'text-slate-400',
    };
    return (
        <div className="bg-slate-800/40 rounded-xl p-3 border border-white/5">
            <div className={`text-2xl font-bold ${colors[color]}`}>{value ?? 0}</div>
            <div className="text-xs text-slate-500 uppercase tracking-wider mt-1">{label}</div>
        </div>
    );
}
