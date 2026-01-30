import React, { useState } from 'react';
import { Key, ShieldCheck, Server, Cpu, CheckCircle, AlertTriangle, Lock, Unlock, Copy } from 'lucide-react';

export default function SettingsLicense({
    licenseData,
    onActivate,
    onDeactivate,
    isSaving
}) {
    const [inputKey, setInputKey] = useState('');
    const isActivated = !!licenseData;

    const handleSubmit = (e) => {
        e.preventDefault();
        if (inputKey) onActivate(inputKey);
    };

    const handleCopyId = () => {
        if (licenseData?.gym_id) {
            navigator.clipboard.writeText(licenseData.gym_id);
            // Ideally show a toast here, but we'll keep it simple for the sub-component
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in zoom-in-95 duration-300">

            {/* HERDER / CONTEXT */}
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                        <ShieldCheck className="text-amber-400" />
                        Bóveda de Licencias
                    </h3>
                    <p className="text-slate-400 text-sm">Gestiona la identidad digital y seguridad de este terminal.</p>
                </div>
                <div className={`px-3 py-1 rounded-full border text-xs font-mono flex items-center gap-2 ${isActivated ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
                    <div className={`w-2 h-2 rounded-full ${isActivated ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`}></div>
                    {isActivated ? 'SYSTEM ONLINE' : 'SYSTEM LOCKED'}
                </div>
            </div>

            {/* MAIN CONTENT GRID */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

                {/* LEFT: VISUAL CARD (THE VAULT) */}
                <div className="relative group">
                    <div className="absolute inset-0 bg-gradient-to-br from-amber-500/20 to-blue-600/20 rounded-2xl blur-xl opacity-50 group-hover:opacity-75 transition-opacity"></div>
                    <div className="relative bg-slate-900 border border-white/10 rounded-2xl p-6 h-full flex flex-col justify-between overflow-hidden">

                        {/* Background Deco */}
                        <div className="absolute top-0 right-0 p-24 bg-gradient-to-b from-white/5 to-transparent rounded-full blur-3xl -mr-12 -mt-12 pointer-events-none"></div>

                        {/* Card Header */}
                        <div className="flex justify-between items-start mb-8">
                            <div className="bg-white/5 p-3 rounded-xl backdrop-blur-md border border-white/5">
                                <Key className="text-amber-400" size={24} />
                            </div>
                            {isActivated && (
                                <div className="text-right">
                                    <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">PLAN LEVEL</p>
                                    <p className="text-white font-black text-lg tracking-wider bg-clip-text text-transparent bg-gradient-to-r from-amber-200 to-amber-500">
                                        {licenseData.is_master ? 'MASTER EMPEROR' : 'PRO MEMBER'}
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Card Info */}
                        <div className="space-y-6">
                            <div>
                                <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mb-1">LICENSE HOLDER</p>
                                <p className="text-xl text-white font-mono truncate">
                                    {isActivated ? (licenseData.gym_name || 'Unknown Entity') : '••••••••••••••••'}
                                </p>
                            </div>

                            <div>
                                <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mb-1">GYM IDENTITY (UUID)</p>
                                <div className="flex items-center gap-2 group/id cursor-pointer" onClick={handleCopyId}>
                                    <p className="text-sm text-blue-400 font-mono break-all">
                                        {isActivated ? licenseData.gym_id : 'NO-DATA-FOUND'}
                                    </p>
                                    {isActivated && <Copy size={12} className="text-slate-600 group-hover/id:text-white transition-colors" />}
                                </div>
                            </div>
                        </div>

                        {/* Card Footer (Hardware ID) */}
                        <div className="mt-8 pt-6 border-t border-white/5 flex items-center justify-between">
                            <div className="flex items-center gap-2 text-slate-500 text-xs">
                                <Cpu size={14} />
                                <span className="font-mono">
                                    {isActivated ? `HW:${licenseData.hardware_id?.substring(0, 12)}...` : 'HW: DETECTING...'}
                                </span>
                            </div>
                            <div className="flex items-center gap-2 text-emerald-500 text-xs font-bold">
                                <Server size={14} />
                                <span>SECURE CONNECTION</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* RIGHT: INTERACTION PANEL */}
                <div className="space-y-6 flex flex-col justify-center">

                    {!isActivated ? (
                        /* ACTIVATION FLOW */
                        <div className="bg-slate-900/50 border border-white/5 rounded-2xl p-6">
                            <h4 className="text-white font-bold mb-4 flex items-center gap-2">
                                <Unlock size={18} className="text-blue-400" />
                                Desbloquear Sistema
                            </h4>
                            <p className="text-slate-400 text-sm mb-6">Instroduce tu clave de producto de 24 caracteres para activar.</p>

                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div className="relative">
                                    <input
                                        type="text"
                                        value={inputKey}
                                        onChange={(e) => setInputKey(e.target.value.toUpperCase())}
                                        placeholder="XXXX-XXXX-XXXX-XXXX"
                                        className="w-full bg-slate-950 border border-white/10 focus:border-blue-500 rounded-xl py-4 px-12 text-center text-white font-mono text-lg tracking-[0.2em] outline-none transition-all shadow-inner"
                                    />
                                    <Key className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" size={20} />
                                </div>

                                <button
                                    type="submit"
                                    disabled={!inputKey || isSaving}
                                    className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-xl shadow-lg shadow-blue-900/20 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    {isSaving ? 'Verificando...' : 'ACTIVAR TERMINAL'}
                                </button>
                            </form>
                        </div>
                    ) : (
                        /* ACTIVE STATUS & ACTIONS */
                        <div className="space-y-4">
                            <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-2xl p-6">
                                <div className="flex items-center gap-4 mb-2">
                                    <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-400">
                                        <CheckCircle size={24} />
                                    </div>
                                    <div>
                                        <h4 className="text-white font-bold">Licencia Verificada</h4>
                                        <p className="text-emerald-400/80 text-xs">Todos los sistemas operativos.</p>
                                    </div>
                                </div>
                            </div>

                            <button
                                onClick={onDeactivate}
                                className="w-full group bg-slate-900 border border-red-500/20 hover:border-red-500/50 rounded-xl p-4 flex items-center justify-between transition-all"
                            >
                                <div className="text-left">
                                    <p className="text-red-400 font-bold group-hover:text-red-300 transition-colors">Desvincular Dispositivo</p>
                                    <p className="text-slate-500 text-xs">Cerrar sesión y liberar licencia.</p>
                                </div>
                                <div className="p-2 bg-red-500/10 rounded-lg text-red-500 group-hover:bg-red-500/20 transition-colors">
                                    <Lock size={18} />
                                </div>
                            </button>
                        </div>
                    )}

                    <div className="text-center">
                        <p className="text-[10px] text-slate-600 flex items-center justify-center gap-2">
                            <ShieldCheck size={12} />
                            Protegido por cifrado de hardware v3.0
                        </p>
                    </div>

                </div>

            </div>
        </div>
    );
}
