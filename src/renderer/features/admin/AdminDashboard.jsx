import React, { useEffect, useState } from 'react';
import { Building2, RefreshCw, Key, Store } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useNotifications } from '../../context/NotificationContext';

// Components
import { AdminStats } from './components/AdminStats';
import { OrganizationsTab } from './components/OrganizationsTab';
import { LicensesTab } from './components/LicensesTab';
import { EditOrgModal } from './components/EditOrgModal';
import { CreateModal } from './components/CreateModal';
import { BackupModal } from './components/BackupModal';
import { ConfirmModal } from './components/ConfirmModal';

export default function AdminDashboard() {
    const { addNotification } = useNotifications();
    const [loading, setLoading] = useState(true);

    // Data States
    const [stats, setStats] = useState(null);
    const [gyms, setGyms] = useState([]);
    const [organizations, setOrganizations] = useState([]);
    const [releases, setReleases] = useState([]);

    // UI States
    const [activeTab, setActiveTab] = useState('licenses'); // 'licenses' | 'orgs'
    const [activeGymId, setActiveGymId] = useState(null); // For Dropdown in Licenses

    // Modal States
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [editingOrg, setEditingOrg] = useState(null);
    const [selectedGymForBackup, setSelectedGymForBackup] = useState(null);
    const [confirmAction, setConfirmAction] = useState(null); // { type, gymId, gymName }

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [statsData, gymsData, orgsData, releasesData] = await Promise.all([
                window.api.admin.getStats(),
                window.api.admin.listGyms(),
                window.api.admin.listOrganizations(),
                window.api.admin.getReleases()
            ]);
            console.log('Admin Dashboard Data:', { statsData, gymsData });
            setStats(statsData.success ? statsData.data : null);
            setGyms(gymsData.success ? gymsData.data : []);
            setOrganizations(orgsData.success ? orgsData.data : []);
            setReleases(releasesData.success ? releasesData.data : []);
        } catch (error) {
            console.error('Error loading admin data:', error);
            addNotification('Error cargando datos del panel', 'error');
        } finally {
            setLoading(false);
        }
    };

    const confirmActionHandler = async () => {
        if (!confirmAction) return;
        try {
            if (confirmAction.type === 'revoke') {
                await window.api.admin.revokeLicense(confirmAction.gymId);
                addNotification('Licencia revocada', 'success');
            } else if (confirmAction.type === 'unbind') {
                await window.api.admin.resetHardwareId(confirmAction.gymId);
                addNotification('Hardware desvinculado', 'success');
            }
            loadData();
        } catch (error) {
            addNotification(error.message || 'Error en la acción', 'error');
        } finally {
            setConfirmAction(null);
        }
    };

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center bg-slate-950 text-white">
                <RefreshCw className="animate-spin text-indigo-500" size={32} />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-950 text-white font-sans selection:bg-indigo-500/30">
            {/* Header / Navbar */}
            <div className="sticky top-0 z-40 bg-slate-950/80 backdrop-blur-md border-b border-white/5 px-8 py-4 flex justify-between items-center">
                <div className="flex items-center gap-4">
                    <div className="p-2 bg-indigo-600 rounded-lg shadow-lg shadow-indigo-600/20">
                        <Building2 size={24} className="text-white" />
                    </div>
                    <div>
                        <h1 className="text-xl font-black tracking-tight flex items-center gap-2">
                            PANEL MASTER <span className="px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 text-[10px] font-mono border border-indigo-500/20">v2.0</span>
                        </h1>
                        <p className="text-xs text-slate-500 font-medium">Control Centralizado de Infraestructura</p>
                    </div>
                </div>
                <div className="flex gap-4">
                    <button
                        onClick={() => setIsCreateModalOpen(true)}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-indigo-600/20 flex items-center gap-2"
                    >
                        <Store size={14} /> Gestión Global
                    </button>
                </div>
            </div>

            <main className="p-8 max-w-7xl mx-auto space-y-8">
                {/* Stats Section */}
                <AdminStats stats={stats} />

                {/* Main Content Area */}
                <div className="bg-slate-900/50 backdrop-blur-sm border border-white/5 rounded-3xl overflow-hidden shadow-2xl">
                    {/* Tabs */}
                    <div className="flex border-b border-white/5">
                        <button
                            onClick={() => setActiveTab('licenses')}
                            className={cn(
                                "flex-1 py-4 text-sm font-bold transition-colors flex items-center justify-center gap-2",
                                activeTab === 'licenses' ? "bg-white/[0.02] text-white border-b-2 border-indigo-400" : "text-slate-500 hover:bg-white/[0.01]"
                            )}
                        >
                            <Key size={16} /> Licencias Emitidas ({gyms.length})
                        </button>
                        <button
                            onClick={() => setActiveTab('orgs')}
                            className={cn(
                                "flex-1 py-4 text-sm font-bold transition-colors flex items-center justify-center gap-2",
                                activeTab === 'orgs' ? "bg-white/[0.02] text-white border-b-2 border-indigo-400" : "text-slate-500 hover:bg-white/[0.01]"
                            )}
                        >
                            <Building2 size={16} /> Organizaciones ({organizations.length})
                        </button>
                    </div>

                    {/* View Content */}
                    <div className="min-h-[400px]">
                        {activeTab === 'licenses' ? (
                            <LicensesTab
                                gyms={gyms}
                                releases={releases}
                                currentVersion={stats?.latestVersion || '1.0.0'}
                                activeGymId={activeGymId}
                                setActiveGymId={setActiveGymId}
                                setConfirmAction={setConfirmAction}
                                handleViewBackups={(gym) => setSelectedGymForBackup(gym)}
                                handlePushDB={() => { }} // Placeholder if needed in tab, but BackupModal handles it usually
                                generating={false}
                            />
                        ) : (
                            <OrganizationsTab
                                organizations={organizations}
                                onEdit={(org) => setEditingOrg(org)}
                            />
                        )}
                    </div>
                </div>
            </main>

            {/* --- Modals Area --- */}

            <CreateModal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                onSuccess={() => {
                    setIsCreateModalOpen(false);
                    loadData();
                }}
                organizations={organizations}
            />

            {editingOrg && (
                <EditOrgModal
                    org={editingOrg}
                    onClose={() => setEditingOrg(null)}
                    onSuccess={() => {
                        setEditingOrg(null);
                        loadData();
                        addNotification('Organización actualizada', 'success');
                    }}
                />
            )}

            <BackupModal
                gym={selectedGymForBackup}
                onClose={() => setSelectedGymForBackup(null)}
                backups={[]} // Pass real backups if available
            />

            <ConfirmModal
                action={confirmAction}
                onCancel={() => setConfirmAction(null)}
                onConfirm={confirmActionHandler}
            />

        </div>
    );
}
