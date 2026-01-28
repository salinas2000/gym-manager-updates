import React, { useEffect } from 'react';
import { AlertTriangle, CheckCircle, Info, X } from 'lucide-react';
import { createPortal } from 'react-dom';

/**
 * A modern, dark-themed Confirmation Modal.
 * Replaces native window.confirm() and window.alert().
 *
 * @param {boolean} isOpen - Whether the modal is visible.
 * @param {string} title - The header text.
 * @param {React.ReactNode} children - The message body (can be text or JSX).
 * @param {function} onClose - Called when cancelled/closed.
 * @param {function} onConfirm - Called when confirmed.
 * @param {string} confirmText - Label for confirm button.
 * @param {string} cancelText - Label for cancel button. 
 * @param {string} type - 'danger' | 'info' | 'success' | 'warning'. Controls colors/icons.
 * @param {boolean} showCancel - Whether to show the cancel button (false for alerts).
 */
export default function ConfirmationModal({
    isOpen,
    title,
    children,
    onClose,
    onConfirm,
    confirmText = 'Confirmar',
    cancelText = 'Cancelar',
    type = 'info',
    showCancel = true
}) {
    // Handle Escape key
    useEffect(() => {
        const handleEsc = (e) => {
            if (e.key === 'Escape' && isOpen) onClose();
        };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    // Type configurations
    const config = {
        danger: {
            icon: AlertTriangle,
            iconColor: 'text-red-500',
            borderColor: 'border-red-500/20',
            confirmBtn: 'bg-red-600 hover:bg-red-500 text-white shadow-red-900/20'
        },
        warning: {
            icon: AlertTriangle,
            iconColor: 'text-orange-500',
            borderColor: 'border-orange-500/20',
            confirmBtn: 'bg-orange-600 hover:bg-orange-500 text-white shadow-orange-900/20'
        },
        success: {
            icon: CheckCircle,
            iconColor: 'text-emerald-500',
            borderColor: 'border-emerald-500/20',
            confirmBtn: 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/20'
        },
        info: {
            icon: Info,
            iconColor: 'text-blue-500',
            borderColor: 'border-blue-500/20',
            confirmBtn: 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-900/20'
        }
    };

    const theme = config[type] || config.info;
    const Icon = theme.icon;

    // Use Portal to render outside of parent flow (avoids z-index issues)
    return createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200"
                onClick={onClose}
            />

            {/* Modal Content */}
            <div className={`relative bg-slate-900 border ${theme.borderColor} rounded-2xl shadow-2xl w-full max-w-md animate-in zoom-in-95 slide-in-from-bottom-5 duration-200 overflow-hidden`}>

                {/* Header */}
                <div className="flex items-center gap-3 p-5 border-b border-white/5 bg-slate-900/50">
                    <div className={`p-2 rounded-full bg-slate-800/50 ${theme.iconColor}`}>
                        <Icon size={20} />
                    </div>
                    <h3 className="font-bold text-lg text-white flex-1">{title}</h3>
                    <button
                        onClick={onClose}
                        className="p-1 rounded-full text-slate-500 hover:text-white hover:bg-slate-800 transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 text-slate-300 leading-relaxed">
                    {children}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 p-4 bg-slate-950/30 border-t border-white/5">
                    {showCancel && (
                        <button
                            onClick={onClose}
                            className="px-4 py-2 rounded-xl text-sm font-bold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                        >
                            {cancelText}
                        </button>
                    )}
                    <button
                        onClick={() => {
                            onConfirm();
                            onClose();
                        }}
                        className={`px-5 py-2 rounded-xl text-sm font-bold shadow-lg transition-all ${theme.confirmBtn}`}
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}
