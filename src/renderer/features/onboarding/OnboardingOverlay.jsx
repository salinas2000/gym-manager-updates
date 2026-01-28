import React, { useState, useEffect } from 'react';
import { X, ChevronRight, CheckCircle, Users, Dumbbell, CreditCard, PartyPopper } from 'lucide-react';
import { useGym } from '../../context/GymContext';

// Pasos del Onboarding
const STEPS = [
    {
        id: 'welcome',
        title: '¡Bienvenido a Gym Manager!',
        description: 'Vamos a configurar tu gimnasio en 3 simples pasos.',
        icon: <PartyPopper className="text-amber-400" size={24} />,
        actionLabel: 'Comenzar Tour',
        targetTab: 'customers'
    },
    {
        id: 'create_customer',
        title: 'Tu Primer Cliente',
        description: 'Ve a la sección "Clientes" y registra a tu primer socio.',
        icon: <Users className="text-blue-400" size={24} />,
        actionLabel: 'Ir a Clientes',
        targetTab: 'customers',
        check: (stats) => stats && stats.totalCustomers > 0
    },
    {
        id: 'create_routine',
        title: 'Asignar Rutina',
        description: 'Crea un entrenamiento para tu nuevo cliente.',
        icon: <Dumbbell className="text-emerald-400" size={24} />,
        actionLabel: 'Ir a Entrenamientos',
        targetTab: 'training',
        check: (stats) => stats && stats.activeRoutines > 0
    },
    {
        id: 'first_payment',
        title: 'Registrar Pago',
        description: 'Registra el primer pago de cuota.',
        icon: <CreditCard className="text-purple-400" size={24} />,
        actionLabel: 'Ir a Pagos',
        targetTab: 'payments',
        check: (stats) => stats && stats.monthlyRevenue > 0
    }
];

export default function OnboardingOverlay({ currentTab, onNavigate }) {
    const { dashboardData } = useGym();
    const [currentStepIndex, setCurrentStepIndex] = useState(0);
    const [isVisible, setIsVisible] = useState(false);
    const [isMinimized, setIsMinimized] = useState(false);
    const [completed, setCompleted] = useState(false);

    // Cargar estado inicial
    useEffect(() => {
        const stored = localStorage.getItem('onboarding_state');
        const isDone = localStorage.getItem('onboarding_completed') === 'true';

        if (isDone) {
            setCompleted(true);
            return;
        }

        if (stored) {
            setCurrentStepIndex(parseInt(stored));
        }

        // Delay para que no aparezca de golpe al cargar la app
        setTimeout(() => setIsVisible(true), 1500);
    }, []);

    // Monitorear progreso
    useEffect(() => {
        if (completed) return;

        // Verificar si el paso actual ya se cumplió (basado en estadísticas)
        const step = STEPS[currentStepIndex];
        if (step.check && dashboardData) {
            if (step.check(dashboardData)) {
                advanceStep();
            }
        }
    }, [dashboardData, currentStepIndex, completed]);

    const advanceStep = () => {
        const next = currentStepIndex + 1;
        if (next >= STEPS.length) {
            finishOnboarding();
        } else {
            setCurrentStepIndex(next);
            localStorage.setItem('onboarding_state', next.toString());
        }
    };

    const finishOnboarding = () => {
        setCompleted(true);
        localStorage.setItem('onboarding_completed', 'true');
        setIsVisible(false);
        // Podríamos lanzar confeti aquí 🎉
    };

    const handleAction = () => {
        const step = STEPS[currentStepIndex];
        if (step.targetTab) {
            onNavigate(step.targetTab);
        }

        // Si es el paso de bienvenida, avanzamos manual
        if (step.id === 'welcome') {
            advanceStep();
        }
    };

    if (completed || !isVisible) return null;

    if (isMinimized) {
        return (
            <div
                onClick={() => setIsMinimized(false)}
                className="fixed bottom-6 right-6 bg-blue-600 hover:bg-blue-500 text-white p-3 rounded-full shadow-lg cursor-pointer transition-all hover:scale-110 z-50 animate-in fade-in slide-in-from-bottom-10"
            >
                <div className="relative">
                    <PartyPopper size={24} />
                    <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-blue-600"></span>
                </div>
            </div>
        );
    }

    const step = STEPS[currentStepIndex];

    return (
        <div className="fixed bottom-6 right-6 w-96 bg-slate-900/95 backdrop-blur-md border border-white/10 rounded-2xl shadow-2xl z-50 animate-in slide-in-from-bottom-10 fade-in duration-500 overflow-hidden">
            {/* Header con gradiente */}
            <div className="h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-emerald-500"></div>

            <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-2 text-xs font-bold text-blue-400 uppercase tracking-wider">
                        <span>Paso {currentStepIndex + 1} de {STEPS.length}</span>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={() => setIsMinimized(true)} className="text-slate-500 hover:text-white transition-colors">
                            <span className="sr-only">Minimizar</span>
                            <div className="w-4 h-1 bg-current rounded-full"></div>
                        </button>
                    </div>
                </div>

                <div className="flex gap-4 items-start mb-6">
                    <div className="bg-slate-800 p-3 rounded-xl border border-white/5 shadow-inner">
                        {step.icon}
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-white mb-1">{step.title}</h3>
                        <p className="text-sm text-slate-400 leading-relaxed">{step.description}</p>
                    </div>
                </div>

                <div className="flex gap-3">
                    <button
                        onClick={handleAction}
                        className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-2.5 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-900/20 group"
                    >
                        {step.actionLabel}
                        <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" />
                    </button>
                    {step.id !== 'welcome' && (
                        <button
                            onClick={advanceStep}
                            className="text-slate-500 hover:text-white px-3 py-2 rounded-lg text-xs font-medium transition-colors"
                        >
                            Saltar
                        </button>
                    )}
                </div>
            </div>

            {/* Progress Dots */}
            <div className="bg-slate-950/50 p-3 flex justify-center gap-1.5 backdrop-blur-sm border-t border-white/5">
                {STEPS.map((s, i) => (
                    <div
                        key={s.id}
                        className={`h-1.5 rounded-full transition-all duration-300 ${i === currentStepIndex ? 'w-6 bg-blue-500' : i < currentStepIndex ? 'w-1.5 bg-emerald-500' : 'w-1.5 bg-slate-700'}`}
                    />
                ))}
            </div>
        </div>
    );
}
