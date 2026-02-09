import React from 'react';
import { History, Trash2, PlayCircle, CheckCircle } from 'lucide-react';
import { cn } from '../../../lib/utils';
import ControlSection from './ControlSection';

export default function HistoryPanel({
    templateInfo,
    editingFile,
    onLoad,
    onDelete,
    onActivate
}) {
    console.log('[HistoryPanel] templateInfo:', templateInfo);
    return (
        <ControlSection title="Diseños Previos" icon={History}>
            <div className="flex justify-between items-center mb-2 px-1">
                <span className="text-[8px] text-slate-500">
                    {templateInfo.history?.length || 0} diseños
                </span>
                {editingFile && (
                    <span className="text-[9px] text-emerald-400 font-bold animate-pulse">
                        EDITANDO
                    </span>
                )}
            </div>
            {templateInfo.history?.length > 0 ? (
                <div className="space-y-1.5 max-h-48 overflow-y-auto custom-scrollbar pr-1">
                    {templateInfo.history.map((item, idx) => (
                        <div
                            key={item.filename}
                            onClick={() => onLoad(item.filename)}
                            className={cn(
                                "group flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-all",
                                editingFile === item.filename
                                    ? "bg-indigo-500/20 border border-indigo-500/30"
                                    : templateInfo.activeFilename === item.filename
                                        ? "bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20"
                                        : "bg-slate-900/50 hover:bg-slate-800/70 border border-transparent"
                            )}
                        >
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                                {templateInfo.activeFilename === item.filename && (
                                    <CheckCircle size={12} className="text-emerald-400 flex-shrink-0" />
                                )}
                                <span className="text-[10px] text-white truncate font-medium">
                                    {item.name || `Diseño ${idx + 1}`}
                                </span>
                            </div>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                {templateInfo.activeFilename !== item.filename && (
                                    <button
                                        onClick={(e) => onActivate(item.filename, e)}
                                        className="p-1 text-emerald-500 hover:text-emerald-400"
                                        title="Activar"
                                    >
                                        <PlayCircle size={14} />
                                    </button>
                                )}
                                <button
                                    onClick={(e) => onDelete(item.filename, e)}
                                    className="p-1 text-red-500 hover:text-red-400"
                                    title="Eliminar"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="text-center py-4 text-slate-600 text-[10px]">
                    Sin diseños guardados
                </div>
            )}
        </ControlSection>
    );
}
