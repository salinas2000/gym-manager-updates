import React, { useState, useEffect } from 'react';
import { Minus, Square, X, Copy } from 'lucide-react';

export default function WindowControls() {
    const [isMaximized, setIsMaximized] = useState(false);

    useEffect(() => {
        // Get initial state
        window.api.window.isMaximized().then(setIsMaximized);

        // Listen for changes
        const cleanup = window.api.window.onMaximizeChange((value) => {
            setIsMaximized(value);
        });

        return cleanup;
    }, []);

    return (
        <div className="flex items-center gap-0.5">
            <button
                onClick={() => window.api.window.minimize()}
                className="p-2 rounded-md text-slate-400 hover:bg-slate-700/50 hover:text-slate-200 transition-colors"
                title="Minimizar"
            >
                <Minus size={14} />
            </button>
            <button
                onClick={() => window.api.window.maximize()}
                className="p-2 rounded-md text-slate-400 hover:bg-slate-700/50 hover:text-slate-200 transition-colors"
                title={isMaximized ? 'Restaurar' : 'Maximizar'}
            >
                {isMaximized ? <Copy size={12} className="rotate-180" /> : <Square size={12} />}
            </button>
            <button
                onClick={() => window.api.window.close()}
                className="p-2 rounded-md text-slate-400 hover:bg-red-500/80 hover:text-white transition-colors"
                title="Cerrar"
            >
                <X size={14} />
            </button>
        </div>
    );
}
