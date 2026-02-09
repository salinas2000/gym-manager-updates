import React, { useState, useEffect } from 'react';
import {
    Clock,
    AlertCircle,
    CheckCircle2,
    Calendar,
    Search,
    PlusCircle,
    ChevronRight,
    User,
    History
} from 'lucide-react';
import { Badge, Card, Title, Text, Button } from '@tremor/react';

export default function TrainingPriorities({ onStartPlan, onNavigate }) {
    const [priorities, setPriorities] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    const fetchPriorities = async () => {
        setLoading(true);
        try {
            const res = await window.api.training.getPriorities();
            if (res.success) {
                setPriorities(res.data);
            }
        } catch (error) {
            console.error('Error fetching training priorities:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPriorities();
    }, []);

    const filtered = priorities.filter(p =>
        `${p.first_name} ${p.last_name}`.toLowerCase().includes(search.toLowerCase())
    );

    const getStatusInfo = (status, days) => {
        switch (status) {
            case 'expired':
                return {
                    label: 'CADUCADO',
                    color: 'red',
                    icon: AlertCircle,
                    desc: 'El plan terminó hace tiempo'
                };
            case 'none':
                return {
                    label: 'SIN PLAN',
                    color: 'rose',
                    icon: PlusCircle,
                    desc: 'No tiene planes activos'
                };
            case 'urgent':
                return {
                    label: 'URGENTE',
                    color: 'orange',
                    icon: Clock,
                    desc: `Vence en ${days} días`
                };
            case 'good':
                return {
                    label: 'AL DÍA',
                    color: 'emerald',
                    icon: CheckCircle2,
                    desc: `Vence en ${days} días`
                };
            default:
                return { label: 'Desconocido', color: 'slate', icon: Clock };
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-64 text-slate-500">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mb-4"></div>
                <p>Calculando prioridades...</p>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col space-y-6">
            {/* Search Bar */}
            <div className="max-w-md">
                <div className="relative">
                    <Search className="absolute left-3 top-2.5 text-slate-500" size={18} />
                    <input
                        type="text"
                        placeholder="Buscar cliente en prioridades..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full bg-slate-900/50 border border-white/10 rounded-xl py-2 pl-10 pr-4 text-white focus:outline-none focus:border-blue-500 transition-all font-medium"
                    />
                </div>
            </div>

            {/* Grid List */}
            <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 pb-10">
                {filtered.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filtered.map((item) => {
                            const info = getStatusInfo(item.status, item.daysRemaining);
                            return (
                                <Card
                                    key={item.id}
                                    className={`bg-slate-900/40 border-white/5 hover:border-white/10 transition-all shadow-xl group`}
                                >
                                    <div className="flex justify-between items-start mb-4">
                                        <div className={`w-12 h-12 rounded-2xl bg-${info.color}-500/10 flex items-center justify-center text-${info.color}-500 shadow-inner`}>
                                            <info.icon size={24} />
                                        </div>
                                        <Badge color={info.color} size="xs" className="font-bold tracking-wider uppercase">
                                            {info.label}
                                        </Badge>
                                    </div>

                                    <div className="mb-4">
                                        <Title className="text-white group-hover:text-blue-400 transition-colors uppercase tracking-tight text-lg">
                                            {item.first_name} {item.last_name}
                                        </Title>
                                        <div className="flex items-center gap-2 mt-1">
                                            <Text className="text-slate-500 text-xs">
                                                {info.desc}
                                            </Text>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 pt-4 border-t border-white/5">
                                        <Button
                                            size="xs"
                                            variant="secondary"
                                            className="flex-1 bg-blue-600/10 text-blue-400 border-blue-500/20 hover:bg-blue-600 hover:text-white transition-all font-bold"
                                            onClick={() => onStartPlan(item)}
                                            icon={PlusCircle}
                                        >
                                            {item.status === 'none' ? 'CREAR PLAN' : 'RENOVAR PLAN'}
                                        </Button>
                                        <button
                                            onClick={() => onNavigate('history', item)}
                                            className="p-2 rounded-lg bg-slate-800/50 text-slate-400 hover:bg-slate-700 hover:text-white transition-all"
                                            title="Ver historial"
                                        >
                                            <History size={16} />
                                        </button>
                                    </div>
                                </Card>
                            );
                        })}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center h-64 text-slate-600">
                        <CheckCircle2 size={48} className="mb-4 opacity-10" />
                        <p className="text-lg font-bold">¡Todo al día!</p>
                        <p className="text-sm">No hay clientes que necesiten entrenamiento urgente.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
