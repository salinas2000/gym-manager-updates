import React from 'react';
import { Layout, Move, Maximize2, AlignCenter, AlignLeft, AlignRight, Layers } from 'lucide-react';
import { cn } from '../../../lib/utils';
import ControlSection from './ControlSection';

// Componente de selector de posición visual
function PositionGrid({ value, onChange, disabled }) {
    const positions = [
        { key: 'top-left', row: 0, col: 0, label: 'Superior Izq.' },
        { key: 'top-center', row: 0, col: 1, label: 'Superior Centro' },
        { key: 'top-right', row: 0, col: 2, label: 'Superior Der.' },
        { key: 'middle-left', row: 1, col: 0, label: 'Medio Izq.' },
        { key: 'middle-center', row: 1, col: 1, label: 'Centro' },
        { key: 'middle-right', row: 1, col: 2, label: 'Medio Der.' },
        { key: 'bottom-left', row: 2, col: 0, label: 'Inferior Izq.' },
        { key: 'bottom-center', row: 2, col: 1, label: 'Inferior Centro' },
        { key: 'bottom-right', row: 2, col: 2, label: 'Inferior Der.' }
    ];

    return (
        <div className="grid grid-cols-3 gap-2">
            {positions.map(pos => (
                <button
                    key={pos.key}
                    type="button"
                    onClick={() => !disabled && onChange(pos.key)}
                    disabled={disabled}
                    className={cn(
                        "h-14 rounded-lg border-2 transition-all flex items-center justify-center relative group",
                        value === pos.key
                            ? "border-indigo-500 bg-indigo-500/20"
                            : "border-white/10 bg-slate-900/30 hover:border-indigo-400/40 hover:bg-indigo-500/5",
                        disabled && "opacity-50 cursor-not-allowed"
                    )}
                    title={pos.label}
                >
                    <div className={cn(
                        "w-3 h-3 rounded-full transition-all",
                        value === pos.key ? "bg-indigo-400 scale-125" : "bg-slate-600 group-hover:bg-indigo-500/50"
                    )} />
                    {value === pos.key && (
                        <div className="absolute inset-0 border-2 border-indigo-400 rounded-lg animate-pulse" />
                    )}
                </button>
            ))}
        </div>
    );
}

// Selector de tamaño con preview visual
function SizeSelector({ value, onChange, disabled }) {
    const sizes = [
        { key: 'small', label: 'Pequeño', size: 60, icon: 8 },
        { key: 'medium', label: 'Mediano', size: 100, icon: 12 },
        { key: 'large', label: 'Grande', size: 150, icon: 16 }
    ];

    return (
        <div className="grid grid-cols-3 gap-2">
            {sizes.map(s => (
                <button
                    key={s.key}
                    onClick={() => !disabled && onChange(s.key)}
                    disabled={disabled}
                    className={cn(
                        "p-3 rounded-lg border-2 transition-all flex flex-col items-center gap-2",
                        value === s.key
                            ? "border-indigo-500 bg-indigo-500/10"
                            : "border-white/10 bg-slate-900/30 hover:border-white/20",
                        disabled && "opacity-50 cursor-not-allowed"
                    )}
                >
                    <Maximize2 size={s.icon} className={value === s.key ? "text-indigo-400" : "text-slate-500"} />
                    <span className="text-[10px] font-medium text-slate-400">{s.label}</span>
                    <span className="text-[8px] text-slate-600">{s.size}px</span>
                </button>
            ))}
        </div>
    );
}

// Selector de estilo de header
function HeaderStyleSelector({ value, onChange }) {
    const styles = [
        { key: 'horizontal', label: 'Horizontal', desc: 'Lado a lado' },
        { key: 'vertical', label: 'Vertical', desc: 'Arriba y abajo' },
        { key: 'split', label: 'Dividido', desc: 'Logo | Título | Gym' }
    ];

    return (
        <div className="space-y-2">
            {styles.map(style => (
                <button
                    key={style.key}
                    onClick={() => onChange(style.key)}
                    className={cn(
                        "w-full p-3 rounded-lg border-2 transition-all text-left",
                        value === style.key
                            ? "border-indigo-500 bg-indigo-500/10"
                            : "border-white/10 bg-slate-900/30 hover:border-white/20"
                    )}
                >
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="text-sm font-medium text-white">{style.label}</div>
                            <div className="text-[10px] text-slate-500 mt-0.5">{style.desc}</div>
                        </div>
                        <div className={cn(
                            "w-3 h-3 rounded-full border-2",
                            value === style.key
                                ? "border-indigo-400 bg-indigo-400"
                                : "border-slate-600"
                        )} />
                    </div>
                </button>
            ))}
        </div>
    );
}

