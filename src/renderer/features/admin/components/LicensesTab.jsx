import React, { useState } from 'react';
import { Lock, AlertCircle, MoreVertical, Activity, Unlock, Trash2, Info, Plus, RefreshCw, Send } from 'lucide-react';
import { cn } from '../../../lib/utils';

export function LicensesTab({
    gyms,
    releases,
    currentVersion,
    activeGymId,
    setActiveGymId,
    setConfirmAction,
    handleViewBackups,
    handlePushDB,
    generating
}) {
    const [selectedGymForBackup, setSelectedGymForBackup] = useState(null);

    return (
        <table className="w-full text-left border-collapse">
            <thead>
                <tr className="border-b border-white/5 bg-slate-900/50 text-xs text-slate-500 uppercase tracking-wider">
                    <th className="p-4 font-bold">Gimnasio</th>
                    <th className="p-4 font-bold">Hardware ID</th>
                    <th className="p-4 font-bold">Versión</th>
                    <th className="p-4 font-bold">Estado</th>
                    <th className="p-4 font-right">Acciones</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-sm text-slate-300">
                {gyms.map((gym) => {
                    const health = { color: 'bg-emerald-500', text: 'text-emerald-400', label: 'Online' };
                    // Simple health check logic could be passed as prop or calculated here
                    const isInactive = !gym.hardware_id || gym.revoked; // Simplified check

                    return (
                        <tr key={gym.gym_id} className={cn("hover:bg-white/[0.02] transition-colors", isInactive && "opacity-75 grayscale")}>
                            <td className="p-4">
                                <div className="font-bold text-white flex items-center gap-2">
                                    {gym.gym_name || 'Sin Nombre'}
                                    {isInactive && <span className="text-[10px] bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full border border-red-500/20">REVOCADA</span>}
                                </div>
                                <div className="text-xs text-slate-500 font-mono">{gym.gym_id}</div>
                            </td>
                            <td className="p-4 text-slate-400 font-mono text-xs">
                                {gym.hardware_id ? (
                                    <span className="flex items-center gap-1 text-indigo-400">
                                        <Lock size={12} /> {gym.hardware_id.substring(0, 16)}...
                                    </span>
                                ) : (
                                    <span className="text-orange-400 italic flex items-center gap-1">
                                        <AlertCircle size={12} /> Esperando Activación
                                    </span>
                                )}
                            </td>
                            <td className="p-4">
                                {(() => {
                                    const latestVersion = releases[0]?.version || currentVersion;
                                    const gymVersion = gym.app_version || '1.0.0';
                                    const isOutdated = gymVersion !== latestVersion;

                                    return (
                                        <span className={cn(
                                            "px-2 py-1 rounded text-[10px] font-mono",
                                            isOutdated
                                                ? "bg-red-500/10 text-red-400 border border-red-500/20"
                                                : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                        )}>
                                            v{gymVersion} {isOutdated && '⚠️'}
                                        </span>
                                    );
                                })()}
                            </td>
                            <td className="p-4">
                                <div className="flex items-center gap-2">
                                    <div className={cn("w-2 h-2 rounded-full", isInactive ? "bg-slate-600" : health.color, !isInactive && "animate-pulse")}></div>
                                    <span className={cn("text-xs font-medium", isInactive ? "text-slate-500" : health.text)}>
                                        {isInactive ? 'Desactivada' : health.label}
                                    </span>
                                </div>
                                {!isInactive && gym.last_sync && <div className="text-[10px] text-slate-500 mt-1">Sincronización: {new Date(gym.last_sync).toLocaleDateString()}</div>}
                            </td>
                            <td className="p-4 text-right relative">
                                <button
                                    onClick={() => setActiveGymId(activeGymId === gym.gym_id ? null : gym.gym_id)}
                                    className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 transition-colors"
                                >
                                    <MoreVertical size={20} />
                                </button>

                                {activeGymId === gym.gym_id && (
                                    <div className="absolute right-4 top-12 w-48 bg-slate-900 border border-white/10 rounded-xl shadow-2xl z-20 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
                                        <button
                                            onClick={() => handleViewBackups(gym)}
                                            className="w-full flex items-center gap-2 px-4 py-3 text-left text-xs text-slate-300 hover:bg-slate-800 transition-colors"
                                        >
                                            <Activity size={14} className="text-emerald-400" /> Gestión de Datos
                                        </button>
                                        <button
                                            onClick={() => setConfirmAction({ type: 'unbind', gymId: gym.gym_id, gymName: gym.gym_name })}
                                            className="w-full flex items-center gap-2 px-4 py-3 text-left text-xs text-slate-300 hover:bg-slate-800 transition-colors"
                                        >
                                            <Unlock size={14} className="text-orange-400" /> Desvincular Hardware
                                        </button>
                                        <button
                                            disabled={isInactive}
                                            onClick={() => setConfirmAction({ type: 'revoke', gymId: gym.gym_id, gymName: gym.gym_name })}
                                            className="w-full flex items-center gap-2 px-4 py-3 text-left text-xs text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-20"
                                        >
                                            <Trash2 size={14} /> Revocar Licencia
                                        </button>
                                    </div>
                                )}
                            </td>
                        </tr>
                    );
                })}
            </tbody>
        </table>
    );
}
