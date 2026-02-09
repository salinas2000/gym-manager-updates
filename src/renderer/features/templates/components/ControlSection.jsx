import React from 'react';
import { cn } from '../../../lib/utils';

export default function ControlSection({ title, icon: Icon, description, children }) {
    return (
        <div className="bg-slate-900/30 rounded-3xl border border-white/5 p-5 animate-in slide-in-from-left duration-300">
            <div className="mb-4">
                <h4 className="text-[9px] font-black text-slate-600 uppercase tracking-[0.3em] flex items-center gap-2">
                    {Icon && <Icon size={12} className="text-slate-500" />} {title}
                </h4>
                {description && (
                    <p className="text-[10px] text-slate-500 mt-1">{description}</p>
                )}
            </div>
            {children}
        </div>
    );
}
