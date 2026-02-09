import React, { useState, useEffect } from 'react';
import { useGym } from '../../context/GymContext';
import CustomerTrainingTab from './CustomerTrainingTab';
import MesocycleEditor from './MesocycleEditor';
import { Search, User, Dumbbell, ChevronRight } from 'lucide-react';

export default function TrainingHistory({ initialCustomer, onNavigate }) {
    const { customers } = useGym();
    const [selectedCustomer, setSelectedCustomer] = useState(initialCustomer || null);
    const [search, setSearch] = useState('');
    const [filterActive, setFilterActive] = useState('active'); // active, inactive, all

    // Editor State (for editing plans found in history)
    // We lift this state here so we can overlay the editor over the whole history view
    const [editingMeso, setEditingMeso] = useState(null);
    const [isEditorOpen, setIsEditorOpen] = useState(false);

    // Sync initialCustomer
    useEffect(() => {
        if (initialCustomer) {
            setSelectedCustomer(initialCustomer);
        }
    }, [initialCustomer]);

    // Auto-select first customer if none selected (from filtered list)
    useEffect(() => {
        const filtered = customers.filter(c => {
            const matchesSearch = `${c.first_name} ${c.last_name}`.toLowerCase().includes(search.toLowerCase());
            const matchesActive = filterActive === 'all'
                ? true
                : filterActive === 'active' ? c.active === 1 : c.active === 0;
            return matchesSearch && matchesActive;
        });

        if (!selectedCustomer && filtered.length > 0) {
            setSelectedCustomer(filtered[0]);
        }
    }, [customers, selectedCustomer, search, filterActive]);

    // Filtering for the display list
    const filteredCustomers = customers.filter(c => {
        const matchesSearch = `${c.first_name} ${c.last_name}`.toLowerCase().includes(search.toLowerCase());
        const matchesActive = filterActive === 'all'
            ? true
            : filterActive === 'active' ? c.active === 1 : c.active === 0;
        return matchesSearch && matchesActive;
    });

    const handleEditPlan = (meso) => {
        setEditingMeso(meso);
        setIsEditorOpen(true);
    };

    const handleNewPlan = () => {
        setEditingMeso(null);
        setIsEditorOpen(true);
    };

    const handleCloseEditor = () => {
        setIsEditorOpen(false);
        setEditingMeso(null);
        // Refresh? CustomerTrainingTab auto-refreshes on mount/updates usually.
    };

    if (isEditorOpen && selectedCustomer) {
        return (
            <MesocycleEditor
                customerId={selectedCustomer.id}
                customerName={`${selectedCustomer.first_name} ${selectedCustomer.last_name}`}
                initialData={editingMeso}
                onBack={handleCloseEditor}
                onSave={handleCloseEditor}
                templateMode={false} // History is for real plans
            />
        );
    }

    return (
        <div className="h-full flex bg-slate-950/50 backdrop-blur-sm rounded-3xl border border-white/5 overflow-hidden">
            {/* LEFT: USER LIST */}
            <div className="w-80 border-r border-white/5 bg-slate-900/50 flex flex-col">
                <div className="p-4 border-b border-white/5">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-white font-bold flex items-center gap-2">
                            <Dumbbell className="text-blue-500" size={20} />
                            Historial
                        </h2>

                        <div className="flex bg-slate-950/50 rounded-lg p-0.5 border border-white/5">
                            {['active', 'inactive', 'all'].map((status) => (
                                <button
                                    key={status}
                                    onClick={() => setFilterActive(status)}
                                    className={`px-2 py-1 rounded text-[10px] font-bold uppercase transition-all ${filterActive === status
                                        ? 'bg-blue-600 text-white shadow-lg'
                                        : 'text-slate-500 hover:text-slate-300'
                                        }`}
                                >
                                    {status === 'active' ? 'Activos' : status === 'inactive' ? 'Bajas' : 'Todos'}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="relative">
                        <Search className="absolute left-3 top-2.5 text-slate-500" size={16} />
                        <input
                            type="text"
                            placeholder="Buscar cliente..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full bg-slate-950 border border-white/10 rounded-xl py-2 pl-9 pr-4 text-sm text-white focus:outline-none focus:border-blue-500"
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
                    {filteredCustomers.map(c => (
                        <button
                            key={c.id}
                            onClick={() => setSelectedCustomer(c)}
                            className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${selectedCustomer?.id === c.id
                                ? 'bg-blue-600/20 border border-blue-500/30 text-white'
                                : 'hover:bg-slate-800/50 text-slate-400 hover:text-white border border-transparent'
                                }`}
                        >
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${selectedCustomer?.id === c.id ? 'bg-blue-600' : 'bg-slate-800'
                                }`}>
                                {c.first_name?.[0] || 'U'}
                            </div>
                            <div className="text-left flex-1 min-w-0">
                                <p className="font-medium truncate">{c.first_name} {c.last_name}</p>
                            </div>
                            {selectedCustomer?.id === c.id && <ChevronRight size={14} className="text-blue-400" />}
                        </button>
                    ))}
                </div>
            </div>

            {/* RIGHT: HISTORY CONTENT */}
            <div className="flex-1 flex flex-col bg-slate-950/30">
                {selectedCustomer ? (
                    <div className="h-full flex flex-col p-6">
                        <div className="flex items-center gap-4 mb-6 pb-4 border-b border-white/5">
                            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center text-xl font-bold text-white shadow-lg">
                                {selectedCustomer.first_name?.[0] || 'U'}
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold text-white leading-none">
                                    {selectedCustomer.first_name} {selectedCustomer.last_name}
                                </h2>
                                <p className="text-blue-400 text-sm font-medium mt-1">
                                    Historial Completo
                                </p>
                            </div>
                        </div>

                        <div className="flex-1 overflow-hidden relative">
                            <CustomerTrainingTab
                                customerId={selectedCustomer.id}
                                onNewMesocycle={handleNewPlan}
                                onSelectMesocycle={handleEditPlan}
                                readOnly={false}
                                onNavigate={onNavigate}
                            />
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-slate-500">
                        <Dumbbell size={64} className="mb-4 opacity-10" />
                        <p className="text-lg font-medium">Selecciona un cliente</p>
                        <p className="text-sm">Explora el historial de entrenamientos</p>
                    </div>
                )}
            </div>
        </div>
    );
}
