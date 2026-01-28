import React from 'react';
import { useGym } from '../../context/GymContext';
import { Info, AlertTriangle, XCircle, CheckCircle, Megaphone } from 'lucide-react';
import { cn } from '../../lib/utils';

export default function GlobalBanner() {
    const { broadcast } = useGym();

    if (!broadcast || !broadcast.active) return null;

    const styles = {
        info: {
            bg: 'bg-indigo-600/90',
            border: 'border-indigo-400/30',
            icon: Info,
            text: 'text-white'
        },
        warning: {
            bg: 'bg-orange-600/90',
            border: 'border-orange-400/30',
            icon: AlertTriangle,
            text: 'text-white'
        },
        danger: {
            bg: 'bg-red-600/90',
            border: 'border-red-400/30',
            icon: XCircle,
            text: 'text-white'
        },
        success: {
            bg: 'bg-emerald-600/90',
            border: 'border-emerald-400/30',
            icon: CheckCircle,
            text: 'text-white'
        }
    };

    const config = styles[broadcast.type] || styles.info;
    const Icon = config.icon;

    return (
        <div className={cn(
            "w-full py-2 px-4 flex items-center justify-center gap-3 animate-in slide-in-from-top duration-500 sticky top-0 z-[100] backdrop-blur-md border-b",
            config.bg,
            config.border,
            config.text
        )}>
            <Icon size={16} className="shrink-0" />
            <span className="text-sm font-bold tracking-wide">
                {broadcast.message}
            </span>
            <div className="hidden md:flex items-center gap-1 opacity-60 text-[10px] uppercase font-black ml-4">
                <Megaphone size={10} /> MASTER BROADCAST
            </div>
        </div>
    );
}
