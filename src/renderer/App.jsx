import React, { useState } from 'react';
import Layout from './components/Layout';
import ModuleGuard from './components/ModuleGuard';
import ErrorBoundary from './components/ErrorBoundary';
import { GymProvider } from './context/GymContext';
import { LanguageProvider } from './context/LanguageContext';
import { ToastProvider } from './context/ToastContext';
import { NotificationProvider } from './context/NotificationContext';
import ToastContainer from './components/ui/ToastContainer';
import NotificationCenter from './components/ui/NotificationCenter';

// Pages
import DashboardPage from './pages/DashboardPage';
import CustomersPage from './pages/CustomersPage';
import TariffPage from './pages/TariffPage';
import PaymentsPage from './pages/PaymentsPage';
import TrainingPage from './pages/TrainingPage';
import LibraryPage from './pages/LibraryPage';
import TrainingHistoryPage from './pages/TrainingHistoryPage';
import SettingsPage from './pages/SettingsPage'; // Backup Page
import GeneralSettings from './features/settings/SettingsPage'; // New Config Page
// Admin Module
import AdminDashboard from './features/admin/AdminDashboard';
// TemplatesPage removed in v2.2.0 — replaced by mobile app routine view
import InventoryPage from './features/inventory/InventoryPage';
import ClassManager from './features/classes/ClassManager';
import TrainerManager from './features/trainers/TrainerManager';
import HelpPage from './features/help/HelpPage';
import RmReviewPage from './features/rm/RmReviewPage';
// TrainerAccessPage moved inside TrainerManager as a tab (cleaner UX, less sidebar clutter).

function Dashboard() {
    const [currentView, setCurrentView] = useState('customers');
    const [selectedCustomer, setSelectedCustomer] = useState(null);

    // Enhanced navigation handler
    const handleNavigate = (view, data = null) => {
        setCurrentView(view);
        if (data) {
            setSelectedCustomer(data);
        }
    };

    const renderContent = () => {
        switch (currentView) {
            case 'admin':
                return <AdminDashboard />;
            case 'dashboard':
                return <DashboardPage />;
            case 'inventory':
                return <ModuleGuard module="inventory"><InventoryPage /></ModuleGuard>;
            case 'classes':
                return <ModuleGuard module="classes"><ClassManager /></ModuleGuard>;
            case 'trainers':
                return <ModuleGuard module="trainers"><TrainerManager /></ModuleGuard>;
            case 'finance':
                return <PaymentsPage />;
            case 'tariffs':
                return <TariffPage />;
            case 'backup':
                return <SettingsPage />;
            case 'settings':
                return <GeneralSettings initialTab={selectedCustomer} />;
            case 'training':
                return <ModuleGuard module="training"><TrainingPage key="training-center" onNavigate={handleNavigate} initialTab="templates" /></ModuleGuard>;
            case 'priorities':
                return <ModuleGuard module="training"><TrainingPage key="training-priorities" onNavigate={handleNavigate} initialTab="priorities" /></ModuleGuard>;
            case 'history':
                return <ModuleGuard module="training"><TrainingHistoryPage initialCustomer={selectedCustomer} onNavigate={handleNavigate} /></ModuleGuard>;
            case 'library':
                return <ModuleGuard module="training"><LibraryPage /></ModuleGuard>;
            case 'help':
                return <HelpPage />;
            case 'rm':
                return <ModuleGuard module="rm"><RmReviewPage /></ModuleGuard>;
            case 'customers':
            default:
                return (
                    <CustomersPage onNavigate={handleNavigate} />
                );
        }
    };

    return (
        <Layout currentView={currentView} onNavigate={handleNavigate}>
            <ErrorBoundary key={currentView}>
                <div className="h-full">
                    {renderContent()}
                </div>
            </ErrorBoundary>
            <ToastContainer />
            <NotificationCenter onNavigate={handleNavigate} />
        </Layout>
    );
}

export default function App() {
    return (
        <ErrorBoundary>
            <LanguageProvider>
                <GymProvider>
                    <ToastProvider>
                        <NotificationProvider>
                            <Dashboard />
                        </NotificationProvider>
                    </ToastProvider>
                </GymProvider>
            </LanguageProvider>
        </ErrorBoundary>
    );
}