// Selector de alineación
function AlignmentSelector({ value, onChange }) {
    const alignments = [
        { key: 'left', icon: AlignLeft, label: 'Izquierda' },
        { key: 'center', icon: AlignCenter, label: 'Centro' },
        { key: 'right', icon: AlignRight, label: 'Derecha' }
    ];

    return (
        <div className="grid grid-cols-3 gap-2">
            {alignments.map(align => (
                <button
                    key={align.key}
                    onClick={() => onChange(align.key)}
                    className={cn(
                        "p-3 rounded-lg border-2 transition-all flex flex-col items-center gap-1",
                        value === align.key
                            ? "border-indigo-500 bg-indigo-500/10"
                            : "border-white/10 bg-slate-900/30 hover:border-white/20"
                    )}
                    title={align.label}
                >
                    <align.icon size={16} className={value === align.key ? "text-indigo-400" : "text-slate-500"} />
                    <span className="text-[9px] text-slate-500">{align.label}</span>
                </button>
            ))}
        </div>
    );
}

// Control deslizador para espaciado
function SpacingSlider({ label, value, onChange, min = 0, max = 40, unit = 'px' }) {
    return (
        <div>
            <div className="flex items-center justify-between mb-2">
                <label className="text-[8px] font-black text-slate-600 uppercase">{label}</label>
                <span className="text-xs font-mono text-indigo-400">{value}{unit}</span>
            </div>
            <input
                type="range"
                min={min}
                max={max}
                value={value}
                onChange={e => onChange(Number(e.target.value))}
                className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
            />
        </div>
    );
}

