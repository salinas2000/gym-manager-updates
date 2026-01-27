import React, { useState } from 'react';
import Layout from './components/Layout';
import { GymProvider } from './context/GymContext';
import { LanguageProvider } from './context/LanguageContext';

// Pages
import DashboardPage from './pages/DashboardPage';
import CustomersPage from './pages/CustomersPage';
import FinancePage from './pages/FinancePage';
import TrainingPage from './pages/TrainingPage';
import LibraryPage from './pages/LibraryPage';
import TrainingHistoryPage from './pages/TrainingHistoryPage';
import SettingsPage from './pages/SettingsPage'; // Backup Page
import GeneralSettings from './features/settings/SettingsPage'; // New Config Page

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
            case 'dashboard':
                return <DashboardPage />;
            case 'tariffs':
                return <FinancePage />;
            case 'backup':
                return <SettingsPage />;
            case 'settings':
                return <GeneralSettings />;
            case 'training':
                return <TrainingPage onNavigate={handleNavigate} />;
            case 'history':
                return <TrainingHistoryPage initialCustomer={selectedCustomer} />;
            case 'library':
                return <LibraryPage />;
            case 'customers':
            default:
                return (
                    <CustomersPage onNavigate={handleNavigate} />
                );
        }
    };

    return (
        <Layout currentView={currentView} onNavigate={handleNavigate}>
            <div className="h-full">
                {renderContent()}
            </div>
        </Layout>
    );
}

export default function App() {
    return (
        <LanguageProvider>
            <GymProvider>
                <Dashboard />
            </GymProvider>
        </LanguageProvider>
    );
}
