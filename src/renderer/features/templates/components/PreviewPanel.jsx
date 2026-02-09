import React, { useMemo, useState } from 'react';
import { ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';

export default function PreviewPanel({ config }) {
    const [zoom, setZoom] = useState(0.7); // 70% por defecto
    const [numDays, setNumDays] = useState(2); // Número de días a mostrar
    const fonts = config.fonts || {
        title: { family: 'Inter', size: 24 },
        gymName: { family: 'Inter', size: 20 },
        header: { family: 'Inter', size: 12 },
        body: { family: 'Inter', size: 10 },
        dayLabel: { family: 'Inter', size: 10 }
    };

    const colors = config.colors || {};
    const backgroundColor = colors.backgroundColor || '#f8fafc';

    // Layout configuration
    const layout = config.layout || {};
    const logoConfig = layout.logo || { enabled: false, position: 'top-left', size: 'medium' };
    const headerConfig = layout.header || { style: 'horizontal', alignment: 'center', spacing: 16 };
    const sectionsConfig = layout.sections || {
        showClientInfo: true,
        clientInfoPosition: 'below-header',
        dayBlockSpacing: 16,
        tablePadding: { top: 8, right: 8, bottom: 8, left: 8 }
    };

    // Logo size mapping
    const logoSizes = {
        small: 60,
        medium: 100,
        large: 150
    };

    const logoSize = logoSizes[logoConfig.size] || 100;

    // Build ordered columns array: fixed + enabled optional columns
    const orderedColumns = useMemo(() => {
        const fixed = config.fixedColumns || [
            { key: 'name', label: 'Ejercicio', width: 25 },
            { key: 'series', label: 'Series', width: 10 },
            { key: 'reps', label: 'Reps', width: 10 }
        ];

        const optional = (config.optionalColumns || [])
            .filter(col => col.enabled);

        return [...fixed, ...optional];
    }, [config.fixedColumns, config.optionalColumns]);

    const allHeaders = orderedColumns.map(col => col.label.toUpperCase());

    // Dynamic sizing based on font sizes
    const titleSize = fonts.title?.size || 24;
    const gymNameSize = fonts.gymName?.size || 20;
    const headerSize = fonts.header?.size || 12;
    const bodySize = fonts.body?.size || 10;
    const dayLabelSize = fonts.dayLabel?.size || 10;

    // Sample data generator
    const getSampleValue = (colIndex, rowIndex, column) => {
        const key = orderedColumns[colIndex]?.key;

        // Fixed columns
        if (key === 'name') return `Ejercicio ${rowIndex}`;
        if (key === 'series') return '3';
        if (key === 'reps') return '10-12';

        // All optional fields - generate sample based on field type
        if (column?.type) {
            const type = column.type;

            if (type === 'text') return 'Texto';
            if (type === 'number') return '10';
            if (type === 'select') return 'Opción 1';
            if (type === 'checkbox') return '✓';
            if (type === 'url') return 'youtube.com/...';
            if (type === 'textarea') return 'Nota...';

            return '-';
        }

        return '-';
    };

    // Render logo based on position
    const renderLogo = (position) => {
        if (!logoConfig.enabled || !config.logo?.base64 || logoConfig.position !== position) {
            return null;
        }

        return (
            <img
                src={config.logo.base64}
                alt="Logo"
                style={{
                    maxWidth: `${logoSize}px`,
                    maxHeight: `${logoSize}px`,
                    objectFit: 'contain'
                }}
            />
        );
    };

    // Header layout: Logo on top, title below with background
    const renderHeader = () => {
        return (
            <div>
                {/* Logo area - top left with margin */}
                {config.logo?.base64 && (
                    <div className="flex justify-start py-2 px-4" style={{ backgroundColor }}>
                        <img
                            src={config.logo.base64}
                            alt="Logo"
                            style={{
                                width: '80px',
                                height: '60px',
                                objectFit: 'contain'
                            }}
                        />
                    </div>
                )}

                {/* Title with background color */}
                <div
                    className="flex items-center justify-center py-2"
                    style={{
                        backgroundColor: colors.titleBackgroundColor || '#1e293b'
                    }}
                >
                    <span
                        className="font-bold uppercase"
                        style={{
                            color: colors.titleColor || '#ffffff',
                            fontFamily: fonts.title?.family,
                            fontSize: `${titleSize}px`
                        }}
                    >
                        RUTINA DE ENTRENAMIENTO
                    </span>
                </div>

                {/* Client info */}
                <div className="px-4 py-1" style={{ backgroundColor }}>
                    <span
                        className="text-xs italic"
                        style={{
                            color: '#64748b',
                            fontFamily: fonts.body?.family
                        }}
                    >
                        CLIENTE: ISABEL RODRIGUEZ
                    </span>
                </div>
            </div>
        );
    };

    // Get logo position styles
    const getLogoPositionStyles = () => {
        if (!logoConfig.enabled || !config.logo?.base64) return null;

        const position = logoConfig.position || 'top-left';
        const margin = logoConfig.margin || { top: 10, right: 10, bottom: 10, left: 10 };

        const positionMap = {
            'top-left': { top: `${margin.top}px`, left: `${margin.left}px` },
            'top-center': { top: `${margin.top}px`, left: '50%', transform: 'translateX(-50%)' },
            'top-right': { top: `${margin.top}px`, right: `${margin.right}px` },
            'middle-left': { top: '50%', left: `${margin.left}px`, transform: 'translateY(-50%)' },
            'middle-center': { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' },
            'middle-right': { top: '50%', right: `${margin.right}px`, transform: 'translateY(-50%)' },
            'bottom-left': { bottom: `${margin.bottom}px`, left: `${margin.left}px` },
            'bottom-center': { bottom: `${margin.bottom}px`, left: '50%', transform: 'translateX(-50%)' },
            'bottom-right': { bottom: `${margin.bottom}px`, right: `${margin.right}px` }
        };

        return positionMap[position];
    };

    // Calcular ancho total en píxeles (aproximado: 1 col Excel ≈ 8px)
    const totalWidth = orderedColumns.reduce((sum, col) => sum + (col.width * 8), 0);

    return (
        <div className="flex-1 flex flex-col overflow-hidden">
            {/* Controles de Zoom */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-white/5 bg-slate-900/30">
                <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500 font-medium">Zoom:</span>
                    <button
                        onClick={() => setZoom(Math.max(0.3, zoom - 0.1))}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all"
                        title="Alejar"
                    >
                        <ZoomOut size={14} />
                    </button>
                    <span className="text-xs font-mono text-indigo-400 min-w-[3rem] text-center">
                        {Math.round(zoom * 100)}%
                    </span>
                    <button
                        onClick={() => setZoom(Math.min(1.5, zoom + 0.1))}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all"
                        title="Acercar"
                    >
                        <ZoomIn size={14} />
                    </button>
                    <button
                        onClick={() => setZoom(1)}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all"
                        title="100%"
                    >
                        <Maximize2 size={14} />
                    </button>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500 font-medium">Días:</span>
                    <select
                        value={numDays}
                        onChange={(e) => setNumDays(Number(e.target.value))}
                        className="px-2 py-1 text-xs bg-slate-800 border border-white/10 rounded-lg text-white focus:outline-none focus:border-indigo-500"
                    >
                        <option value={1}>1 día</option>
                        <option value={2}>2 días</option>
                        <option value={3}>3 días</option>
                        <option value={4}>4 días</option>
                        <option value={5}>5 días</option>
                    </select>
                </div>
            </div>

            {/* Contenedor con scroll */}
            <div className="flex-1 overflow-auto p-6 bg-slate-900/20">
                {/* Excel-like container con zoom */}
                <div
                    className="shadow-2xl relative origin-top-left"
                    style={{
                        backgroundColor,
                        transform: `scale(${zoom})`,
                        width: `${Math.max(totalWidth + 100, 800)}px`,
                        transformOrigin: 'top left'
                    }}
                >
                {/* Header section (includes logo, title, and client info) */}
                {renderHeader()}

                {/* Spacer */}
                <div style={{ height: '16px', backgroundColor }}></div>

                {/* Renderizar múltiples días */}
                {Array.from({ length: numDays }).map((_, dayIndex) => (
                    <React.Fragment key={dayIndex}>
                        {dayIndex > 0 && (
                            <div style={{ height: `${sectionsConfig.dayBlockSpacing}px`, backgroundColor }}></div>
                        )}

                        {/* Day Block - TABLE WITH BORDERS */}
                        <div
                            className="border border-slate-400"
                            style={{
                                margin: `0 ${sectionsConfig.tablePadding?.left || 8}px`
                            }}
                        >
                            <div
                                className="grid"
                                style={{
                                    gridTemplateColumns: `${dayLabelSize + 18}px ${orderedColumns.map(col => `${col.width * 8}px`).join(' ')}`
                                }}
                            >
                                {/* Day Label */}
                                <div
                                    className="row-span-4 flex items-center justify-center border-r border-slate-400"
                                    style={{
                                        backgroundColor: colors.dayLabelColor || '#334155',
                                        writingMode: 'vertical-rl',
                                        textOrientation: 'mixed',
                                        minWidth: `${dayLabelSize + 18}px`
                                    }}
                                >
                                    <span
                                        className="font-bold uppercase rotate-180 text-center"
                                        style={{
                                            color: colors.dayLabelTextColor || '#ffffff',
                                            fontFamily: fonts.dayLabel?.family,
                                            fontSize: `${dayLabelSize}px`
                                        }}
                                    >
                                        DÍA {dayIndex + 1}
                                    </span>
                                </div>

                        {/* Header cells */}
                        {allHeaders.map((header, idx) => (
                            <div
                                key={header}
                                className={`border-b border-slate-300 flex items-center justify-center ${idx < allHeaders.length - 1 ? 'border-r border-white/30' : ''}`}
                                style={{
                                    backgroundColor: colors.accent || '#10b981',
                                    padding: `${headerSize / 2}px`,
                                    minHeight: `${headerSize + 16}px`
                                }}
                            >
                                <span
                                    className="font-bold uppercase text-center"
                                    style={{
                                        color: colors.headerColor || '#ffffff',
                                        fontFamily: fonts.header?.family,
                                        fontSize: `${headerSize}px`
                                    }}
                                >
                                    {header}
                                </span>
                            </div>
                        ))}

                        {/* Data rows */}
                        {[1, 2, 3].map((rowIdx) => (
                            <React.Fragment key={rowIdx}>
                                {orderedColumns.map((column, colIdx) => (
                                    <div
                                        key={`r${rowIdx}-c${colIdx}`}
                                        className={`border-b border-slate-200 flex items-center justify-center ${colIdx < allHeaders.length - 1 ? 'border-r border-slate-200' : ''}`}
                                        style={{
                                            backgroundColor: '#ffffff',
                                            padding: `${bodySize / 2}px`,
                                            minHeight: `${bodySize + 12}px`
                                        }}
                                    >
                                        <span
                                            className="text-slate-700 font-bold text-center"
                                            style={{
                                                fontFamily: fonts.body?.family,
                                                fontSize: `${bodySize}px`
                                            }}
                                        >
                                            {getSampleValue(colIdx, rowIdx, column)}
                                        </span>
                                    </div>
                                ))}
                            </React.Fragment>
                        ))}
                    </div>
                </div>
            </React.Fragment>
        ))}

                    {/* Column order info */}
                    <div className="p-4" style={{ backgroundColor }}>
                        <div className="text-center text-[10px] text-slate-500">
                            <p className="font-mono">
                                Orden actual: {orderedColumns.map(c => c.label).join(' → ')}
                            </p>
                            <p className="mt-1 text-slate-600">
                                {orderedColumns.length} columnas activas
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
