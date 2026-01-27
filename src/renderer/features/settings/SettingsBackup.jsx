import React, { useState, useEffect } from 'react';
import { Cloud, Save, Check, AlertTriangle, Loader2 } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

export default function SettingsBackup() {
    const { t } = useLanguage();
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState(null); // 'success', 'error', null
    const [statusMessage, setStatusMessage] = useState('');
    const [isOnline, setIsOnline] = useState(navigator.onLine);

    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    const handleBackup = async () => {
        if (!isOnline) {
            setStatus('error');
            setStatusMessage('No tienes conexión a internet.');
            return;
        }

        setLoading(true);
        setStatus(null);

        try {
            if (!window.api || !window.api.cloud) {
                throw new Error('API Cloud no disponible. Reinicia la aplicación.');
            }

            // Pass null/empty so backend uses the default configured ID
            const result = await window.api.cloud.backup();

            if (result.success) {
                setStatus('success');
                const time = new Date().toLocaleTimeString();
                const tables = result.data?.data?.tables || result.data?.tables || {};
                const fileUploaded = result.data?.data?.fileBackup || result.data?.fileBackup;

                setStatusMessage(`Backup COMPLETADO a las ${time}. 
                \n• Sincronización Exacta: OK
                \n• Snapshot .db: ${fileUploaded ? 'SUBIDO' : 'Error'}
                `);
            } else {
                setStatus('error');
                setStatusMessage(`Error en el backup: ${result.error}`);
            }
        } catch (error) {
            setStatus('error');
            setStatusMessage(`Error inesperado: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-6 max-w-2xl mx-auto">
            <div className="mb-8">
                <h2 className="text-2xl font-bold text-white flex items-center gap-2 mb-2">
                    <Cloud className="text-blue-400" />
                    Copia Completa & Snapshot
                </h2>
                <p className="text-slate-400">
                    Sincronización exacta (elimina lo que sobra en la nube) + Subida de archivo físico (.db) para restauración total.
                </p>
            </div>

            <div className="bg-slate-900/50 border border-white/5 rounded-2xl p-6 space-y-6">

                {/* Status Feedback */}
                {status && (
                    <div className={`p-4 rounded-xl border flex items-start gap-3 animate-in fade-in slide-in-from-top-2 duration-300 ${status === 'success'
                        ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                        : 'bg-red-500/10 border-red-500/20 text-red-400'
                        }`}>
                        {status === 'success' ? <Check size={20} className="mt-0.5" /> : <AlertTriangle size={20} className="mt-0.5" />}
                        <div>
                            <p className="font-bold text-sm">
                                {status === 'success' ? 'Backup Exitoso' : 'Error en el Backup'}
                            </p>
                            <p className="text-sm opacity-90 whitespace-pre-line">{statusMessage}</p>
                        </div>
                    </div>
                )}

                {/* No Connection Warning (if not explicitly in error state yet) */}
                {!isOnline && status !== 'error' && (
                    <div className="p-4 rounded-xl border border-amber-500/20 bg-amber-500/10 text-amber-400 flex items-center gap-3 animate-pulse">
                        <AlertTriangle size={20} />
                        <span className="text-sm font-medium">Sin conexión a Internet. La sincronización está desactivada.</span>
                    </div>
                )}

                {/* Actions */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <button
                        onClick={handleBackup}
                        disabled={loading || !isOnline}
                        className={`w-full py-4 rounded-xl font-bold text-white shadow-lg transition-all flex items-center justify-center gap-2 ${(loading || !isOnline)
                            ? 'bg-slate-700 cursor-not-allowed opacity-50 grayscale'
                            : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-blue-500/20 hover:scale-[1.02] active:scale-[0.98]'
                            }`}
                    >
                        {loading ? (
                            <>
                                <Loader2 size={20} className="animate-spin" />
                                Sincronizando...
                            </>
                        ) : (
                            <>
                                <Cloud size={20} />
                                {isOnline ? 'Backup Nube' : 'Esperando Conexión'}
                            </>
                        )}
                    </button>

                    <button
                        onClick={async () => {
                            const res = await window.api.cloud.exportLocal();
                            if (res.success) {
                                setStatus('success');
                                setStatusMessage('Archivo .db exportado correctamente a tu equipo.');
                            } else if (!res.cancelled) {
                                setStatus('error');
                                setStatusMessage(res.error || 'Error al exportar');
                            }
                        }}
                        className="w-full py-4 rounded-xl font-bold text-white bg-slate-800 border border-white/10 hover:bg-slate-700 transition-all flex items-center justify-center gap-2"
                    >
                        <Save size={20} />
                        Exportar Local (.db)
                    </button>
                </div>

                <p className="text-center text-xs text-slate-500">
                    La subida a la nube genera un snapshot en Supabase y sincroniza registros. La exportación local guarda el archivo físico real.
                </p>
            </div>

            {/* Update Safety Info */}
        </div>
    );
}
