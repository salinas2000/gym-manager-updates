import React from 'react';
import { Clock } from 'lucide-react';
import { cn } from '../../lib/utils';

export default function RecentActivity({ transactions }) {
    if (!transactions || transactions.length === 0) {
        return (
            <div className="text-center p-6 text-slate-500 text-sm">
                No recent activity.
            </div>
        );
    }

    const timeAgo = (dateStr) => {
        const date = new Date(dateStr);
        const now = new Date();
        const diffInSeconds = Math.floor((now - date) / 1000);

        if (diffInSeconds < 60) return 'Just now';

        const diffInMinutes = Math.floor(diffInSeconds / 60);
        if (diffInMinutes < 60) return `${diffInMinutes}m ago`;

        const diffInHours = Math.floor(diffInMinutes / 60);
        if (diffInHours < 24) return `${diffInHours}h ago`;

        const diffInDays = Math.floor(diffInHours / 24);
        return `${diffInDays}d ago`;
    };

    return (
        <div className="space-y-4">
            {transactions.map((tx, i) => (
                <div key={tx.id || i} className="flex items-center gap-3 p-3 rounded-xl bg-slate-950/30 border border-white/5 hover:bg-slate-900/50 transition-colors">
                    {/* Avatar / Initials */}
                    <div className="w-10 h-10 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 font-bold text-sm">
                        {tx.first_name?.[0]}{tx.last_name?.[0]}
                    </div>

                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">
                            {tx.first_name} {tx.last_name}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                            <Clock size={12} />
                            <span>{timeAgo(tx.payment_date)}</span>
                        </div>
                    </div>

                    <div className="text-right">
                        <p className="text-sm font-bold text-emerald-400">
                            +{tx.amount}€
                        </p>
                        <p className="text-[10px] text-slate-600 uppercase font-bold tracking-wider">
                            {tx.tariff_name || 'Payment'}
                        </p>
                    </div>
                </div>
            ))}
        </div>
    );
}
