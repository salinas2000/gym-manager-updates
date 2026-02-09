import React, { useState, useEffect } from 'react';
import { useNotifications } from '../../context/NotificationContext';
import { useGym } from '../../context/GymContext';
import { Save, Building2, UserCircle, Briefcase, Lock, Unlock, Key, ShieldCheck, CheckCircle, AlertCircle, Cloud, HardDrive, Database } from 'lucide-react';
import ConfirmationModal from '../../components/ui/ConfirmationModal';
import SettingsLicense from './SettingsLicense';

export default function SettingsPage({ initialTab = 'general' }) {
    const { settings, updateSettings, refreshData } = useGym();

    const [activeTab, setActiveTab] = useState(initialTab || 'general');
    const [licenseData, setLicenseData] = useState(null);
    const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', children: null, onConfirm: () => { }, type: 'info' });

    // Request Confirm Helper
    const requestConfirm = ({ title, message, type = 'info', confirmText, onConfirm }) => {
        setConfirmModal({
            isOpen: true,
            title,
            children: message,
            type,
            confirmText,
            onConfirm
        });
    };

    // Identity Data
    const [formData, setFormData] = useState({
        gym_name: '',
        manager_name: '',
        role: ''
    });

    const [licenseKey, setLicenseKey] = useState('');

    // UI State
    const [isSaving, setIsSaving] = useState(false);
    const [message, setMessage] = useState(null);

    // Status (Derived from both local settings and license service)
    const isActivated = !!licenseData;

    useEffect(() => {
        // Load settings and license data
        const loadData = async () => {
            if (settings) {
                setFormData(prev => ({
                    ...prev,
                    gym_name: settings.gym_name || prev.gym_name,
                    role: settings.role || prev.role
                }));
            }

            try {
                if (window.api.license && window.api.license.getData) {
                    const lic = await window.api.license.getData();
                    setLicenseData(lic);
                    // Standardize gym name from license if local settings are empty
                    if (lic && lic.gym_name && !settings?.gym_name) {
                        setFormData(prev => ({ ...prev, gym_name: lic.gym_name }));
                    }
                }
            } catch (e) {
                console.error("Error fetching license:", e);
            }
        };
        loadData();
    }, [settings]);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    // --- ACTIONS ---

    // --- ACTIONS ---

    const handleSaveGeneral = async (e) => {
        e.preventDefault();
        setIsSaving(true);
        const success = await updateSettings(formData);
        if (success) {
            showMsg('success', 'Información actualizada.');
        } else {
            showMsg('error', 'Error al guardar.');
        }
        setIsSaving(false);
    };

    const handleActivate = async (e, directKey = null) => {
        if (e) e.preventDefault();
        const keyToUse = directKey || licenseKey;

        if (!keyToUse) return;

        setIsSaving(true);
        try {
            // Use NEW License API
            const res = await window.api.license.activate(keyToUse);
            if (res) {
                setLicenseData(res);
                showMsg('success', '¡Aplicación activada correctamente!');
                refreshData();
            }
        } catch (e) {
            console.error(e);
            showMsg('error', e.message || 'Error al activar.');
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
                    {isActivated ?
                        <span>PRODUCTO ACTIVADO <span className="text-slate-500 text-xs ml-2">({licenseData?.gym_name})</span></span>
                        : 'MODO PRUEBA (NO ACTIVADO)'}
                </div>
            </header>

            {/* TABS */}
            <div className="flex gap-4 border-b border-white/10 pb-1">
                <button onClick={() => setActiveTab('general')} className={`pb-3 px-2 text-sm font-bold transition-colors border-b-2 ${activeTab === 'general' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-300'}`}>
                    Identidad Corporativa
                </button>
                <button onClick={() => setActiveTab('license')} className={`pb-3 px-2 text-sm font-bold transition-colors border-b-2 flex items-center gap-2 ${activeTab === 'license' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-300'}`}>
                    <Key size={16} /> Licencia
                </button>
                <button onClick={() => setActiveTab('integrations')} className={`pb-3 px-2 text-sm font-bold transition-colors border-b-2 flex items-center gap-2 ${activeTab === 'integrations' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-300'}`}>
                    <Cloud size={16} /> Integraciones
                </button>
                <button onClick={() => setActiveTab('updates')} className={`pb-3 px-2 text-sm font-bold transition-colors border-b-2 flex items-center gap-2 ${activeTab === 'updates' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-300'}`}>
                    <ShieldCheck size={16} /> Actualizaciones
                </button>
            </div>

            {/* TAB CONTENT: GENERAL */}
            {activeTab === 'general' && (
                <div className="space-y-6 animate-in fade-in zoom-in-95 duration-200">
                    <form onSubmit={handleSaveGeneral} className="space-y-6">

                        {/* CORPORATE IDENTITY */}
                        <div className="bg-slate-900/50 rounded-2xl p-6 border border-white/5 shadow-xl glass-panel relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-32 bg-blue-600/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
                            <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                                <Building2 className="text-blue-400" /> Identidad Corporativa
                            </h3>
                            <div className="space-y-4">
                                <div>
                                    <label className="text-sm font-medium text-slate-400 block mb-2">Nombre del Gimnasio</label>
                                    <input
                                        type="text" name="gym_name" value={formData.gym_name} onChange={handleChange}
                                        className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-blue-500 outline-none transition-all"
                                        placeholder="Ej: Iron Gym"
                                    />
                                    <p className="text-xs text-slate-500 mt-2">Este nombre será visible en todas las rutinas exportadas.</p>
                                </div>
                            </div>
                        </div>

                        {/* RESPONSIBLE INFO */}
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
                </div>
            )}

            {/* TAB CONTENT: LICENSE */}
            {activeTab === 'license' && (
                <SettingsLicense
                    licenseData={licenseData}
                    onActivate={(key) => handleActivate({ preventDefault: () => { } }, key)}
                    onDeactivate={() => {
                        requestConfirm({
                            title: 'Desactivar Licencia',
                            message: '¿Estás seguro de que quieres desactivar la licencia? La aplicación se cerrará y tendrás que volver a activarla.',
                            type: 'danger',
                            confirmText: 'Desactivar',
                            onConfirm: () => {
                                window.api.license.deactivate().then(() => {
                                    window.location.reload();
                                });
                            }
                        });
                    }}
                    isSaving={isSaving}
                />
            )}


            {/* TAB CONTENT: INTEGRATIONS */}
            {
                activeTab === 'integrations' && (
                    <IntegrationsTab confirmAction={requestConfirm} />
                )
            }

            {/* TAB CONTENT: UPDATES */}
            {
                activeTab === 'updates' && (
                    <UpdateTab />
                )
            }

            {/* Global Message Toast */}
            {
                message && (
                    <div className={`fixed bottom-8 right-8 px-6 py-4 rounded-xl shadow-2xl border flex items-center gap-3 animate-in slide-in-from-bottom-5 fade-in duration-300 z-50 ${message.type === 'success' ? 'bg-slate-900 border-emerald-500/50 text-emerald-400' : 'bg-slate-900 border-red-500/50 text-red-400'}`}>
                        {message.type === 'success' ? <CheckCircle /> : <AlertCircle />}
                        <span className="font-bold">{message.text}</span>
                    </div>
                )
            }

            {/* Confirmation Modal */}
            <ConfirmationModal
                isOpen={confirmModal.isOpen}
                title={confirmModal.title}
                onConfirm={async () => {
                    await confirmModal.onConfirm();
                }}
                onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                type={confirmModal.type}
                confirmText={confirmModal.confirmText}
            >
                {confirmModal.children}
            </ConfirmationModal>
        </div >
    );
}

function IntegrationsTab({ confirmAction }) {
    const [status, setStatus] = useState({ connected: false, user: null });
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        checkStatus();
    }, []);

    const checkStatus = async () => {
        if (!window.api.google) return;
        try {
            const res = await window.api.google.getStatus();
            if (res.success) {
                setStatus(res.data);
            }
        } catch (e) {
            console.error(e);
        }
    };

    const { addNotification, removeNotification } = useNotifications();

    const handleConnect = async () => {
        setIsLoading(true);
        try {
            const res = await window.api.google.startAuth();
            if (res.success) {
                setStatus({ connected: true, user: res.user });
                // Update Notification Center
                addNotification({
                    id: 'google-status',
                    type: 'status',
                    title: 'Google Drive Conectado',
                    message: `Sincronizando con ${res.user?.email || 'Tu Cuenta'}`,
                    userEmail: res.user?.email,
                    priority: 'low',
                    persistent: true,
                    action: {
                        label: 'Configurar',
                        view: 'settings',
                        data: 'integrations'
                    }
                });
            } else {
                alert('Error al conectar: ' + res.error);
            }
        } catch (e) {
            console.error(e);
            alert('Error inesperado al conectar')
        }
        setIsLoading(false);
    };

    const handleDisconnect = async () => {
        confirmAction({
            title: 'Desconectar Google Drive',
            message: '¿Estás seguro de que quieres desconectar tu cuenta de Google Drive? Tendrás que volver a autorizar el acceso para subir archivos.',
            type: 'warning',
            confirmText: 'Desconectar',
            onConfirm: async () => {
                await window.api.google.signOut();
                setStatus({ connected: false, user: null });
                removeNotification('google-status');
            }
        });
    };

    return (
        <div className="space-y-6 animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-slate-900/50 rounded-2xl p-8 border border-white/5 shadow-xl">
                <div className="flex items-start gap-6">
                    <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center flex-shrink-0 shadow-lg p-3">
                        <HardDrive size={32} className="text-blue-600" />
                    </div>
                    <div className="flex-1">
                        <h3 className="text-xl font-bold text-white mb-2">Google Drive</h3>
                        <p className="text-slate-400 text-sm mb-6 max-w-xl">
                            Conecta tu cuenta de Google para subir automáticamente las rutinas y entrenamientos. Los archivos se guardarán en una carpeta "GIMNASIO" y se generará un enlace público para compartir con tus clientes.
                        </p>

                        {status.connected ? (
                            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    {status.user?.picture ? (
                                        <img src={status.user.picture} className="w-10 h-10 rounded-full border border-emerald-500/30" />
                                    ) : (
                                        <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold">
                                            {status.user?.name?.charAt(0) || 'U'}
                                        </div>
                                    )}
                                    <div>
                                        <p className="text-white font-bold">{status.user?.name || 'Usuario Conectado'}</p>
                                        <p className="text-emerald-400 text-xs">{status.user?.email}</p>
                                    </div>
                                </div>
                                <button onClick={handleDisconnect} className="text-red-400 hover:text-red-300 text-sm font-medium hover:underline">
                                    Desconectar
                                </button>
                            </div>
                        ) : (
                            <button
                                onClick={handleConnect}
                                disabled={isLoading}
                                className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-all shadow-lg hover:shadow-blue-500/20 disabled:opacity-50 disabled:cursor-wait"
                            >
                                {isLoading ? 'Conectando...' : 'Conectar Cuenta de Google'}
                            </button>
                        )}
                    </div>
                </div>
            </div>
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
