import React from 'react';
import { AlertCircle } from 'lucide-react';

export function ConfirmModal({ action, onConfirm, onCancel }) {
    if (!action) return null;

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/90 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-slate-900 border border-white/10 p-6 rounded-2xl shadow-2xl max-w-sm w-full animate-in zoom-in-95 duration-200 text-center">
                <div className="w-12 h-12 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center mx-auto mb-4">
                    <AlertCircle size={24} />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">¿Estás seguro?</h3>
                <p className="text-slate-400 text-sm mb-6">
                    Vas a <span className="text-white font-bold underline">
                        {action.type === 'revoke' ? 'REVOCAR LA LICENCIA' :
                            action.type === 'delete_license' ? 'ELIMINAR DEFINITIVAMENTE' :
                                'DESVINCULAR EL HARDWARE'}
                    </span> de <span className="text-indigo-400 font-bold">{action.gymName}</span>.
                    {action.type === 'delete_license' ?
                        ' Esta acción es irreversible y borrará la clave de la base de datos.' :
                        ' Esta acción puede interrumpir el servicio temporalmente.'}
                </p>
                <div className="flex gap-2 justify-center">
                    <button
                        onClick={onCancel}
                        className="px-4 py-2 hover:bg-slate-800 text-slate-300 rounded-lg font-bold transition-colors text-sm"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={onConfirm}
                        className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg font-bold shadow-lg shadow-red-600/20 transition-colors text-sm"
                    >
                        Confirmar Acción
                    </button>
                </div>
            </div>
        </div>
    );
}
