import React from 'react';
import { cn } from '../../lib/utils';
import { Calendar, Clock, CheckCircle2 } from 'lucide-react';

export default function MembershipTimeline({ history }) {
    if (!history || history.length === 0) return null;

    const formatDate = (dateStr) => {
        if (!dateStr) return 'Present';
        return new Date(dateStr).toLocaleDateString('es-ES', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        });
    };

    const calculateDuration = (start, end) => {
        const startDate = new Date(start);
        const endDate = end ? new Date(end) : new Date();
        const diffTime = Math.abs(endDate - startDate);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays;
    };

    return (
        <div className="relative pl-4 border-l-2 border-slate-800 border-dashed space-y-6">
            {history.map((record, index) => {
                const isCurrent = !record.end_date;
                const duration = calculateDuration(record.start_date, record.end_date);

                return (
                    <div key={record.id} className="relative">
                        {/* Dot indicator */}
                        <div className={cn(
                            "absolute -left-[21px] top-1 w-3 h-3 rounded-full border-2",
                            isCurrent
                                ? "bg-emerald-500 border-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]"
                                : "bg-slate-900 border-slate-600"
                        )} />

                        <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                                <span className={cn(
                                    "text-sm font-bold",
                                    isCurrent ? "text-emerald-400" : "text-slate-400"
                                )}>
                                    {formatDate(record.start_date)} - {formatDate(record.end_date)}
                                </span>
                                {isCurrent && (
                                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-bold border border-emerald-500/20">
                                        ACTUAL
                                    </span>
                                )}
                            </div>

                            <div className="flex items-center gap-2 text-xs text-slate-500">
                                <Clock size={12} />
                                <span>{duration} días</span>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
