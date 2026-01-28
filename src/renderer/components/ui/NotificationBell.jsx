import React from 'react';
import { Bell } from 'lucide-react';
import { useNotifications } from '../../context/NotificationContext';

export default function NotificationBell() {
    const { unreadCount, setDrawerOpen } = useNotifications();

    return (
        <button
            onClick={() => setDrawerOpen(true)}
            className="relative p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-all group"
            title="Soporte y Notificaciones"
        >
            <Bell size={20} className="group-hover:scale-110 transition-transform" />

            {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 flex h-4 w-4">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-4 w-4 bg-blue-600 border-2 border-slate-900 items-center justify-center">
                        <span className="text-[8px] font-black text-white">{unreadCount}</span>
                    </span>
                </span>
            )}
        </button>
    );
}
