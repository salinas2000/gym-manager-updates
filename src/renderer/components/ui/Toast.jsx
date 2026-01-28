import React, { useEffect, useState } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';

const iconMap = {
    success: CheckCircle,
    error: XCircle,
    warning: AlertTriangle,
    info: Info
};

const colorMap = {
    success: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
    error: 'bg-red-500/10 border-red-500/30 text-red-400',
    warning: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
    info: 'bg-blue-500/10 border-blue-500/30 text-blue-400'
};

const progressColorMap = {
    success: 'bg-emerald-500',
    error: 'bg-red-500',
    warning: 'bg-amber-500',
    info: 'bg-blue-500'
};

export default function Toast({ id, message, type = 'info', duration = 4000, onClose }) {
    const [progress, setProgress] = useState(100);
    const Icon = iconMap[type] || Info;

    useEffect(() => {
        if (duration <= 0) return;

        const interval = 50; // Update every 50ms
        const decrement = (interval / duration) * 100;

        const timer = setInterval(() => {
            setProgress(prev => {
                const next = prev - decrement;
                return next <= 0 ? 0 : next;
            });
        }, interval);

        return () => clearInterval(timer);
    }, [duration]);

    return (
        <div
            className={`relative overflow-hidden rounded-xl border shadow-2xl backdrop-blur-sm animate-in slide-in-from-bottom-5 fade-in duration-300 ${colorMap[type]}`}
            style={{ minWidth: '320px', maxWidth: '420px' }}
        >
            <div className="flex items-start gap-3 p-4">
                <Icon size={20} className="flex-shrink-0 mt-0.5" />
                <p className="flex-1 text-sm font-medium text-white leading-relaxed">{message}</p>
                <button
                    onClick={() => onClose(id)}
                    className="flex-shrink-0 text-slate-400 hover:text-white transition-colors"
                >
                    <X size={16} />
                </button>
            </div>
            {duration > 0 && (
                <div className="h-1 bg-slate-950/30">
                    <div
                        className={`h-full transition-all duration-50 ${progressColorMap[type]}`}
                        style={{ width: `${progress}%` }}
                    />
                </div>
            )}
        </div>
    );
}
