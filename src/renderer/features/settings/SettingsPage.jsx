import React, { useState, useEffect } from 'react';
import { useGym } from '../../context/GymContext';
import { Save, Building2, UserCircle, Briefcase, Lock, Unlock, Key, ShieldCheck, CheckCircle, AlertCircle } from 'lucide-react';

export default function SettingsPage() {
    const { settings, updateSettings, refreshData } = useGym();

    const [activeTab, setActiveTab] = useState('general'); // general, security, license

    // Identity Data
    const [formData, setFormData] = useState({
        gym_name: '',
        manager_name: '',
        role: ''
    });

    // Password & Activation State
    const [isLocked, setIsLocked] = useState(true);
    const [passwordInput, setPasswordInput] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [licenseKey, setLicenseKey] = useState('');

    // UI State
    const [isSaving, setIsSaving] = useState(false);
    const [message, setMessage] = useState(null);
    const [unlockError, setUnlockError] = useState(null);

    // Status
    const isActivated = settings?.is_activated === 'true';

    useEffect(() => {
        if (settings) {
            setFormData({
                gym_name: settings.gym_name || '',
                role: settings.role || ''
            });
        }
    }, [settings]);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    // --- ACTIONS ---

    const handleUnlock = async () => {
        setUnlockError(null);
        try {
            const res = await window.api.settings.verifyPassword(passwordInput);
            if (res.success && res.data) {
                setIsLocked(false);
                setPasswordInput('');
            } else {
                setUnlockError('Contraseña incorrecta');
            }
        } catch (e) {
            setUnlockError('Error al verificar');
        }
    };

    const handleSaveGeneral = async (e) => {
        e.preventDefault();

        // If locked (and supposedly bypass check failed or UI lagging), re-lock
        if (isLocked) return;

        setIsSaving(true);
        const success = await updateSettings(formData);
        if (success) {
            showMsg('success', 'Información actualizada.');
            setIsLocked(true); // Auto-lock after save
        } else {
            showMsg('error', 'Error al guardar.');
        }
        setIsSaving(false);
    };

    const handleChangePassword = async (e) => {
        e.preventDefault();
        if (!newPassword) return;

        setIsSaving(true);
        const success = await updateSettings({ admin_password: newPassword });
        if (success) {
            showMsg('success', 'Contraseña de administrador actualizada.');
            setNewPassword('');
            setIsLocked(true); // Require unlock with new pass
        } else {
            showMsg('error', 'Error al cambiar contraseña.');
        }
        setIsSaving(false);
    };

    const handleActivate = async (e) => {
        e.preventDefault();
        if (!licenseKey) return;

        setIsSaving(true);
        try {
            const res = await window.api.settings.activate(licenseKey);
            if (res.success) {
                showMsg('success', '¡Aplicación activada correctamente!');
                refreshData(); // Reload settings context
            } else {
                showMsg('error', res.error || 'Clave inválida.');
            }
        } catch (e) {
            showMsg('error', 'Error de conexión o clave inválida.');
        }
        setIsSaving(false);
    };

    const showMsg = (type, text) => {
        setMessage({ type, text });
        setTimeout(() => setMessage(null), 3000);
    };

    return (
        <div className="max-w-5xl mx-auto space-y-8">
            <header className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-bold text-white mb-1">Configuración del Sistema</h2>
                    <p className="text-slate-400">Gestiona la identidad y seguridad de tu gimnasio.</p>
                </div>
                {/* Activation Badge */}
                <div className={`px-4 py-2 rounded-xl border flex items-center gap-2 font-mono text-sm ${isActivated ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-amber-500/10 border-amber-500/20 text-amber-400'}`}>
                    {isActivated ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
                    {isActivated ? 'LICENCIA ACTIVA' : 'MODO PRUEBA (NO ACTIVADO)'}
                </div>
            </header>

            {/* TABS */}
            <div className="flex gap-4 border-b border-white/10 pb-1">
                <button onClick={() => setActiveTab('general')} className={`pb-3 px-2 text-sm font-bold transition-colors border-b-2 ${activeTab === 'general' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-300'}`}>
                    General e Identidad
                </button>
                <button onClick={() => setActiveTab('license')} className={`pb-3 px-2 text-sm font-bold transition-colors border-b-2 ${activeTab === 'license' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-300'}`}>
                    Licencia
                </button>
                <button onClick={() => setActiveTab('updates')} className={`pb-3 px-2 text-sm font-bold transition-colors border-b-2 ${activeTab === 'updates' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-300'}`}>
                    Actualizaciones
                </button>
            </div>

            {/* TAB CONTENT: GENERAL */}
            {activeTab === 'general' && (
                <div className="space-y-6 animate-in fade-in zoom-in-95 duration-200">
                    {/* Lock Overlay / Unlocked State */}
                    {isLocked ? (
                        <div className="bg-slate-900/50 rounded-2xl p-8 border border-white/5 border-dashed flex flex-col items-center justify-center text-center space-y-4">
                            <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center text-slate-500">
                                <Lock size={32} />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-white">Edición Bloqueada</h3>
                                <p className="text-slate-400 text-sm max-w-sm mx-auto">Esta sección es exclusiva para el instalador del sistema.</p>
                            </div>
                            <div className="flex gap-2 w-full max-w-xs">
                                <input
                                    type="password"
                                    placeholder="Clave de Instalador..."
                                    value={passwordInput}
                                    onChange={e => setPasswordInput(e.target.value)}
                                    className="bg-slate-950 border border-white/10 rounded-lg px-3 py-2 text-white w-full"
                                />
                                <button onClick={handleUnlock} className="bg-blue-600 hover:bg-blue-500 text-white px-4 rounded-lg font-bold">
                                    <Unlock size={18} />
                                </button>
                            </div>
                            {unlockError && <p className="text-red-400 text-xs">{unlockError}</p>}
                        </div>
                    ) : (
                        <form onSubmit={handleSaveGeneral} className="space-y-6">
                            <div className="flex justify-between items-center mb-4">
                                <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-lg p-3 flex items-center gap-2 text-emerald-400 text-sm">
                                    <Unlock size={16} />
                                    <span>Modo Instalador: Edición habilitada.</span>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setIsLocked(true)}
                                    className="text-slate-400 hover:text-white flex items-center gap-2 text-sm font-medium px-3 py-2 rounded-lg hover:bg-slate-800 transition-colors"
                                >
                                    <Lock size={16} /> Bloquear
                                </button>
                            </div>

                            <div className="bg-slate-900/50 rounded-2xl p-6 border border-white/5 shadow-xl glass-panel relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-32 bg-blue-600/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
                                <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                                    <Building2 className="text-blue-400" /> Identidad Corporativa
                                </h3>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-400 block">Nombre del Gimnasio</label>
                                    <input
                                        type="text" name="gym_name" value={formData.gym_name} onChange={handleChange}
                                        className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-blue-500 outline-none"
                                    />
                                    <p className="text-xs text-slate-500">Se usará como identificador para los backups en la nube.</p>
                                </div>
                            </div>

                            <div className="bg-slate-900/50 rounded-2xl p-6 border border-white/5 shadow-xl glass-panel relative overflow-hidden">
                                <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                                    <UserCircle className="text-emerald-400" /> Responsable
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-slate-400 block">Nombre</label>
                                        <input
                                            type="text" name="manager_name" value={formData.manager_name} onChange={handleChange}
                                            className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-emerald-500 outline-none"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-slate-400 block">Rol / Cargo</label>
                                        <input
                                            type="text" name="role" value={formData.role} onChange={handleChange}
                                            className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-emerald-500 outline-none"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-end pt-4">
                                <button type="submit" disabled={isSaving} className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg hover:shadow-blue-500/20 transition-all">
                                    <Save size={20} /> Guardar Cambios
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            )}

            {/* TAB CONTENT: LICENSE */}
            {activeTab === 'license' && (
                <div className="space-y-6 animate-in fade-in zoom-in-95 duration-200">
                    <div className="bg-slate-900/50 rounded-2xl p-6 border border-white/5 shadow-xl">
                        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                            <Key className="text-amber-400" /> Activación del Producto
                        </h3>
                        <p className="text-slate-400 text-sm mb-6">Si has instalado esta aplicación en un nuevo ordenador, ingresa tu clave de licencia para sincronizar y desbloquear todas las funciones.</p>

                        <form onSubmit={handleActivate} className="max-w-lg space-y-4">
                            <div>
                                <label className="text-sm font-medium text-slate-400 block mb-2">Clave de Licencia</label>
                                <input
                                    type="text"
                                    value={licenseKey}
                                    onChange={e => setLicenseKey(e.target.value)}
                                    placeholder="XXXX-XXXX-XXXX-XXXX"
                                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-white font-mono tracking-widest focus:border-amber-500 outline-none uppercase"
                                />
                            </div>
                            <button type="submit" disabled={!licenseKey || isSaving} className="bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white px-6 py-3 rounded-xl font-bold w-full transition-all shadow-lg shadow-amber-900/20 disabled:opacity-50">
                                {isActivated ? 'Actualizar Licencia' : 'Activar Aplicación'}
                            </button>
                        </form>

                        {isActivated && (
                            <div className="mt-6 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center gap-3">
                                <CheckCircle className="text-emerald-400" size={24} />
                                <div>
                                    <p className="text-emerald-400 font-bold">Producto Activado</p>
                                    <p className="text-emerald-500/70 text-xs">Tu licencia está activa y funcionando correctamente.</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* TAB CONTENT: UPDATES */}
            {activeTab === 'updates' && (
                <UpdateTab />
            )}

            {/* Global Message Toast */}
            {message && (
                <div className={`fixed bottom-8 right-8 px-6 py-4 rounded-xl shadow-2xl border flex items-center gap-3 animate-in slide-in-from-bottom-5 fade-in duration-300 z-50 ${message.type === 'success' ? 'bg-slate-900 border-emerald-500/50 text-emerald-400' : 'bg-slate-900 border-red-500/50 text-red-400'}`}>
                    {message.type === 'success' ? <CheckCircle /> : <AlertCircle />}
                    <span className="font-bold">{message.text}</span>
                </div>
            )}
        </div>
    );
}

function UpdateTab() {
    const [status, setStatus] = useState('idle');
    const [progress, setProgress] = useState(0);
    const [info, setInfo] = useState(null);
    const [isSupported, setIsSupported] = useState(!!window.api?.updater);

    useEffect(() => {
        if (!window.api?.updater) {
            setIsSupported(false);
            return;
        }

        // Listen for updates
        window.api.updater.onStatus((data) => {
            console.log('Update Status:', data);
            setStatus(data.status);
            if (data.info) setInfo(data.info);
            if (data.progress) setProgress(data.progress);
            if (data.error) console.error(data.error);
        });

        // Trigger check on mount
        window.api.updater.check();

        return () => window.api.updater.removeListener();
    }, []);

    const handleDownload = () => window.api.updater?.download();
    const handleInstall = () => window.api.updater?.install();
    const handleCheck = () => {
        if (!window.api?.updater) return;
        setStatus('checking');
        window.api.updater.check();
    };

    if (!isSupported) {
        return (
            <div className="space-y-6 animate-in fade-in zoom-in-95 duration-200">
                <div className="bg-amber-500/10 rounded-2xl p-8 border border-amber-500/20 text-center">
                    <AlertCircle size={40} className="text-amber-400 mx-auto mb-4" />
                    <h3 className="text-xl font-bold text-white mb-2">Reinicio Necesario</h3>
                    <p className="text-slate-400">
                        Hemos instalado el módulo de actualizaciones, pero necesitas reiniciar la aplicación para que surta efecto.
                    </p>
                    <p className="text-sm text-slate-500 mt-4">Cierra completamente la ventana y vuelve a abrirla.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-slate-900/50 rounded-2xl p-8 border border-white/5 shadow-xl flex flex-col items-center justify-center text-center">

                {/* ICON */}
                <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center mb-6 relative">
                    <div className="absolute inset-0 rounded-full border border-white/5 animate-ping opacity-20"></div>
                    <ShieldCheck size={40} className={`text-blue-400 ${status === 'checking' || status === 'downloading' ? 'animate-pulse' : ''}`} />
                </div>

                <h3 className="text-2xl font-bold text-white mb-2">
                    {status === 'checking' && 'Buscando actualizaciones...'}
                    {status === 'up-to-date' && 'Tu sistema está actualizado'}
                    {status === 'available' && '¡Nueva versión disponible!'}
                    {status === 'downloading' && 'Descargando actualización...'}
                    {status === 'downloaded' && 'Actualización lista'}
                    {status === 'error' && 'Error al buscar actualizaciones'}
                    {status === 'idle' && 'Estado de Actualización'}
                </h3>

                <p className="text-slate-400 mb-8 max-w-md">
                    {status === 'up-to-date' && `Tienes la última versión instalada. Disfruta de las nuevas funciones.`}
                    {status === 'available' && `Versión ${info?.version} está lista para descargar. Mejoras de rendimiento y corrección de errores.`}
                    {status === 'downloading' && `Por favor espera mientras descargamos la nueva versión. No cierres la aplicación.`}
                    {status === 'downloaded' && `La nueva versión se ha descargado correctamente. Reinicia para aplicar los cambios.`}
                </p>

                {/* PROGRESS BAR */}
                {status === 'downloading' && (
                    <div className="w-full max-w-sm bg-slate-800 rounded-full h-2 mb-6 overflow-hidden">
                        <div className="bg-blue-500 h-full transition-all duration-300" style={{ width: `${progress}%` }} />
                    </div>
                )}

                {/* ACTIONS */}
                <div className="flex gap-4">
                    {(status === 'idle' || status === 'up-to-date' || status === 'error') && (
                        <button onClick={handleCheck} className="py-3 px-6 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold transition-all">
                            Buscar de nuevo
                        </button>
                    )}

                    {status === 'available' && (
                        <button onClick={handleDownload} className="py-3 px-8 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold shadow-lg shadow-blue-500/20 animate-bounce">
                            Descargar Ahora
                        </button>
                    )}

                    {status === 'downloaded' && (
                        <button onClick={handleInstall} className="py-3 px-8 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-lg shadow-emerald-500/20">
                            Reiniciar e Instalar
                        </button>
                    )}
                </div>

                {/* DB SAFE NOTICE */}
                <div className="mt-8 p-4 bg-blue-500/5 border border-blue-500/10 rounded-xl text-sm text-slate-400 max-w-lg">
                    <p>
                        <strong className="text-blue-400">Nota de Seguridad:</strong> Tus datos y base de datos NO se verán afectados por la actualización. Se mantendrán intactos.
                    </p>
                </div>
            </div>
        </div>
    );
}
