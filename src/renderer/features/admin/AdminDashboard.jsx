import React, { useEffect, useState } from 'react';
import { Activity, Users, CreditCard, Server, Plus, Copy, Lock, ShieldCheck, MoreVertical, Trash2, Unlock, AlertCircle, RefreshCw, BarChart3, Megaphone, Send, Info } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { cn } from '../../lib/utils';
import { useNotifications } from '../../context/NotificationContext';

export default function AdminDashboard() {
    const { addNotification } = useNotifications();
    const [stats, setStats] = useState(null);
    const [gyms, setGyms] = useState([]);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [newLicense, setNewLicense] = useState(null);
    const [activeGymId, setActiveGymId] = useState(null);
    const [broadcastMessage, setBroadcastMessage] = useState('');
    const [broadcastType, setBroadcastType] = useState('info');
    const [lastBroadcast, setLastBroadcast] = useState(null);
    const [releases, setReleases] = useState([]);
    const [currentVersion, setCurrentVersion] = useState('0.0.0');

    // UI Modals / Flow states
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [gymNameInput, setGymNameInput] = useState('');
    const [confirmAction, setConfirmAction] = useState(null); // { type, gymId, gymName }
    const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);
    const [selectedGymForBackup, setSelectedGymForBackup] = useState(null);
    const [gymBackups, setGymBackups] = useState([]);
    const [loadingBackups, setLoadingBackups] = useState(false);
    const [pushHistory, setPushHistory] = useState([]);

    // Load Data
    const loadData = async () => {
        try {
            setLoading(true);
            const [statsRes, gymsRes, broadcastRes, releasesRes, versionRes] = await Promise.all([
                window.api.admin.getStats(),
                window.api.admin.listGyms(),
                window.api.admin.getBroadcast(),
                window.api.admin.getReleases(),
                window.api.updater.getVersion()
            ]);

            if (statsRes.success) setStats(statsRes.data);
            if (gymsRes.success) setGyms(gymsRes.data || []);
            if (broadcastRes.success) {
                setLastBroadcast(broadcastRes.data);
                if (broadcastRes.data) {
                    setBroadcastMessage(broadcastRes.data.message);
                    setBroadcastType(broadcastRes.data.type);
                }
            }
            if (releasesRes.success) setReleases(releasesRes.data || []);
            if (versionRes) {
                const v = typeof versionRes === 'object' ? versionRes.version : versionRes;
                setCurrentVersion(v);
            }

            if (!statsRes.success || !gymsRes.success) {
                addNotification({ type: 'warning', message: 'Algunos datos no se pudieron cargar.' });
            }
        } catch (error) {
            console.error('Admin Load Error:', error);
            addNotification({ type: 'error', message: 'Error cargando datos globales.' });
        } finally {
            setLoading(false);
        }
    };

    const handleSendBroadcast = async () => {
        if (!broadcastMessage.trim()) return;
        try {
            setGenerating(true);
            const res = await window.api.admin.updateBroadcast({
                message: broadcastMessage,
                type: broadcastType
            });
            if (res.success) {
                addNotification({ type: 'success', message: 'Comunicado enviado correctamente.' });
                setLastBroadcast(res.data);
            } else {
                addNotification({ type: 'error', message: 'Error: ' + res.error });
            }
        } catch (e) {
            addNotification({ type: 'error', message: 'Fallo de conexión: ' + e.message });
        } finally {
            setGenerating(false);
        }
    };

    const handleDeactivateBroadcast = async () => {
        try {
            setGenerating(true);
            const res = await window.api.admin.updateBroadcast({
                active: false
            });
            if (res.success) {
                addNotification({ type: 'success', message: 'Comunicado retirado.' });
                setLastBroadcast(null);
                setBroadcastMessage('');
            } else {
                addNotification({ type: 'error', message: 'Error: ' + res.error });
            }
        } catch (e) {
            addNotification({ type: 'error', message: 'Error al retirar comunicado.' });
        } finally {
            setGenerating(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const handleGenerateLicense = async () => {
        if (!gymNameInput.trim()) return;

        try {
            setGenerating(true);
            const res = await window.api.admin.createLicense(gymNameInput);
            if (res.success) {
                setNewLicense(res.data);
                setIsCreateModalOpen(false);
                setGymNameInput('');
                addNotification({ type: 'success', message: 'Licencia generada correctamente.' });
                loadData(); // Refresh list
            }
        } catch (error) {
            addNotification({ type: 'error', message: 'Error generando licencia: ' + error.message });
        } finally {
            setGenerating(false);
        }
    };

    const executeRevoke = async () => {
        if (!confirmAction) return;
        try {
            setGenerating(true);
            const res = await window.api.admin.revokeLicense(confirmAction.gymId);
            if (res.success) {
                addNotification({ type: 'success', message: 'Licencia revocada.' });
                loadData();
            }
        } catch (e) {
            addNotification({ type: 'error', message: 'Error: ' + e.message });
        } finally {
            setGenerating(false);
            setConfirmAction(null);
            setActiveGymId(null);
        }
    };

    const executeUnbind = async () => {
        if (!confirmAction) return;
        try {
            setGenerating(true);
            const res = await window.api.admin.unbindHardware(confirmAction.gymId);
            if (res.success) {
                addNotification({ type: 'success', message: 'Hardware desvinculado con éxito.' });
                loadData();
            }
        } catch (e) {
            addNotification({ type: 'error', message: 'Error: ' + e.message });
        } finally {
            setGenerating(false);
            setConfirmAction(null);
            setActiveGymId(null);
        }
    };

    const handleViewBackups = async (gym) => {
        setSelectedGymForBackup(gym);
        setIsBackupModalOpen(true);
        setLoadingBackups(true);
        setPushHistory([]);
        try {
            const [resBackups, resHistory] = await Promise.all([
                window.api.admin.listBackups(gym.gym_id),
                window.api.admin.getPushHistory(gym.gym_id)
            ]);
            setGymBackups(resBackups.success ? resBackups.data : []);
            setPushHistory(resHistory.success ? resHistory.data : []);
        } catch (err) {
            console.error('Error fetching backups/status:', err);
            addNotification({ type: 'error', message: 'Error cargando backups o historial: ' + err.message });
        } finally {
            setLoadingBackups(false);
        }
    };

    const handlePushDB = async (gymId) => {
        try {
            const resPick = await window.api.admin.pickDB();
            if (!resPick.success || !resPick.data) return;

            const localPath = resPick.data;

            setGenerating(true);
            addNotification({ type: 'info', message: 'Subiendo y enviando base de datos...' });

            const res = await window.api.admin.pushDB({
                gymId,
                localPath
            });

            if (res.success) {
                addNotification({ type: 'success', message: 'Base de datos enviada correctamente.' });
                // Refresh status
                const resHistory = await window.api.admin.getPushHistory(gymId);
                if (resHistory.success) setPushHistory(resHistory.data);
            } else {
                addNotification({ type: 'error', message: 'Error: ' + res.error });
            }
        } catch (err) {
            addNotification({ type: 'error', message: 'Error al enviar DB: ' + err.message });
        } finally {
            setGenerating(false);
        }
    };

    const getHealthStatus = (lastSync) => {
        const last = new Date(lastSync);
        const now = new Date();
        const diffHours = (now - last) / (1000 * 60 * 60);

        if (diffHours < 24) return { label: 'Online', color: 'bg-emerald-500', text: 'text-emerald-400' };
        if (diffHours < 72) return { label: 'Sincronizado Hace Poco', color: 'bg-orange-500', text: 'text-orange-400' };
        return { label: 'Inactivo / Desconectado', color: 'bg-red-500', text: 'text-red-400' };
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-indigo-400">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500 mb-4"></div>
                <p className="font-mono text-sm tracking-widest animate-pulse">ESTABLISHING SECURE UPLINK...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 h-full flex flex-col overflow-y-auto custom-scrollbar p-1">

            {/* Header */}
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-3xl font-black bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-purple-400">
                        MASTER CONTROLLER
                    </h1>
                    <p className="text-indigo-300/60 text-sm font-mono mt-1 flex items-center gap-2">
                        <ShieldCheck size={14} /> SYSTEM: ONLINE | MODE: GOD VIEW
                    </p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={loadData}
                        className="p-3 bg-slate-900 hover:bg-slate-800 border border-white/10 rounded-xl text-slate-400 transition-all"
                    >
                        <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
                    </button>
                    <button
                        onClick={() => setIsCreateModalOpen(true)}
                        disabled={generating}
                        className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl shadow-lg shadow-indigo-600/20 font-bold transition-all disabled:opacity-50"
                    >
                        <Plus size={20} />
                        {generating ? 'Generando...' : 'Nueva Licencia'}
                    </button>
                </div>
            </div>

            {/* Global Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <StatCard
                    title="Gimnasios Activos"
                    value={stats?.totalGyms || 0}
                    icon={Server}
                    color="text-indigo-400"
                    bg="bg-indigo-500/10"
                />
                <StatCard
                    title="Total Clientes (Global)"
                    value={stats?.totalCustomers || 0}
                    icon={Users}
                    color="text-emerald-400"
                    bg="bg-emerald-500/10"
                />
                <StatCard
                    title="Ingresos Globales"
                    value={`${(stats?.totalRevenue || 0).toLocaleString()} €`}
                    icon={CreditCard}
                    color="text-emerald-400"
                    bg="bg-emerald-500/10"
                    sub="Pagos procesados en la nube"
                />
                <StatCard
                    title="Puntos de Sincronización"
                    value={stats?.totalPayments || 0}
                    icon={Activity}
                    color="text-orange-400"
                    bg="bg-orange-500/10"
                    sub="Últimas 24h"
                />
            </div>

            {/* Release Management Area */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* GitHub Release History */}
                <div className="lg:col-span-2 bg-slate-900/50 backdrop-blur-sm border border-white/5 rounded-3xl p-6 min-h-[400px] flex flex-col">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-2">
                            <ShieldCheck className="text-indigo-400" size={20} />
                            <h3 className="text-white font-bold">Historial de Lanzamientos (GitHub)</h3>
                        </div>
                        <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">
                            Estado: v{currentVersion} (Local)
                        </span>
                    </div>

                    <div className="space-y-3 overflow-y-auto custom-scrollbar pr-2 flex-1">
                        {releases.length > 0 ? (
                            releases.map((release, idx) => (
                                <div key={idx} className="bg-slate-950/50 border border-white/5 rounded-2xl p-4 hover:border-indigo-500/30 transition-all group">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className={cn(
                                                    "px-2 py-0.5 rounded text-[10px] font-bold",
                                                    idx === 0 ? "bg-emerald-500/20 text-emerald-400" : "bg-slate-800 text-slate-400"
                                                )}>
                                                    v{release.version} {idx === 0 && 'LATEST'}
                                                </span>
                                                <h4 className="text-sm font-bold text-white group-hover:text-indigo-400 transition-colors">
                                                    {release.name || `Versión ${release.version}`}
                                                </h4>
                                            </div>
                                            <p className="text-[10px] text-slate-500 mt-1 font-mono">
                                                Publicado: {new Date(release.date).toLocaleDateString()} @ {new Date(release.date).toLocaleTimeString()}
                                            </p>
                                        </div>
                                        <a
                                            href={release.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="p-2 bg-white/5 hover:bg-white/10 rounded-lg text-slate-400 transition-colors"
                                        >
                                            <Plus size={14} className="rotate-45" />
                                        </a>
                                    </div>
                                    {release.body && (
                                        <div className="mt-3 text-[11px] text-slate-400 line-clamp-2 italic bg-white/5 p-2 rounded-lg">
                                            {release.body.substring(0, 150)}...
                                        </div>
                                    )}
                                </div>
                            ))
                        ) : (
                            <div className="flex flex-col items-center justify-center py-12 text-slate-600">
                                <AlertCircle size={32} className="mb-2 opacity-20" />
                                <p className="text-xs italic">No se encontraron versiones en GitHub</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Broadcast Sidebar Management */}
                <div className="bg-slate-900/50 backdrop-blur-sm border border-white/5 rounded-3xl p-6 flex flex-col">
                    <div className="flex items-center gap-2 mb-6">
                        <Megaphone className="text-indigo-400" size={20} />
                        <h3 className="text-white font-bold">Comunicado Global</h3>
                    </div>

                    <div className="space-y-4 flex-1 flex flex-col">
                        <textarea
                            value={broadcastMessage}
                            onChange={(e) => setBroadcastMessage(e.target.value)}
                            placeholder="Escribe un mensaje para todos los gimnasios..."
                            className="w-full h-32 bg-slate-950 border border-white/10 rounded-xl p-3 text-sm text-slate-300 focus:border-indigo-500 transition-colors outline-none resize-none"
                        />

                        <div className="flex gap-2">
                            {['info', 'warning', 'danger', 'success'].map(type => (
                                <button
                                    key={type}
                                    onClick={() => setBroadcastType(type)}
                                    className={cn(
                                        "flex-1 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider border transition-all",
                                        broadcastType === type
                                            ? "bg-white/10 border-white/20 text-white"
                                            : "border-transparent text-slate-500 hover:text-slate-400"
                                    )}
                                >
                                    {type}
                                </button>
                            ))}
                        </div>

                        <div className="flex flex-col gap-2 mt-auto pt-4">
                            <button
                                onClick={handleSendBroadcast}
                                disabled={generating || !broadcastMessage}
                                className="w-full flex items-center justify-center gap-2 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold transition-all disabled:opacity-50"
                            >
                                <Send size={18} /> Publicar Mensaje
                            </button>
                            {lastBroadcast && (
                                <button
                                    onClick={() => {
                                        setBroadcastMessage('');
                                        handleDeactivateBroadcast();
                                    }}
                                    className="w-full py-2 text-xs text-red-400 hover:underline transition-all"
                                >
                                    Retirar comunicado actual
                                </button>
                            )}
                        </div>
                    </div>
                </div>

            </div>

            {/* Gym List */}
            <div className="bg-slate-900/50 backdrop-blur-sm border border-white/5 rounded-3xl p-6 flex-1 flex flex-col min-h-[400px]">
                <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                    <Server className="text-indigo-400" /> Directorio de Sedes
                </h3>

                <div className="overflow-x-auto flex-1">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-white/5 text-slate-400 text-sm uppercase tracking-wider">
                                <th className="p-4 font-medium">Nombre / ID</th>
                                <th className="p-4 font-medium">Hardware ID (Binding)</th>
                                <th className="p-4 font-medium">Versión</th>
                                <th className="p-4 font-medium">Activa desde</th>
                                <th className="p-4 font-medium">Salud del Gym</th>
                                <th className="p-4 font-medium text-right">Control</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm divide-y divide-white/5">
                            {gyms.map((gym) => {
                                const health = getHealthStatus(gym.last_sync);
                                const isInactive = gym.active === false;

                                return (
                                    <tr key={gym.gym_id} className={cn("hover:bg-white/5 transition-colors group relative", isInactive && "opacity-50")}>
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
                                        <td className="p-4 text-slate-400">
                                            {new Date(gym.created_at).toLocaleDateString()}
                                        </td>
                                        <td className="p-4">
                                            <div className="flex items-center gap-2">
                                                <div className={cn("w-2 h-2 rounded-full", isInactive ? "bg-slate-600" : health.color, !isInactive && "animate-pulse")}></div>
                                                <span className={cn("text-xs font-medium", isInactive ? "text-slate-500" : health.text)}>
                                                    {isInactive ? 'Desactivada' : health.label}
                                                </span>
                                            </div>
                                            {!isInactive && <div className="text-[10px] text-slate-500 mt-1">Sincronización: {new Date(gym.last_sync).toLocaleDateString()}</div>}
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
                </div>
            </div>

            {/* Modal: Crear Licencia */}
            {isCreateModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-slate-900 border border-white/10 p-8 rounded-3xl shadow-2xl max-w-md w-full animate-in zoom-in-95 duration-200">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-3 bg-indigo-500/10 rounded-2xl text-indigo-400">
                                <Plus size={24} />
                            </div>
                            <h2 className="text-xl font-bold text-white">Generar Nueva Licencia</h2>
                        </div>

                        <p className="text-slate-400 text-sm mb-6">
                            Ingresa el nombre del gimnasio o cliente para generar una clave de acceso única.
                        </p>

                        <input
                            autoFocus
                            type="text"
                            value={gymNameInput}
                            onChange={(e) => setGymNameInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleGenerateLicense()}
                            className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-indigo-500 outline-none mb-6 transition-colors"
                            placeholder="Ej: Gimnasio Salinas 2000"
                        />

                        <div className="flex gap-3">
                            <button
                                onClick={() => { setIsCreateModalOpen(false); setGymNameInput(''); }}
                                className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold transition-all"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleGenerateLicense}
                                disabled={generating || !gymNameInput.trim()}
                                className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold transition-all disabled:opacity-50 shadow-lg shadow-indigo-600/20"
                            >
                                {generating ? 'Generando...' : 'Generar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal: Confirmación (Revocar/Desvincular) */}
            {confirmAction && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-slate-900 border border-red-500/20 p-8 rounded-3xl shadow-2xl max-w-md w-full animate-in zoom-in-95 duration-200">
                        <div className="flex items-center gap-3 mb-6">
                            <div className={cn(
                                "p-3 rounded-2xl",
                                confirmAction.type === 'revoke' ? "bg-red-500/10 text-red-500" : "bg-orange-500/10 text-orange-500"
                            )}>
                                <AlertCircle size={24} />
                            </div>
                            <h2 className="text-xl font-bold text-white">
                                {confirmAction.type === 'revoke' ? 'Revocar Licencia' : 'Desvincular Hardware'}
                            </h2>
                        </div>

                        <p className="text-slate-300 text-sm mb-2 font-bold">
                            ¿Estás seguro de que deseas proceder con {confirmAction.gymName}?
                        </p>
                        <p className="text-slate-500 text-xs mb-8">
                            {confirmAction.type === 'revoke'
                                ? 'Esta acción es irreversible y el cliente perderá acceso inmediato a la aplicación.'
                                : 'Esto permitirá al cliente activar la misma licencia en un equipo diferente.'}
                        </p>

                        <div className="flex gap-3">
                            <button
                                onClick={() => setConfirmAction(null)}
                                className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold transition-all"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={confirmAction.type === 'revoke' ? executeRevoke : executeUnbind}
                                disabled={generating}
                                className={cn(
                                    "flex-1 py-3 text-white rounded-xl font-bold transition-all shadow-lg",
                                    confirmAction.type === 'revoke'
                                        ? "bg-red-600 hover:bg-red-500 shadow-red-600/20"
                                        : "bg-orange-600 hover:bg-orange-500 shadow-orange-600/20"
                                )}
                            >
                                {confirmAction.type === 'revoke' ? 'SÍ, REVOCAR' : 'SÍ, DESVINCULAR'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal: Nueva Licencia Generada */}
            {newLicense && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-slate-900 border border-emerald-500/20 p-8 rounded-3xl shadow-2xl max-w-md w-full animate-in zoom-in-95 duration-200">
                        <div className="flex items-center gap-3 mb-6 font-bold text-emerald-400">
                            <ShieldCheck size={24} />
                            <h2 className="text-xl text-white">¡Licencia Generada!</h2>
                        </div>

                        <p className="text-slate-400 text-sm mb-6">
                            Comparte esta clave con el cliente para que pueda activar su aplicación:
                        </p>

                        <div className="bg-slate-950 border border-emerald-500/30 p-4 rounded-xl mb-8 flex items-center justify-between group">
                            <code className="text-emerald-400 font-black text-lg tracking-wider">
                                {newLicense.license_key}
                            </code>
                            <button
                                onClick={() => {
                                    navigator.clipboard.writeText(newLicense.license_key);
                                    addNotification({ type: 'success', message: 'Clave copiada al portapapeles' });
                                }}
                                className="p-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-lg transition-all"
                            >
                                <Copy size={18} />
                            </button>
                        </div>

                        <button
                            onClick={() => setNewLicense(null)}
                            className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold transition-all shadow-lg shadow-emerald-600/20"
                        >
                            ENTENDIDO
                        </button>
                    </div>
                </div>
            )}

            {/* Modal: Gestión de Backups y Carga Remota */}
            {isBackupModalOpen && selectedGymForBackup && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-slate-900 border border-white/10 p-8 rounded-3xl shadow-2xl max-w-2xl w-full animate-in zoom-in-95 duration-200 flex flex-col max-h-[80vh]">
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-3 font-bold text-white">
                                <div className="p-3 bg-emerald-500/10 rounded-2xl text-emerald-400">
                                    <Activity size={24} />
                                </div>
                                <div>
                                    <h2 className="text-xl">Gestión de Datos</h2>
                                    <p className="text-xs text-slate-500 font-mono uppercase tracking-widest">{selectedGymForBackup.gym_name}</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsBackupModalOpen(false)}
                                className="p-2 hover:bg-slate-800 rounded-xl text-slate-400"
                            >
                                <Plus size={20} className="rotate-45" />
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-1 overflow-hidden">
                            {/* Column 1: Backup History */}
                            <div className="flex flex-col overflow-hidden">
                                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                                    <RefreshCw size={12} /> Historial de Nube
                                </h3>
                                <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 pr-2">
                                    {loadingBackups ? (
                                        <p className="text-xs text-slate-500 italic animate-pulse">Consultando almacenamiento...</p>
                                    ) : gymBackups.length > 0 ? (
                                        gymBackups.map((bak, i) => (
                                            <div key={i} className="bg-slate-950/50 border border-white/5 p-3 rounded-xl flex flex-col gap-1">
                                                <div className="text-[10px] text-white font-mono truncate">{bak.name}</div>
                                                <div className="flex justify-between items-center text-[9px] text-slate-500">
                                                    <span>{(bak.size / 1024 / 1024).toFixed(2)} MB</span>
                                                    <span>{new Date(bak.created_at).toLocaleDateString()}</span>
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <p className="text-xs text-slate-500 italic">No hay sistemas de backup detectados.</p>
                                    )}
                                </div>
                            </div>

                            {/* Column 2: Remote Push */}
                            <div className="bg-slate-950/30 rounded-2xl p-6 border border-white/5 flex flex-col justify-center text-center">
                                <div className="bg-indigo-500/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-indigo-400">
                                    <Send size={32} />
                                </div>
                                <h3 className="text-white font-bold mb-2">Carga Forzosa de DB</h3>
                                <p className="text-[10px] text-slate-400 mb-4 px-4">
                                    Sube un archivo <code className="text-indigo-400">.db</code> para enviarlo a este gimnasio.
                                    El cliente recibirá una notificación inmediata para aplicarlo.
                                </p>

                                {pushHistory && pushHistory.length > 0 && (
                                    <div className="mb-6 space-y-2 text-left">
                                        <h4 className="text-[9px] font-bold text-slate-500 uppercase tracking-widest pl-1">Historial de Envíos</h4>
                                        <div className="space-y-1 max-h-[120px] overflow-y-auto custom-scrollbar pr-1">
                                            {pushHistory.map((push, idx) => (
                                                <div key={push.id || idx} className={cn(
                                                    "p-2 rounded-lg border flex items-center justify-between gap-2",
                                                    push.status === 'pending' ? 'bg-amber-500/5 border-amber-500/20' :
                                                        push.status === 'applied' ? 'bg-emerald-500/5 border-emerald-500/20' :
                                                            'bg-red-500/5 border-red-500/20'
                                                )}>
                                                    <div className="flex items-center gap-2">
                                                        <div className={cn(
                                                            "p-1.5 rounded-md",
                                                            push.status === 'pending' ? 'bg-amber-500/20 text-amber-500' :
                                                                push.status === 'applied' ? 'bg-emerald-500/20 text-emerald-500' :
                                                                    'bg-red-500/20 text-red-500'
                                                        )}>
                                                            {push.status === 'pending' ? <RefreshCw size={10} className="animate-spin-slow" /> :
                                                                push.status === 'applied' ? <ShieldCheck size={10} /> : <AlertCircle size={10} />}
                                                        </div>
                                                        <div>
                                                            <div className="text-[9px] font-bold text-white leading-tight">
                                                                {push.status === 'pending' ? 'Enviado (Esperando...)' :
                                                                    push.status === 'applied' ? 'Sincronizado' : 'Error'}
                                                            </div>
                                                            <div className="text-[8px] text-slate-500">
                                                                {new Date(push.created_at).toLocaleString()}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    {push.error && (
                                                        <div className="group relative">
                                                            <Info size={12} className="text-red-400 cursor-help" />
                                                            <div className="absolute bottom-full right-0 mb-2 w-48 p-2 bg-slate-950 text-[8px] text-red-400 rounded-lg border border-red-500/30 opacity-0 group-hover:opacity-100 transition-opacity z-50">
                                                                {push.error}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                <button
                                    onClick={() => handlePushDB(selectedGymForBackup.gym_id)}
                                    disabled={generating}
                                    className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold transition-all shadow-lg shadow-indigo-600/20 text-xs flex items-center justify-center gap-2"
                                >
                                    {generating ? <RefreshCw className="animate-spin" size={14} /> : <Plus size={14} />}
                                    SUBIR Y ENVIAR DB
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function StatCard({ title, value, icon: Icon, color, bg, sub }) {
    return (
        <div className="bg-slate-900/50 backdrop-blur-sm border border-white/5 rounded-2xl p-5 hover:bg-indigo-900/10 transition-all group overflow-hidden relative">
            <div className="flex justify-between items-start mb-4 relative z-10">
                <div className={cn("p-3 rounded-xl border border-white/5 shadow-inner", bg, color)}>
                    <Icon size={20} />
                </div>
            </div>
            <div className="relative z-10">
                <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mb-1">{title}</p>
                <h3 className="text-2xl font-black text-white">{value}</h3>
                {sub && <p className="text-[10px] text-slate-500 mt-1 font-medium">{sub}</p>}
            </div>
            {/* Decal background */}
            <Icon size={80} className={cn("absolute -right-4 -bottom-4 opacity-[0.03] transition-transform group-hover:scale-110", color)} />
        </div>
    );
}
