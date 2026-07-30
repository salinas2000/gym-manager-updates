import React from 'react';
import { Lock } from 'lucide-react';
import { useGym } from '../context/GymContext';

/**
 * Envuelve una vista que pertenece a un módulo. Si el gimnasio no lo tiene en su
 * plan, en vez de la vista se muestra una pantalla de "no incluido".
 *
 * Decisión de producto: NO se esconde. El cliente ve que la función existe y a
 * qué no tiene acceso, lo que invita a ampliar el plan. Esconderla no vende.
 *
 * Es además la red que tapa el agujero de siempre: hasta ahora el menú se
 * ocultaba pero la vista seguía resolviendo si algo navegaba hasta ella. Con
 * esto, toda ruta a un módulo apagado acaba aquí. El candado de verdad sigue
 * estando en el IPC (src/main/config/modules.js): esto es la cara visible.
 */
export default function ModuleGuard({ module, children }) {
    const { hasModule, moduleCatalog } = useGym();

    if (hasModule(module)) return children;

    const label = moduleCatalog?.[module]?.label || 'Esta función';

    return (
        <div className="h-full flex items-center justify-center p-8 animate-in fade-in duration-200">
            <div className="bg-slate-900/50 rounded-2xl p-10 border border-white/5 shadow-xl glass-panel flex flex-col items-center text-center max-w-lg">
                <div className="flex size-16 items-center justify-center rounded-full bg-slate-800/70 mb-5">
                    <Lock className="text-slate-500" size={26} />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">{label} no está en tu plan</h3>
                <p className="text-sm text-slate-400">
                    Este módulo no está incluido en el plan de tu gimnasio. Puedes añadirlo
                    en cualquier momento para desbloquearlo.
                </p>
                <p className="text-xs text-slate-600 mt-5">
                    Habla con tu proveedor para ampliar el plan.
                </p>
            </div>
        </div>
    );
}
