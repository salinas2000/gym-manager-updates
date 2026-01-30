import React from 'react';
import { X, Bell, Info, AlertCircle, Download, CheckCircle, RefreshCw, Cloud, ShieldCheck, Trash2 } from 'lucide-react';
import { useNotifications } from '../../context/NotificationContext';
import LoadingSpinner from './LoadingSpinner';

export default function NotificationCenter({ onNavigate }) {
    const {
        notifications,
        isDrawerOpen,
        setDrawerOpen,
        removeNotification,
        clearAll,
        updateNotification
    } = useNotifications();

    if (!isDrawerOpen) return null;

    const handleUpdateAction = async (action) => {
        try {
            if (action === 'download') {
                await window.api.updater.download();
            } else if (action === 'install') {
                await window.api.updater.install();
            }
        } catch (err) {
            console.error('Update action failed:', err);
        }
    };

    return (
        <div className="fixed inset-0 z-[60] overflow-hidden">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm transition-opacity"
                onClick={() => setDrawerOpen(false)}
            ></div>

            {/* Panel */}
            <div className="absolute inset-y-0 right-0 max-w-sm w-full bg-slate-900 shadow-2xl border-l border-white/5 flex flex-col animate-in slide-in-from-right duration-300">

                {/* Header */}
                <div className="p-6 border-b border-white/5 flex items-center justify-between bg-slate-800/20">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-500/10 rounded-lg text-blue-400">
                            <Bell size={20} />
                        </div>
                        <h2 className="text-xl font-bold text-white">Notificaciones</h2>
                    </div>
                    <button
                        onClick={() => setDrawerOpen(false)}
                        className="p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3 no-scrollbar">
                    {notifications.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-center p-10 opacity-40">
                            <Bell size={48} className="mb-4 text-slate-600" />
                            <p className="text-white font-medium">Buzón vacío</p>
                            <p className="text-sm text-slate-400">No tienes notificaciones pendientes ahora mismo.</p>
                        </div>
                    ) : (
                        notifications.map((notif) => (
                            <div
                                key={notif.id}
                                className={`
                                    relative p-4 rounded-xl border transition-all
                                    ${notif.type === 'update' ? 'bg-blue-600/10 border-blue-500/30' :
                                        notif.type === 'status' ? 'bg-emerald-600/5 border-emerald-500/20' :
                                            'bg-slate-800/50 border-white/5'}
                                `}
                            >
                                <div className="flex gap-3">
                                    <div className={`
                                        p-2 rounded-lg shrink-0
                                        ${notif.type === 'update' ? 'text-blue-400' :
                                            notif.type === 'status' ? 'text-emerald-400' :
                                                notif.type === 'error' ? 'text-red-400' : 'text-slate-400'}
                                    `}>
                                        {notif.type === 'update' ? <RefreshCw className={notif.progress ? 'animate-spin' : ''} size={18} /> :
                                            notif.id === 'google-status' ? <Cloud size={18} /> :
                                                notif.id === 'license-status' ? <ShieldCheck size={18} /> :
                                                    <Info size={18} />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="text-sm font-bold text-white mb-1">{notif.title}</h3>
                                        <p className="text-xs text-slate-400 leading-relaxed mb-3">{notif.message}</p>

                                        {/* Progress Bar for Downloads */}
                                        {notif.progress !== undefined && (
                                            <div className="w-full h-1.5 bg-slate-950 rounded-full overflow-hidden mb-3">
                                                <div
                                                    className="h-full bg-blue-500 transition-all duration-300"
                                                    style={{ width: `${notif.progress}%` }}
                                                />
                                            </div>
                                        )}

                                        {/* Action Buttons */}
                                        <div className="flex gap-2">
                                            {notif.type === 'update' && !notif.readyToInstall && !notif.progress && (
                                                <button
                                                    onClick={() => handleUpdateAction('download')}
                                                    className="text-[10px] items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-500 transition-colors inline-flex"
                                                >
                                                    <Download size={12} /> Descargar v{notif.info?.version}
                                                </button>
                                            )}
                                            {notif.readyToInstall && (
                                                <button
                                                    onClick={() => handleUpdateAction('install')}
                                                    className="text-[10px] items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-lg font-bold hover:bg-emerald-500 transition-colors inline-flex"
                                                >
                                                    <CheckCircle size={12} /> Instalar y Reiniciar
                                                </button>
                                            )}
                                            {notif.action && (
                                                <button
                                                    onClick={() => {
                                                        onNavigate?.(notif.action.view, notif.action.data);
                                                        setDrawerOpen(false);
                                                    }}
                                                    className="text-[10px] items-center gap-1.5 px-3 py-1.5 bg-slate-800 text-white rounded-lg font-bold hover:bg-slate-700 transition-colors inline-flex border border-white/10"
                                                >
                                                    {notif.action.label}
                                                </button>
                                            )}
                                            {notif.onAction && (
                                                <button
                                                    disabled={notif.loading}
                                                    onClick={async () => {
                                                        if (updateNotification) updateNotification(notif.id, { loading: true });
                                                        await notif.onAction();
                                                        if (updateNotification) updateNotification(notif.id, { loading: false });
                                                    }}
                                                    className="text-[10px] items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-500 transition-colors inline-flex"
                                                >
                                                    {notif.loading ? <RefreshCw size={12} className="animate-spin" /> : <Download size={12} />}
                                                    {notif.actionLabel || 'Confirmar'}
                                                </button>
                                            )}
                                            {!notif.persistent && (
                                                <button
                                                    onClick={() => removeNotification(notif.id)}
                                                    className="text-[10px] px-3 py-1.5 border border-white/10 text-slate-400 rounded-lg hover:text-white hover:bg-white/5 transition-all"
                                                >
                                                    Descartar
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Footer */}
                {notifications.filter(n => !n.persistent).length > 0 && (
                    <div className="p-4 border-t border-white/5">
                        <button
                            onClick={clearAll}
                            className="w-full py-2 flex items-center justify-center gap-2 text-xs font-bold text-slate-500 hover:text-red-400 transition-colors"
                        >
                            <Trash2 size={14} />
                            Limpiar no fijadas
                        </button>
                    </div>
                )}
            </div>
        </div >
    );
}
