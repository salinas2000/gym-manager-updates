import React, { useState } from 'react';
import { Palette, Image, Upload, X } from 'lucide-react';
import { cn } from '../../../lib/utils';
import ControlSection from './ControlSection';
import { backgroundPresets } from '../utils/defaultConfig';
import { useToast } from '../../../context/ToastContext';

function ColorInput({ label, value, onChange }) {
    return (
        <div>
            <label className="text-[8px] font-black text-slate-600 uppercase mb-1 block">{label}</label>
            <div className="flex items-center gap-2 p-1.5 bg-slate-900 rounded-xl border border-white/5">
                <input
                    type="color"
                    value={value}
                    onChange={e => onChange(e.target.value)}
                    className="w-6 h-6 rounded-lg bg-transparent border-none p-0 cursor-pointer"
                />
                <span className="text-[8px] font-mono text-slate-500">{value}</span>
            </div>
        </div>
    );
}

export default function ColorsTab({ config, setConfig }) {
    const toast = useToast();
    const [loadingLogo, setLoadingLogo] = useState(false);

    const updateColor = (key, value) => {
        setConfig(prev => ({
            ...prev,
            colors: { ...prev.colors, [key]: value }
        }));
    };

    const handleSelectLogo = async () => {
        setLoadingLogo(true);
        try {
            const response = await window.api.templates.selectLogo();
            console.log('[ColorsTab] Logo selection response:', response);

            // El IPC envuelve la respuesta en {success, data}
            let result = response;
            if (response && response.success && response.data) {
                result = response.data;
            }

            if (result === null || response === null) {
                // User cancelled
                console.log('[ColorsTab] User cancelled logo selection');
                return;
            }

            if (result && result.base64 && result.base64.startsWith('data:image/')) {
                setConfig(prev => ({
                    ...prev,
                    logo: {
                        path: result.path,
                        base64: result.base64
                    }
                }));
                toast.success('Logo seleccionado correctamente');
            } else {
                console.error('[ColorsTab] Invalid result:', result);
                toast.error('Error al leer el logo - formato inválido');
            }
        } catch (err) {
            console.error('[ColorsTab] Error selecting logo:', err);
            toast.error(`Error: ${err.message || 'Error al seleccionar logo'}`);
        } finally {
            setLoadingLogo(false);
        }
    };

    const handleRemoveLogo = () => {
        setConfig(prev => ({
            ...prev,
            logo: null
        }));
        toast.success('Logo eliminado');
    };

    return (
        <div className="space-y-4">
            {/* Logo Section */}
            <ControlSection title="Logo del Gimnasio" icon={Image}>
                <div className="space-y-3">
                    {config.logo?.base64 ? (
                        <div className="relative">
                            <div className="flex items-center gap-3 p-3 bg-slate-900/50 rounded-lg border border-white/10">
                                <img
                                    src={config.logo.base64}
                                    alt="Logo"
                                    className="w-12 h-12 object-contain rounded bg-white/5"
                                />
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs text-white font-medium truncate">
                                        {config.logo.path?.split('\\').pop() || 'Logo seleccionado'}
                                    </p>
                                    <p className="text-[10px] text-slate-500">Imagen cargada correctamente</p>
                                </div>
                                <button
                                    onClick={handleRemoveLogo}
                                    className="p-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                                    title="Eliminar logo"
                                >
                                    <X size={16} />
                                </button>
                            </div>
                        </div>
                    ) : (
                        <button
                            onClick={handleSelectLogo}
                            disabled={loadingLogo}
                            className="w-full flex items-center justify-center gap-2 p-4 bg-slate-900/30 hover:bg-slate-800/50 rounded-lg border border-dashed border-white/10 hover:border-indigo-500/30 text-slate-400 hover:text-white transition-all disabled:opacity-50"
                        >
                            <Upload size={18} />
                            <span className="text-sm font-medium">
                                {loadingLogo ? 'Cargando...' : 'Seleccionar Logo'}
                            </span>
                        </button>
                    )}
                    <p className="text-[10px] text-slate-600 text-center">
                        Formatos: JPG, PNG • Se mostrará en la esquina del Excel
                    </p>
                </div>
            </ControlSection>

            <ControlSection title="Área de Título" icon={Palette}>
                <div className="grid grid-cols-2 gap-3">
                    <ColorInput
                        label="Fondo Título"
                        value={config.colors.titleBackgroundColor || '#1e293b'}
                        onChange={v => updateColor('titleBackgroundColor', v)}
                    />
                    <ColorInput
                        label="Texto Título"
                        value={config.colors.titleColor || '#ffffff'}
                        onChange={v => updateColor('titleColor', v)}
                    />
                </div>
            </ControlSection>

            <ControlSection title="Cabecera Tabla" icon={Palette}>
                <div className="grid grid-cols-2 gap-3">
                    <ColorInput
                        label="Color Fondo"
                        value={config.colors.accent || '#10b981'}
                        onChange={v => updateColor('accent', v)}
                    />
                    <ColorInput
                        label="Color Texto"
                        value={config.colors.headerColor || '#ffffff'}
                        onChange={v => updateColor('headerColor', v)}
                    />
                </div>
            </ControlSection>

            <ControlSection title="Etiqueta Día" icon={Palette}>
                <div className="grid grid-cols-2 gap-3">
                    <ColorInput
                        label="Color Fondo"
                        value={config.colors.dayLabelColor || '#334155'}
                        onChange={v => updateColor('dayLabelColor', v)}
                    />
                    <ColorInput
                        label="Color Texto"
                        value={config.colors.dayLabelTextColor || '#ffffff'}
                        onChange={v => updateColor('dayLabelTextColor', v)}
                    />
                </div>
            </ControlSection>

            <ControlSection title="Fondo General" icon={Palette}>
                <div className="space-y-3">
                    <ColorInput
                        label="Color de Fondo"
                        value={config.colors.backgroundColor || '#f8fafc'}
                        onChange={v => updateColor('backgroundColor', v)}
                    />
                    <div className="flex gap-2 flex-wrap">
                        {backgroundPresets.map(bg => (
                            <button
                                key={bg.color}
                                onClick={() => updateColor('backgroundColor', bg.color)}
                                className={cn(
                                    "w-8 h-8 rounded-lg border-2 transition-all",
                                    config.colors.backgroundColor === bg.color
                                        ? "border-indigo-500 scale-110"
                                        : "border-white/10 hover:scale-105"
                                )}
                                style={{ backgroundColor: bg.color }}
                                title={bg.label}
                            />
                        ))}
                    </div>
                </div>
            </ControlSection>
        </div>
    );
}
