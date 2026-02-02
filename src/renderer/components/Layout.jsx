import React from 'react';
import { Users, Settings, Globe, LayoutDashboard, Cloud, Dumbbell, Clock, CreditCard, Palette } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useGym } from '../context/GymContext';
import NotificationBell from './ui/NotificationBell';
import GlobalBanner from './ui/GlobalBanner';

const SidebarItem = ({ icon: Icon, label, active, onClick }) => (
    <div
        onClick={onClick}
        className={`
    flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer transition-all group
    ${active
                ? 'bg-blue-600 shadow-[0_0_20px_rgba(37,99,235,0.3)] text-white'
                : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'}
  `}>
        <Icon size={20} className={active ? 'text-white' : 'text-slate-500 group-hover:text-slate-300'} />
        <span className="font-medium text-sm">{label}</span>
    </div>
);

export default function Layout({ children, currentView, onNavigate }) {
    const { t, language, setLanguage } = useLanguage();
    const [appVersion, setAppVersion] = React.useState('1.0.0');
    const [licenseWarning, setLicenseWarning] = React.useState(null);
    const { settings, reloadSettings } = useGym();

    React.useEffect(() => {
        const checkLicense = async () => {
            try {
                const status = await window.api.license.getStatus();
                if (status.data && status.data.status) {
                    const s = status.data.status;
                    if (s.warning) {
                        setLicenseWarning({
                            days: s.daysLeft,
                            message: s.message
                        });
                    } else {
                        setLicenseWarning(null);
                    }
                }
            } catch (err) {
                console.error('License check failed:', err);
            }
        };

        checkLicense();
        const interval = setInterval(checkLicense, 60000); // Check every minute
        return () => clearInterval(interval);
    }, []);

    React.useEffect(() => {
        if (window.api?.updater?.getVersion) {
            window.api.updater.getVersion()
                .then(ver => setAppVersion(ver))
                .catch(err => console.error('Error fetching version:', err));
        }
    }, []);


    return (
        <>
            <GlobalBanner />
            <div className="flex h-screen w-full overflow-hidden bg-slate-950 text-slate-100">
                {/* Glassmorphism Sidebar */}
                <aside className="w-64 h-full flex flex-col p-6 border-r border-white/5 bg-slate-900/30 backdrop-blur-xl z-10">
                    {/* Brand Header */}
                    <div className="mb-10 px-2 relative group cursor-default">
                        <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg blur opacity-20 group-hover:opacity-40 transition duration-1000 group-hover:duration-200"></div>
                        <div className="relative flex items-center justify-between gap-3 w-full">
                            <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-950 border border-white/10 shadow-2xl">
                                    <span className="text-xl font-black bg-clip-text text-transparent bg-gradient-to-tr from-blue-400 to-purple-400">
                                        {(settings?.gym_name || 'G').charAt(0).toUpperCase()}
                                    </span>
                                </div>
                                <div className="overflow-hidden">
                                    <h1 className="text-lg font-bold text-white tracking-tight leading-none truncate">
                                        {settings?.gym_name || 'Gym Manager'}
                                    </h1>
                                    <div className="flex items-center gap-2 mt-1">
                                        <p className="text-[10px] font-medium text-blue-400/80 uppercase tracking-widest">PRO SUITE</p>
                                        <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded shadow-sm shadow-emerald-500/5">
                                            v{appVersion}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <NotificationBell />
                        </div>
                    </div>

                    <nav className="flex-1 space-y-2">
                        {/* Dashboard - Highlighted for Statistics */}
                        <div
                            onClick={() => onNavigate('dashboard')}
                            className={`
                            flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer transition-all group
                            ${currentView === 'dashboard'
                                    ? 'bg-gradient-to-r from-emerald-600 to-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.4)] text-white'
                                    : 'text-slate-400 hover:bg-emerald-900/20 hover:text-emerald-300 border border-emerald-500/20'
                                }
                        `}
                        >
                            <LayoutDashboard size={20} className={currentView === 'dashboard' ? 'text-white' : 'text-emerald-500 group-hover:text-emerald-300'} />
                            <span className="font-medium text-sm">{t('sidebar.dashboard')}</span>
                        </div>

                        <SidebarItem
                            icon={Users}
                            label={t('sidebar.customers')}
                            active={currentView === 'customers'}
                            onClick={() => onNavigate('customers')}
                        />
                        <SidebarItem
                            icon={CreditCard}
                            label="Pagos"
                            active={currentView === 'finance'}
                            onClick={() => onNavigate('finance')}
                        />
                        <SidebarItem
                            icon={Settings}
                            label={t('sidebar.tariffs')}
                            active={currentView === 'tariffs'}
                            onClick={() => onNavigate('tariffs')}
                        />
                        <SidebarItem
                            icon={LayoutDashboard}
                            label={t('sidebar.library')}
                            active={currentView === 'library'}
                            onClick={() => onNavigate('library')}
                        />
                        <SidebarItem
                            icon={Dumbbell}
                            label={t('sidebar.training')}
                            active={currentView === 'training'}
                            onClick={() => onNavigate('training')}
                        />
                        <SidebarItem
                            icon={Palette}
                            label="Diseñador"
                            active={currentView === 'templates'}
                            onClick={() => onNavigate('templates')}
                        />
                        <SidebarItem
                            icon={Clock}
                            label={t('sidebar.history')}
                            active={currentView === 'history'}
                            onClick={() => onNavigate('history')}
                        />

                        {settings?.isMaster && (
                            <div className="pt-4 mt-4 border-t border-white/5">
                                <div
                                    onClick={() => onNavigate('admin')}
                                    className={`
                                    flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer transition-all group
                                    ${currentView === 'admin'
                                            ? 'bg-gradient-to-r from-indigo-600 to-violet-600 shadow-[0_0_20px_rgba(79,70,229,0.4)] text-white'
                                            : 'text-indigo-400 hover:bg-indigo-900/20 hover:text-indigo-300 border border-indigo-500/20'
                                        }
                                `}
                                >
                                    <Settings size={20} className={currentView === 'admin' ? 'text-white' : 'text-indigo-500 group-hover:text-indigo-300'} />
                                    <span className="font-bold text-sm">Panel Maestro</span>
                                </div>
                            </div>
                        )}

                        <div className="pt-4 border-t border-white/5 mt-4">
                            <SidebarItem
                                icon={Settings}
                                label="Configuración"
                                active={currentView === 'settings'}
                                onClick={() => onNavigate('settings')}
                            />
                        </div>
                    </nav>

                    <div className="mt-auto pt-6 border-t border-white/5 space-y-3">
                        {/* Cloud Backup */}
                        <SidebarItem
                            icon={Cloud}
                            label={t('sidebar.backup')}
                            active={currentView === 'backup'}
                            onClick={() => onNavigate('backup')}
                        />


                        <div className="flex items-center gap-3 px-2">
                            <div className="w-8 h-8 rounded-full bg-slate-800 border border-white/10 flex items-center justify-center">
                                <span className="text-xs font-bold text-slate-400">{(settings?.manager_name || 'AD').substring(0, 2).toUpperCase()}</span>
                            </div>
                            <div>
                                <p className="text-sm font-medium text-white truncate max-w-[140px]">{settings?.manager_name || t('sidebar.admin')}</p>
                                <p className="text-xs text-slate-500 truncate max-w-[140px]">{settings?.role || t('sidebar.manager')}</p>
                            </div>
                        </div>
                    </div>
                </aside>

                {/* Main Content Area */}
                <main className="flex-1 h-full overflow-auto relative">
                    {/* Background ambient glow */}
                    <div className="fixed top-0 left-0 w-full h-[500px] bg-blue-600/10 blur-[100px] -z-10 pointer-events-none rounded-full transform -translate-y-1/2"></div>

                    <div className="p-8 max-w-7xl mx-auto h-full">
                        {licenseWarning && (
                            <div className="mb-6 bg-orange-500/10 border border-orange-500/50 rounded-xl p-4 flex items-center justify-between animate-pulse">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-orange-500/20 rounded-lg text-orange-500">
                                        <Globe size={24} />
                                    </div>
                                    <div>
                                        <h3 className="text-orange-400 font-bold">Verificación de Licencia Requerida</h3>
                                        <p className="text-slate-400 text-sm">
                                            Tu sesión sin conexión caducará en <span className="text-white font-bold">{licenseWarning.days} días</span>.
                                            Por favor, conéctate a internet para renovar el acceso.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}
                        {children}
                    </div>
                </main>
            </div>
        </>
    );
}
