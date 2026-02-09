import React, { useState } from 'react';
import ExerciseLibraryPage from './ExerciseLibraryPage';
import MesocycleEditor from './MesocycleEditor';
import TemplateManager from './TemplateManager';
import TrainingPriorities from './TrainingPriorities';
import { Layout, PlusCircle, Search, ChevronRight, ListTodo, Dumbbell } from 'lucide-react';
import { useGym } from '../../context/GymContext';

export default function TrainingManager({ onNavigate, initialTab }) {
    // Mode: 'hub' (Tabs) | 'editor' (MesocycleEditor)
    const [view, setView] = useState('hub');

    // Hub State
    const [activeTab, setActiveTab] = useState(initialTab || 'priorities'); // 'priorities' | 'templates' | 'create' | 'exercises'

    // Sync activeTab when initialTab prop changes (e.g. from Sidebar)
    React.useEffect(() => {
        if (initialTab) {
            setActiveTab(initialTab);
        }
    }, [initialTab]);

    // Editor State
    const [editingMeso, setEditingMeso] = useState(null);
    const [selectedCustomerForPlan, setSelectedCustomerForPlan] = useState(null);
    const [isTemplateMode, setIsTemplateMode] = useState(false);

    // Context
    const { customers } = useGym();
    const [customerSearch, setCustomerSearch] = useState('');

    // --- HANDLERS ---

    const handleBackToHub = () => {
        setView('hub');
        setEditingMeso(null);
        setSelectedCustomerForPlan(null);
    };

    // 1. New Template
    const handleNewTemplate = () => {
        setEditingMeso(null);
        setIsTemplateMode(true);
        setView('editor');
    };

    const handleEditTemplate = (tpl) => {
        setEditingMeso(tpl);
        setIsTemplateMode(true);
        setView('editor');
    };

    // 2. New Plan (Wizard Step 1: Select User)
    const handleStartPlan = (customer) => {
        setSelectedCustomerForPlan(customer); // Store ID or Object
        setEditingMeso(null);
        setIsTemplateMode(false);
        setView('editor');
    };

    // --- RENDER ---

    // 3. Navigation to history on Overlap Error
    const handleViewHistory = () => {
        if (selectedCustomerForPlan && onNavigate) {
            onNavigate('history', selectedCustomerForPlan);
        }
    };

    // --- RENDER ---

    if (view === 'editor') {
        return (
            <MesocycleEditor
                customerId={isTemplateMode ? null : selectedCustomerForPlan?.id}
                customerName={isTemplateMode ? null : (selectedCustomerForPlan ? `${selectedCustomerForPlan.first_name} ${selectedCustomerForPlan.last_name}` : '')}
                initialData={editingMeso}
                onBack={handleBackToHub}
                onSave={handleBackToHub}
                onViewHistory={handleViewHistory}
                templateMode={isTemplateMode}
            />
        );
    }

    // Hub View
    return (
        <div className="h-full flex flex-col">
            {/* HEADER */}
            <div className="flex justify-between items-end mb-6 px-2 border-b border-white/5 pb-2">
                <div>
                    <h2 className="text-2xl font-bold text-white mb-1">Centro de Entrenamiento</h2>
                    <p className="text-slate-500 text-sm">Gestiona plantillas y crea nuevos planes.</p>
                </div>

                <div className="flex bg-slate-900/50 p-1 rounded-xl border border-white/5">
                    <button
                        onClick={() => setActiveTab('exercises')}
                        className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${activeTab === 'exercises' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'
                            }`}
                    >
                        <Dumbbell size={16} /> Ejercicios
                    </button>
                    <button
                        onClick={() => setActiveTab('priorities')}
                        className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${activeTab === 'priorities' ? 'bg-orange-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'
                            }`}
                    >
                        <ListTodo size={16} /> Prioridades
                    </button>
                    <button
                        onClick={() => setActiveTab('templates')}
                        className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${activeTab === 'templates' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'
                            }`}
                    >
                        <Layout size={16} /> Plantillas
                    </button>
                    <button
                        onClick={() => setActiveTab('create')}
                        className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${activeTab === 'create' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'
                            }`}
                    >
                        <PlusCircle size={16} /> Nuevo Mesociclo
                    </button>
                </div>
            </div>

            {/* TABS CONTENT */}
            <div className="flex-1 relative overflow-hidden">

                {/* -1. EXERCISES TAB (Library) */}
                {activeTab === 'exercises' && (
                    <ExerciseLibraryPage />
                )}

                {/* 0. PRIORITIES TAB */}
                {activeTab === 'priorities' && (
                    <TrainingPriorities
                        onStartPlan={handleStartPlan}
                        onNavigate={onNavigate}
                    />
                )}

                {/* 1. TEMPLATES TAB */}
                {activeTab === 'templates' && (
                    <TemplateManager
                        onCreate={handleNewTemplate}
                        onEdit={handleEditTemplate}
                    />
                )}

                {/* 2. CREATE PLAN TAB (User Selector) */}
                {activeTab === 'create' && (
                    <div className="h-full flex flex-col max-w-2xl mx-auto pt-10">
                        <div className="text-center mb-8">
                            <h3 className="text-xl font-bold text-white mb-2">Crear Nuevo Plan</h3>
                            <p className="text-slate-400">Selecciona el cliente para comenzar a diseñar el mesociclo.</p>
                        </div>

                        <div className="bg-slate-900/50 p-6 rounded-2xl border border-white/5 shadow-2xl">
                            <div className="relative mb-4">
                                <Search className="absolute left-4 top-3.5 text-slate-500" size={20} />
                                <input
                                    type="text"
                                    placeholder="Buscar cliente..."
                                    value={customerSearch}
                                    onChange={(e) => setCustomerSearch(e.target.value)}
                                    className="w-full bg-slate-950 border border-white/10 rounded-xl py-3 pl-12 pr-4 text-white focus:outline-none focus:border-blue-500 text-lg"
                                    autoFocus
                                />
                            </div>

                            <div className="max-h-[400px] overflow-y-auto custom-scrollbar space-y-2">
                                {customers.filter(c =>
                                    c.first_name.toLowerCase().includes(customerSearch.toLowerCase()) ||
                                    c.last_name.toLowerCase().includes(customerSearch.toLowerCase())
                                ).map(c => (
                                    <button
                                        key={c.id}
                                        onClick={() => handleStartPlan(c)}
                                        className="w-full flex items-center justify-between p-4 rounded-xl bg-slate-800/30 hover:bg-blue-600/20 hover:border-blue-500/50 border border-transparent transition-all group"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center font-bold text-white">
                                                {c.first_name[0]}
                                            </div>
                                            <div className="text-left">
                                                <p className="font-bold text-white group-hover:text-blue-400">{c.first_name} {c.last_name}</p>
                                                <p className="text-xs text-slate-500">#{c.id}</p>
                                            </div>
                                        </div>
                                        <ChevronRight className="text-slate-600 group-hover:text-white" />
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