export default function LayoutTab({ config, setConfig }) {
    const layout = config.layout || {};
    const logo = layout.logo || {};
    const header = layout.header || {};
    const sections = layout.sections || {};

    const updateLayout = (path, value) => {
        setConfig(prev => {
            const newLayout = { ...prev.layout };
            const keys = path.split('.');
            let current = newLayout;

            for (let i = 0; i < keys.length - 1; i++) {
                if (!current[keys[i]]) current[keys[i]] = {};
                current = current[keys[i]];
            }

            current[keys[keys.length - 1]] = value;

            return { ...prev, layout: newLayout };
        });
    };

    const toggleLogo = () => {
        updateLayout('logo.enabled', !logo.enabled);
    };

    return (
        <div className="space-y-4">
            {/* Logo Configuration */}
            <ControlSection
                title="Configuración del Logo"
                icon={Layout}
                description="Controla la posición y tamaño del logo en tu plantilla Excel"
            >
                <div className="space-y-4">
                    {/* Toggle Logo Mejorado */}
                    <div className="relative overflow-hidden">
                        <div className="flex items-center justify-between p-4 bg-gradient-to-r from-slate-900/50 to-slate-800/50 rounded-xl border border-white/10 backdrop-blur-sm">
                            <div className="flex items-center gap-3">
                                <div className={cn(
                                    "p-2 rounded-lg transition-all",
                                    logo.enabled ? "bg-emerald-500/20" : "bg-slate-800/50"
                                )}>
                                    <Layout size={18} className={logo.enabled ? "text-emerald-400" : "text-slate-600"} />
                                </div>
                                <div>
                                    <div className="text-sm font-semibold text-white">Mostrar Logo</div>
                                    <div className="text-[10px] text-slate-500 mt-0.5">
                                        {logo.enabled ? '✓ Visible en el Excel' : '✗ Oculto en el Excel'}
                                    </div>
                                </div>
                            </div>
                            <button
                                onClick={toggleLogo}
                                className={cn(
                                    "w-14 h-7 rounded-full transition-all relative shadow-inner",
                                    logo.enabled
                                        ? "bg-gradient-to-r from-emerald-500 to-emerald-600 shadow-emerald-500/30"
                                        : "bg-slate-700"
                                )}
                            >
                                <div className={cn(
                                    "w-6 h-6 bg-white rounded-full absolute top-0.5 transition-all shadow-lg",
                                    logo.enabled ? "left-7" : "left-0.5"
                                )} />
                            </button>
                        </div>
                        {logo.enabled && (
                            <div className="absolute -bottom-1 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500/50 via-emerald-400/50 to-emerald-500/50 blur-sm" />
                        )}
                    </div>

                    {logo.enabled && (
                        <>
                            {/* Position Grid */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <label className="text-[8px] font-black text-slate-600 uppercase tracking-wider">
                                        📍 Posición del Logo
                                    </label>
                                    <span className="text-[9px] text-indigo-400 font-medium px-2 py-0.5 bg-indigo-500/10 rounded-md">
                                        {logo.position?.replace('-', ' ').toUpperCase() || 'TOP-LEFT'}
                                    </span>
                                </div>
                                <PositionGrid
                                    value={logo.position || 'top-left'}
                                    onChange={v => updateLayout('logo.position', v)}
                                />
                                <p className="text-[9px] text-slate-600 text-center">
                                    Haz clic en la posición deseada para el logo
                                </p>
                            </div>

                            {/* Size Selector */}
                            <div className="space-y-2">
                                <label className="text-[8px] font-black text-slate-600 uppercase tracking-wider">
                                    📏 Tamaño del Logo
                                </label>
                                <SizeSelector
                                    value={logo.size || 'medium'}
                                    onChange={v => updateLayout('logo.size', v)}
                                />
                            </div>

                            {/* Margins */}
                            <div className="space-y-3 pt-4 border-t border-white/5">
                                <label className="text-[8px] font-black text-slate-600 uppercase tracking-wider block">
                                    📐 Márgenes
                                </label>
                                <SpacingSlider
                                    label="Margen Superior"
                                    value={logo.margin?.top || 10}
                                    onChange={v => updateLayout('logo.margin.top', v)}
                                />
                                <SpacingSlider
                                    label="Margen Lateral"
                                    value={logo.margin?.left || 10}
                                    onChange={v => updateLayout('logo.margin.left', v)}
                                />
                            </div>
                        </>
                    )}
                </div>
            </ControlSection>

            {/* Header Style */}
            <ControlSection
                title="Diseño de Cabecera"
                icon={Layers}
                description="Personaliza cómo se muestra el título y nombre de tu gimnasio"
            >
                <div className="space-y-4">
                    {/* Header Style */}
                    <div className="space-y-2">
                        <label className="text-[8px] font-black text-slate-600 uppercase tracking-wider">
                            🎨 Estilo de Distribución
                        </label>
                        <HeaderStyleSelector
                            value={header.style || 'horizontal'}
                            onChange={v => updateLayout('header.style', v)}
                        />
                    </div>

                    {/* Alignment */}
                    <div className="space-y-2 pt-2 border-t border-white/5">
                        <label className="text-[8px] font-black text-slate-600 uppercase tracking-wider">
                            📌 Alineación
                        </label>
                        <AlignmentSelector
                            value={header.alignment || 'center'}
                            onChange={v => updateLayout('header.alignment', v)}
                        />
                    </div>

                    {/* Spacing */}
                    <div className="pt-2 border-t border-white/5">
                        <SpacingSlider
                            label="📏 Espaciado entre elementos"
                            value={header.spacing || 16}
                            onChange={v => updateLayout('header.spacing', v)}
                        />
                    </div>
                </div>
            </ControlSection>

            {/* Sections Spacing */}
            <ControlSection
                title="Espaciado y Márgenes"
                icon={Move}
                description="Ajusta finamente los espacios entre elementos de la plantilla"
            >
                <div className="space-y-4">
                    <div className="space-y-3">
                        <label className="text-[8px] font-black text-slate-600 uppercase tracking-wider">
                            📊 Separación entre Días
                        </label>
                        <SpacingSlider
                            label="Espacio entre bloques"
                            value={sections.dayBlockSpacing || 16}
                            onChange={v => updateLayout('sections.dayBlockSpacing', v)}
                        />
                    </div>

                    <div className="pt-3 border-t border-white/5 space-y-3">
                        <label className="text-[8px] font-black text-slate-600 uppercase tracking-wider">
                            🔲 Padding de Tablas
                        </label>
                        <div className="space-y-3 bg-slate-900/30 rounded-lg p-3 border border-white/5">
                            <SpacingSlider
                                label="Vertical (Arriba/Abajo)"
                                value={sections.tablePadding?.top || 8}
                                onChange={v => {
                                    updateLayout('sections.tablePadding.top', v);
                                    updateLayout('sections.tablePadding.bottom', v);
                                }}
                                max={24}
                            />
                            <SpacingSlider
                                label="Horizontal (Lateral)"
                                value={sections.tablePadding?.left || 8}
                                onChange={v => {
                                    updateLayout('sections.tablePadding.left', v);
                                    updateLayout('sections.tablePadding.right', v);
                                }}
                                max={24}
                            />
                        </div>
                    </div>
                </div>
            </ControlSection>

            {/* Info Mejorado */}
            <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-indigo-500/20 p-4">
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl -mr-16 -mt-16" />
                <div className="relative">
                    <div className="flex items-start gap-3">
                        <div className="p-2 bg-indigo-500/20 rounded-lg">
                            <span className="text-xl">💡</span>
                        </div>
                        <div>
                            <p className="text-xs font-semibold text-indigo-300 mb-1">Vista Previa en Tiempo Real</p>
                            <p className="text-[10px] text-slate-400 leading-relaxed">
                                Todos los cambios que hagas se reflejan instantáneamente en la vista previa.
                                Usa los sliders y controles para crear el diseño perfecto para tu gimnasio.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
