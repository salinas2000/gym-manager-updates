import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { X, Upload, FileJson, Check, AlertTriangle, FolderOpen } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

export default function ImportDatasetModal({ isOpen, onClose }) {
    const queryClient = useQueryClient();
    const toast = useToast();

    const [step, setStep] = useState('idle'); // idle | preview | importing | done
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
            const res = await window.api.training.pickDatasetFile();
            if (res?.cancelled) return;
            if (!res?.dataset || !Array.isArray(res.dataset.categories)) {
                toast.error('JSON inválido: falta el array categories[]');
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
            const res = await window.api.training.importDataset(dataset);
            const data = res?.success ? res.data : res;
            if (!data) throw new Error('Respuesta vacía del servidor');
            setResult(data);
            setStep('done');
            queryClient.invalidateQueries(['categories']);
            queryClient.invalidateQueries(['exercises']);
            const msg = `${data.exercisesNew} ejercicios añadidos, ${data.exercisesSkipped} ya existían.`;
            toast.success(msg);
        } catch (err) {
            toast.error(err.message || 'Error al importar');
            setStep('preview');
        }
    };

    const totals = dataset ? (() => {
        let exs = 0, subs = 0;
        for (const c of dataset.categories) {
            if (Array.isArray(c.subcategories)) {
                subs += c.subcategories.length;
                for (const s of c.subcategories) exs += (s.exercises?.length || 0);
            } else if (Array.isArray(c.exercises)) {
                exs += c.exercises.length;
                subs += 1; // "General"
            }
        }
        return { categories: dataset.categories.length, subs, exs };
    })() : null;

    return (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
                <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                        <FileJson className="text-blue-400" size={20} />
                        Importar Dataset de Ejercicios
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
                                Selecciona un archivo <code className="text-amber-400">.json</code> con el dataset de ejercicios.
                            </p>
                            <p className="text-xs text-slate-500">
                                La importación es <strong>add-only</strong>: si un ejercicio ya existe con el mismo nombre, se respeta.
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

                    {step === 'preview' && totals && (
                        <div className="space-y-4">
                            <div className="bg-slate-800/50 rounded-xl p-4 border border-white/5">
                                <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">Archivo</div>
                                <div className="text-white font-medium truncate">{fileName}</div>
                            </div>
                            <div className="grid grid-cols-3 gap-3">
                                <Stat label="Categorías" value={totals.categories} color="blue" />
                                <Stat label="Subcategorías" value={totals.subs} color="purple" />
                                <Stat label="Ejercicios" value={totals.exs} color="emerald" />
                            </div>
                            <div>
                                <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">Categorías a importar</div>
                                <div className="space-y-1 max-h-48 overflow-y-auto pr-2">
                                    {dataset.categories.map((c, i) => {
                                        const count = Array.isArray(c.subcategories)
                                            ? c.subcategories.reduce((s, x) => s + (x.exercises?.length || 0), 0)
                                            : (c.exercises?.length || 0);
                                        return (
                                            <div key={i} className="flex items-center justify-between bg-slate-800/30 rounded-lg px-3 py-2">
                                                <span className="text-slate-200">{c.icon || '•'} {c.name}</span>
                                                <span className="text-slate-500 text-sm">{count} ejercicios</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
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
                                        Los ejercicios existentes se han respetado (add-only).
                                    </div>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <Stat label="Categorías nuevas" value={result.categoriesNew} color="blue" />
                                <Stat label="Categorías ya existentes" value={result.categoriesExisting} color="slate" />
                                <Stat label="Subcategorías nuevas" value={result.subcategoriesNew} color="purple" />
                                <Stat label="Ejercicios nuevos" value={result.exercisesNew} color="emerald" />
                                <Stat label="Ejercicios saltados" value={result.exercisesSkipped} color="amber" className="col-span-2" />
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex justify-end gap-2 px-6 py-4 border-t border-white/10 bg-slate-900/80">
                    {step === 'preview' && (
                        <>
                            <button onClick={reset} className="px-4 py-2 rounded-xl text-slate-300 hover:text-white">
                                Cambiar archivo
                            </button>
                            <button onClick={handleImport} className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold flex items-center gap-2">
                                <Upload size={16} />
                                Importar {totals.exs} ejercicios
                            </button>
                        </>
                    )}
                    {(step === 'idle' || step === 'done') && (
                        <button onClick={handleClose} className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white">
                            Cerrar
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

function Stat({ label, value, color = 'slate', className = '' }) {
    const colors = {
        blue: 'text-blue-400',
        purple: 'text-purple-400',
        emerald: 'text-emerald-400',
        amber: 'text-amber-400',
        slate: 'text-slate-400',
    };
    return (
        <div className={`bg-slate-800/40 rounded-xl p-3 border border-white/5 ${className}`}>
            <div className={`text-2xl font-bold ${colors[color]}`}>{value ?? 0}</div>
            <div className="text-xs text-slate-500 uppercase tracking-wider mt-1">{label}</div>
        </div>
    );
}
