import React, { useState } from 'react';
import Layout from './components/Layout';
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
import TemplatesPage from './features/templates/TemplatesPage';
import InventoryPage from './features/inventory/InventoryPage';

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
                return <InventoryPage />;
            case 'finance':
                return <PaymentsPage />;
            case 'tariffs':
                return <TariffPage />;
            case 'backup':
                return <SettingsPage />;
            case 'settings':
                return <GeneralSettings initialTab={selectedCustomer} />;
            case 'training':
                return <TrainingPage key="training-center" onNavigate={handleNavigate} initialTab="templates" />;
            case 'priorities':
                return <TrainingPage key="training-priorities" onNavigate={handleNavigate} initialTab="priorities" />;
            case 'history':
                return <TrainingHistoryPage initialCustomer={selectedCustomer} onNavigate={handleNavigate} />;
            case 'library':
                return <LibraryPage />;
            case 'templates':
                return <TemplatesPage />;
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
