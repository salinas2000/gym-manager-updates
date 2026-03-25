import React, { useState } from 'react';
import { X, Upload, Check, AlertTriangle, FileSpreadsheet, Users } from 'lucide-react';
import { useGym } from '../../context/GymContext';
import { useToast } from '../../context/ToastContext';
import LoadingSpinner from '../../components/ui/LoadingSpinner';

export default function ImportExcelModal({ isOpen, onClose }) {
    const { refreshData } = useGym();
    const toast = useToast();

    const [step, setStep] = useState('idle'); // idle, preview, importing, done
    const [preview, setPreview] = useState([]);
    const [fileName, setFileName] = useState('');
    const [importing, setImporting] = useState(false);
    const [result, setResult] = useState(null);

    if (!isOpen) return null;

    const handleSelectFile = async () => {
        try {
            const res = await window.api.customers.importExcel();
            if (res.success === false && res.error) {
                toast.error(res.error);
                return;
            }
            if (res.data?.cancelled || res.data?.customers === undefined) {
                // Handle the wrapper format
                const data = res.data || res;
                if (data.cancelled) return;
                if (data.customers) {
                    setPreview(data.customers);
                    setFileName(data.fileName || 'Excel');
                    setStep('preview');
                }
                return;
            }
            if (res.data) {
                setPreview(res.data.customers || []);
                setFileName(res.data.fileName || 'Excel');
                setStep('preview');
            }
        } catch (err) {
            toast.error(err.message || 'Error al leer archivo');
        }
    };

    const handleImport = async () => {
        setImporting(true);
        try {
            const res = await window.api.customers.bulkImport(preview);
            const data = res.success ? res.data : res;
            setResult(data);
            setStep('done');
            if (data.imported > 0) {
                await refreshData();
            }
            toast.success(`${data.imported} clientes importados correctamente`);
        } catch (err) {
            toast.error(err.message || 'Error en la importacion');
        } finally {
            setImporting(false);
        }
    };

    const handleClose = () => {
        setStep('idle');
        setPreview([]);
        setResult(null);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={handleClose} />
            <div className="relative w-full max-w-2xl max-h-[80vh] bg-slate-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col">

                {/* Header */}
                <div className="p-6 border-b border-white/5">
                    <button onClick={handleClose} className="absolute top-4 right-4 p-2 hover:bg-white/5 rounded-lg text-slate-400 hover:text-white transition-colors">
                        <X size={18} />
                    </button>
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-emerald-500/10 rounded-xl">
                            <FileSpreadsheet size={20} className="text-emerald-400" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white">Importar Clientes desde Excel</h2>
                            <p className="text-sm text-slate-400">
                                {step === 'idle' && 'Selecciona un archivo Excel con fichas de inscripcion'}
                                {step === 'preview' && `${preview.length} clientes encontrados en ${fileName.split(/[/\\]/).pop()}`}
                                {step === 'done' && 'Importacion completada'}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {step === 'idle' && (
                        <div className="flex flex-col items-center justify-center py-12 space-y-6">
                            <div className="w-24 h-24 rounded-2xl bg-slate-800 border-2 border-dashed border-white/10 flex items-center justify-center">
                                <Upload size={32} className="text-slate-500" />
                            </div>
                            <div className="text-center">
                                <p className="text-white font-medium">Arrastra o selecciona un archivo .xlsx</p>
                                <p className="text-xs text-slate-500 mt-1">Formato: Ficha de Inscripcion y Salud (Google Forms export)</p>
                            </div>
                            <button
                                onClick={handleSelectFile}
                                className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-blue-500/20"
                            >
                                Seleccionar Archivo
                            </button>
                        </div>
                    )}

                    {step === 'preview' && (
                        <div className="space-y-4">
                            <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-4 flex items-center gap-3">
                                <Users size={18} className="text-blue-400" />
                                <p className="text-sm text-white"><span className="font-bold">{preview.length}</span> clientes listos para importar</p>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full text-xs">
                                    <thead>
                                        <tr className="text-slate-500 uppercase tracking-widest border-b border-white/5">
                                            <th className="text-left py-2 px-3">Nombre</th>
                                            <th className="text-left py-2 px-3">Email</th>
                                            <th className="text-left py-2 px-3">DNI</th>
                                            <th className="text-left py-2 px-3">Telefono</th>
                                            <th className="text-left py-2 px-3">Medico</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {preview.slice(0, 50).map((c, i) => {
                                            const hasMedical = c.medical_info && (c.medical_info.diseases || c.medical_info.injuries || c.medical_info.allergies || c.medical_info.surgeries);
                                            const allNo = hasMedical && [c.medical_info.diseases, c.medical_info.injuries, c.medical_info.allergies, c.medical_info.surgeries].every(v => !v || v.toLowerCase() === 'no');
                                            return (
                                                <tr key={i} className="border-b border-white/5 hover:bg-slate-800/30">
                                                    <td className="py-2 px-3 text-white font-medium">{c.first_name} {c.last_name}</td>
                                                    <td className="py-2 px-3 text-slate-400 truncate max-w-[180px]">{c.email || <span className="text-red-400">Sin email</span>}</td>
                                                    <td className="py-2 px-3 text-slate-400">{c.dni || '-'}</td>
                                                    <td className="py-2 px-3 text-slate-400">{c.phone || '-'}</td>
                                                    <td className="py-2 px-3">
                                                        {hasMedical && !allNo ? (
                                                            <span className="text-amber-400 flex items-center gap-1"><AlertTriangle size={12} /> Si</span>
                                                        ) : (
                                                            <span className="text-emerald-400"><Check size={12} className="inline" /> OK</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                                {preview.length > 50 && (
                                    <p className="text-xs text-slate-500 text-center mt-2">...y {preview.length - 50} mas</p>
                                )}
                            </div>
                        </div>
                    )}

                    {step === 'done' && result && (
                        <div className="space-y-4 py-6">
                            <div className="text-center">
                                <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-4">
                                    <Check size={32} className="text-emerald-400" />
                                </div>
                                <p className="text-2xl font-black text-white">{result.imported}</p>
                                <p className="text-sm text-slate-400">clientes importados correctamente</p>
                            </div>

                            {result.skipped > 0 && (
                                <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4">
                                    <p className="text-sm text-amber-300 font-bold mb-2">{result.skipped} omitidos</p>
                                    {result.errors?.length > 0 && (
                                        <ul className="space-y-1">
                                            {result.errors.map((err, i) => (
                                                <li key={i} className="text-xs text-slate-400">{err}</li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-white/5 bg-slate-900/50 flex justify-between items-center">
                    <button
                        onClick={handleClose}
                        className="text-slate-400 hover:text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-white/5 transition-all"
                    >
                        {step === 'done' ? 'Cerrar' : 'Cancelar'}
                    </button>

                    {step === 'preview' && (
                        <button
                            onClick={handleImport}
                            disabled={importing || preview.length === 0}
                            className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white px-6 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2"
                        >
                            {importing ? <LoadingSpinner size="sm" color="white" /> : <Upload size={14} />}
                            {importing ? 'Importando...' : `Importar ${preview.length} Clientes`}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
