import React from 'react';
import { Type } from 'lucide-react';
import ControlSection from './ControlSection';
import { fontFamilies, fontSizes } from '../utils/defaultConfig';

function FontSelector({ label, family, size, onFamilyChange, onSizeChange }) {
    return (
        <div className="flex items-center gap-2 p-2 bg-slate-900/50 rounded-xl border border-white/5">
            <label className="text-[8px] font-black text-slate-500 uppercase w-16">{label}</label>
            <select
                value={family}
                onChange={e => onFamilyChange(e.target.value)}
                className="flex-1 bg-slate-800 text-white text-xs rounded-lg px-2 py-1.5 border border-white/10 focus:outline-none focus:border-indigo-500"
            >
                {fontFamilies.map(f => (
                    <option key={f} value={f}>{f}</option>
                ))}
            </select>
            <select
                value={size}
                onChange={e => onSizeChange(parseInt(e.target.value))}
                className="w-16 bg-slate-800 text-white text-xs rounded-lg px-2 py-1.5 border border-white/10 focus:outline-none focus:border-indigo-500"
            >
                {fontSizes.map(s => (
                    <option key={s} value={s}>{s}px</option>
                ))}
            </select>
        </div>
    );
}

export default function FontsTab({ config, setConfig }) {
    const updateFont = (key, prop, value) => {
        setConfig(prev => ({
            ...prev,
            fonts: {
                ...prev.fonts,
                [key]: { ...prev.fonts[key], [prop]: value }
            }
        }));
    };

    const fonts = config.fonts || {
        title: { family: 'Inter', size: 24 },
        header: { family: 'Inter', size: 12 },
        body: { family: 'Inter', size: 10 },
        dayLabel: { family: 'Inter', size: 10 }
    };

    return (
        <div className="space-y-4">
            <ControlSection title="Tipografías" icon={Type}>
                <div className="space-y-2">
                    <FontSelector
                        label="Título"
                        family={fonts.title?.family || 'Inter'}
                        size={fonts.title?.size || 24}
                        onFamilyChange={v => updateFont('title', 'family', v)}
                        onSizeChange={v => updateFont('title', 'size', v)}
                    />
                    <FontSelector
                        label="Cabecera"
                        family={fonts.header?.family || 'Inter'}
                        size={fonts.header?.size || 12}
                        onFamilyChange={v => updateFont('header', 'family', v)}
                        onSizeChange={v => updateFont('header', 'size', v)}
                    />
                    <FontSelector
                        label="Cuerpo"
                        family={fonts.body?.family || 'Inter'}
                        size={fonts.body?.size || 10}
                        onFamilyChange={v => updateFont('body', 'family', v)}
                        onSizeChange={v => updateFont('body', 'size', v)}
                    />
                    <FontSelector
                        label="Día"
                        family={fonts.dayLabel?.family || 'Inter'}
                        size={fonts.dayLabel?.size || 10}
                        onFamilyChange={v => updateFont('dayLabel', 'family', v)}
                        onSizeChange={v => updateFont('dayLabel', 'size', v)}
                    />
                </div>
            </ControlSection>
        </div>
    );
}
