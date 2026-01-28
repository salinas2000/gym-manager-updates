import React from 'react';
import { Loader2 } from 'lucide-react';

export default function LoadingSpinner({ size = 'md', text = '', overlay = false, className = '' }) {
    const sizeClasses = {
        sm: 'w-4 h-4',
        md: 'w-6 h-6',
        lg: 'w-8 h-8',
        xl: 'w-12 h-12'
    };

    const spinner = (
        <div className={`flex flex-col items-center justify-center gap-3 ${className}`}>
            <Loader2 className={`${sizeClasses[size]} text-blue-500 animate-spin`} />
            {text && <p className="text-sm text-slate-400 font-medium">{text}</p>}
        </div>
    );

    if (overlay) {
        return (
            <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[9998] flex items-center justify-center">
                {spinner}
            </div>
        );
    }

    return spinner;
}
