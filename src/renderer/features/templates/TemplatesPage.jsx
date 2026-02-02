import React, { useState, useEffect } from 'react';
import { Palette, Image as ImageIcon, Type, Save, CheckCircle, Smartphone, Layout as LayoutIcon, ChevronRight, Eye, History, Columns, Table as TableIcon, Plus, Trash2, XCircle, PlayCircle } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useNotifications } from '../../context/NotificationContext';

export default function TemplatesPage() {
    const { addNotification } = useNotifications();
    const [loading, setLoading] = useState(false);
    const [templateInfo, setTemplateInfo] = useState({ exists: false, history: [] });

    // Design State
    const [config, setConfig] = useState({
        colors: {
            primary: '#1e293b',
            accent: '#10b981',
        },
        backgroundColor: '#f8fafc',
        font: 'Inter',
        logoPath: null,
        visibleColumns: {
            rpe: true,
            rest: true,
            weight: true,
            next: true,
        },
        customColumns: [], // [{ id, name }]
        gymName: 'Mi Gimnasio'
    });

    const fonts = ['Inter', 'Roboto', 'Calibri', 'Verdana', 'Georgia'];
    const backgrounds = [
        { label: 'Papel', color: '#f8fafc' },
        { label: 'Blanco', color: '#ffffff' },
        { label: 'Sepia', color: '#fef3c7' },
        { label: 'Menta', color: '#f0fdf4' },
    ];

    const [designName, setDesignName] = useState('');
    const [editingFile, setEditingFile] = useState(null);

    useEffect(() => {
        loadTemplateInfo();
    }, []);

    const loadTemplateInfo = async () => {
        if (window.api?.templates?.getInfo) {
            try {
                const res = await window.api.templates.getInfo();
                if (res && res.success && res.data) {
                    setTemplateInfo(res.data);

                    if (res.data.currentConfig) {
                        const loaded = res.data.currentConfig;
                        setConfig(prev => ({
                            ...prev,
                            ...loaded,
                            // Defend against missing nested objects
                            colors: {
                                ...prev.colors,
                                ...(loaded.colors || {})
                            },
                            visibleColumns: {
                                ...prev.visibleColumns,
                                ...(loaded.visibleColumns || {})
                            },
                            customColumns: loaded.customColumns || []
                        }));
                        if (loaded.name) setDesignName(loaded.name);
                        // If the loaded config is one of the history items (we don't know for sure,
                        // but usually currentConfig matches the last saved one).
                        // For now we don't auto-set editingFile unless explicit load from history.
                    }
                }
            } catch (err) {
                console.error('Error loading info:', err);
            }
        }
    };

    const handleLoadPrev = async (filename) => {
        try {
            const res = await window.api.templates.loadConfig(filename);

            // Unwrap IPC response
            let cfg = (res && res.success) ? res.data : res;

            // Rescue from corrupted/nested saves (if file contains { success: true, data: ... })
            if (cfg && cfg.data && cfg.colors === undefined) {
                cfg = cfg.data;
            }

            if (cfg) {
                setConfig(prev => ({
                    ...prev,
                    ...cfg,
                    colors: { ...prev.colors, ...(cfg.colors || {}) },
                    visibleColumns: { ...prev.visibleColumns, ...(cfg.visibleColumns || {}) },
                    customColumns: cfg.customColumns || []
                }));
                setDesignName(cfg.name || '');
                setEditingFile(filename); // Enable edit mode for this file
            }
        } catch (e) {
            console.error(e);
            addNotification('Error cargando diseño', 'error');
        }
    };

    const handleSelectLogo = async () => {
        const path = await window.api.templates.selectLogo();
        if (path) setConfig(prev => ({ ...prev, logoPath: path }));
    };

    const handleSave = async (asNew = false) => {
        if (!designName.trim()) {
            addNotification('Por favor, ponle un nombre al diseño.', 'warning');
            return;
        }

        setLoading(true);
        try {
            const configToSave = {
                ...config,
                name: designName,
                historyFilename: asNew ? null : editingFile // Pass filename if editing and not forcing new
            };
            const res = await window.api.templates.generate(configToSave);
            if (res.success) {
                addNotification(editingFile && !asNew ? '¡Cambios guardados!' : '¡Nuevo diseño creado!', 'success');
                loadTemplateInfo();
                if (asNew) setEditingFile(null); // Reset edit mode if saved as new
            }
        } catch (error) {
            addNotification('Fallo al guardar: ' + error.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleCancelEdit = () => {
        setEditingFile(null);
        setDesignName('');
        // Optional: Reset config to defaults?
        // For now just clearing the "Edit Mode" state so next save creates new.
    };

    const handleDelete = async (filename, e) => {
        e.stopPropagation(); // Prevent loading the file
        if (!confirm('¿Seguro que quieres borrar este diseño?')) return;

        try {
            const res = await window.api.templates.delete(filename);
            if (res.success) {
                addNotification('Diseño eliminado', 'success');
                if (editingFile === filename) handleCancelEdit();
                loadTemplateInfo();
            } else {
                addNotification('No se pudo eliminar', 'error');
            }
        } catch (err) {
            console.error(err);
            addNotification('Error al eliminar', 'error');
        }
    };

    const handleActivate = async (filename, e) => {
        e.stopPropagation();
        try {
            const res = await window.api.templates.activate(filename);
            if (res.success) {
                addNotification('¡Diseño ACTIVADO para producción!', 'success');
                loadTemplateInfo();
            }
        } catch (err) {
            addNotification('Error al activar: ' + err.message, 'error');
        }
    };

    const addCustomColumn = () => {
        if (config.customColumns.length >= 2) {
            addNotification('Máximo 2 campos extra permitidos', 'warning');
            return;
        }
        const name = prompt('Nombre del campo (ej: Tempo, Fase):');
        if (name) {
            setConfig(prev => ({
                ...prev,
                customColumns: [...prev.customColumns, { id: Date.now(), name }]
            }));
        }
    };

    const deleteCustomColumn = (id) => {
        setConfig(prev => ({
            ...prev,
            customColumns: prev.customColumns.filter(c => c.id !== id)
        }));
    };

    return (
        <div className="flex flex-col h-[calc(100vh-120px)] animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-6">
                    <div className="p-3 bg-indigo-500 rounded-2xl shadow-lg rotate-3">
                        <Palette size={28} className="text-white" />
                    </div>
                    <div>
                        <h2 className="text-3xl font-black text-white tracking-tight uppercase italic">
                            Studio <span className="text-indigo-400">Pro</span>
                        </h2>
                        <p className="text-slate-400 text-sm font-medium">Historial y creación de campos dinámicos.</p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <input
                        type="text"
                        placeholder="Nombre de la versión (ej: Dark Mode V1)..."
                        value={designName}
                        onChange={(e) => setDesignName(e.target.value)}
                        className={cn(
                            "bg-slate-900 border border-white/10 rounded-xl px-4 py-3.5 text-sm text-white placeholder:text-slate-500 focus:outline-none w-64 transition-all",
                            editingFile ? "border-indigo-500/50 ring-1 ring-indigo-500/20" : "focus:border-indigo-500/50"
                        )}
                    />

                    {editingFile ? (
                        <>
                            <div className="flex flex-col gap-1">
                                <button
                                    onClick={() => handleSave(false)}
                                    disabled={loading}
                                    className="flex items-center gap-2 px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold uppercase tracking-wider text-xs shadow-lg transition-all"
                                >
                                    {loading ? '...' : 'Guardar Cambios'}
                                </button>
                                <button
                                    onClick={() => handleSave(true)}
                                    disabled={loading}
                                    className="text-[10px] text-slate-400 hover:text-white underline"
                                >
                                    Guardar como Nuevo
                                </button>
                            </div>
                            <button
                                onClick={handleCancelEdit}
                                className="p-2 text-slate-500 hover:text-white transition-colors"
                                title="Cancelar edición / Nuevo"
                            >
                                <XCircle size={20} />
                            </button>
                        </>
                    ) : (
                        <button
                            onClick={() => handleSave(false)}
                            disabled={loading}
                            className="flex items-center gap-3 px-8 py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-indigo-600/20 transition-all hover:scale-105 active:scale-95"
                        >
                            {loading ? <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" /> : <Save size={18} />}
                            {loading ? '...' : 'Guardar Nuevo'}
                        </button>
                    )}
                </div>
            </div>

            <div className="flex gap-8 flex-1 overflow-hidden">
                {/* Editor Panel */}
                <div className="w-[360px] space-y-6 overflow-y-auto pr-2 custom-scrollbar">

                    {/* History Gallery */}
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
                            <div className="space-y-2">
                                {templateInfo.history.map((h, i) => {
                                    const isActive = templateInfo.currentConfig?.historyFilename === h.filename;
                                    return (
                                        <button
                                            key={h.filename}
                                            onClick={() => handleLoadPrev(h.filename)}
                                            className={cn(
                                                "w-full flex items-center justify-between p-3 rounded-xl border transition-all group relative",
                                                editingFile === h.filename
                                                    ? "bg-slate-900 border-emerald-500/50 shadow-[0_0_15px_-3px_rgba(16,185,129,0.2)]"
                                                    : "bg-slate-900/50 border-white/5 hover:border-indigo-500/50 hover:bg-slate-900",
                                                isActive && "border-indigo-500 bg-indigo-500/10"
                                            )}
                                        >
                                            <div className="text-left w-full">
                                                <div className="flex items-center gap-2 mb-0.5">
                                                    <p className={cn(
                                                        "text-[10px] font-black uppercase",
                                                        editingFile === h.filename ? "text-emerald-400" : "text-slate-300"
                                                    )}>
                                                        {h.name || `Versión ${templateInfo.history.length - i}`}
                                                    </p>
                                                    {isActive && (
                                                        <span className="px-1.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 text-[8px] font-extrabold border border-indigo-500/30 flex items-center gap-1">
                                                            <CheckCircle size={8} /> ACTIVO
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-[9px] text-slate-500">{new Date(h.date).toLocaleString()}</p>
                                            </div>

                                            <div className="flex items-center gap-1">
                                                {!isActive && (
                                                    <div
                                                        onClick={(e) => handleActivate(h.filename, e)}
                                                        className="p-1.5 rounded-lg hover:bg-indigo-500/20 text-slate-500 hover:text-indigo-400 transition-colors"
                                                        title="Activar para Producción"
                                                    >
                                                        <PlayCircle size={14} />
                                                    </div>
                                                )}
                                                <div
                                                    onClick={(e) => handleDelete(h.filename, e)}
                                                    className="p-1.5 rounded-lg hover:bg-red-500/20 text-slate-600 hover:text-red-400 transition-colors"
                                                    title="Eliminar diseño"
                                                >
                                                    <Trash2 size={13} />
                                                </div>
                                                <ChevronRight size={14} className={cn(
                                                    "transition-colors",
                                                    editingFile === h.filename ? "text-emerald-500" : "text-slate-600 group-hover:text-indigo-400"
                                                )} />
                                            </div>
                                        </button>
                                    )
                                })}
                            </div>
                        ) : (
                            <div className="p-4 rounded-xl border border-dashed border-white/5 text-center">
                                <p className="text-[9px] text-slate-500 italic">No hay diseños guardados aún.</p>
                                <p className="text-[8px] text-slate-600 mt-1">Pulsa "Publicar" para crear tu primera versión.</p>
                            </div>
                        )}
                    </ControlSection>

                    {/* Background Selection */}
                    <ControlSection title="Color de Fondo" icon={Palette}>
                        <div className="space-y-3">
                            <div>
                                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-2">Personalizado</label>
                                <div className="flex items-center gap-3">
                                    <div className="relative overflow-hidden w-10 h-10 rounded-xl border border-white/10 shadow-sm transition-transform hover:scale-105">
                                        <input
                                            type="color"
                                            value={config.backgroundColor}
                                            onChange={(e) => setConfig(prev => ({ ...prev, backgroundColor: e.target.value }))}
                                            className="absolute inset-0 w-[150%] h-[150%] -translate-x-1/4 -translate-y-1/4 p-0 cursor-pointer border-none"
                                        />
                                    </div>
                                    <div className="flex-1 px-3 py-2 bg-slate-900 rounded-xl border border-white/5">
                                        <span className="text-[10px] font-mono font-bold text-slate-400 uppercase">{config.backgroundColor}</span>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-2">Predefinidos</label>
                                <div className="grid grid-cols-4 gap-2">
                                    {['#f8fafc', '#ffffff', '#fef3c7', '#f0fdf4'].map(c => (
                                        <button
                                            key={c}
                                            onClick={() => setConfig(prev => ({ ...prev, backgroundColor: c }))}
                                            className={cn(
                                                "h-8 rounded-lg border transition-all",
                                                config.backgroundColor === c ? "border-indigo-500 scale-105 shadow-sm" : "border-white/10 hover:border-white/20"
                                            )}
                                            style={{ backgroundColor: c }}
                                            title={c}
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>
                    </ControlSection>

                    {/* Brand Colors */}
                    <ControlSection title="Identidad de Marca y Colores" icon={ImageIcon}>
                        <div className="space-y-4 mb-4">
                            <div className="grid grid-cols-2 gap-4">
                                <ColorInput label="Fondo Días" value={config.colors.primary} onChange={v => setConfig(p => ({ ...p, colors: { ...p.colors, primary: v } }))} />
                                <ColorInput label="Fondo Cabeceras" value={config.colors.accent} onChange={v => setConfig(p => ({ ...p, colors: { ...p.colors, accent: v } }))} />
                            </div>
                            <div className="grid grid-cols-2 gap-4 pt-2 border-t border-white/5">
                                <ColorInput label="Texto Título" value={config.colors.titleColor || config.colors.primary} onChange={v => setConfig(p => ({ ...p, colors: { ...p.colors, titleColor: v } }))} />
                                <ColorInput label="Texto Cabeceras" value={config.colors.headerColor || '#ffffff'} onChange={v => setConfig(p => ({ ...p, colors: { ...p.colors, headerColor: v } }))} />
                            </div>
                        </div>
                        <button onClick={handleSelectLogo} className="w-full p-4 border-2 border-dashed border-white/5 rounded-2xl bg-slate-900/50 hover:bg-slate-900 transition-colors">
                            <div className="flex flex-col items-center gap-1">
                                <ImageIcon size={20} className={config.logoPath ? "text-emerald-400" : "text-slate-500"} />
                                <span className="text-[9px] font-black uppercase text-slate-400">{config.logoPath ? 'Logo Cargado' : 'Subir Logo PNG'}</span>
                            </div>
                        </button>
                    </ControlSection>

                    {/* Table Fields */}
                    <ControlSection title="Estructura de Tabla" icon={TableIcon}>
                        <div className="space-y-4">
                            <div className="space-y-3">
                                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block">Campos Obligatorios</label>
                                <div className="grid grid-cols-2 gap-2">
                                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[9px] font-black uppercase opacity-60 cursor-not-allowed">
                                        <CheckCircle size={10} /> Series
                                    </div>
                                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[9px] font-black uppercase opacity-60 cursor-not-allowed">
                                        <CheckCircle size={10} /> Reps
                                    </div>
                                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[9px] font-black uppercase opacity-60 cursor-not-allowed">
                                        <CheckCircle size={10} /> Intensidad
                                    </div>
                                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[9px] font-black uppercase opacity-60 cursor-not-allowed">
                                        <CheckCircle size={10} /> Notas
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-3 pt-3 border-t border-white/5">
                                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block">Campos Opcionales</label>
                                <div className="grid grid-cols-2 gap-2">
                                    <FieldToggle active={config.visibleColumns.rest} onClick={() => setConfig(p => ({ ...p, visibleColumns: { ...p.visibleColumns, rest: !p.visibleColumns.rest } }))} label="Descanso" />
                                    <FieldToggle active={config.visibleColumns.weight} onClick={() => setConfig(p => ({ ...p, visibleColumns: { ...p.visibleColumns, weight: !p.visibleColumns.weight } }))} label="Peso (KG)" />
                                    <FieldToggle active={config.visibleColumns.next} onClick={() => setConfig(p => ({ ...p, visibleColumns: { ...p.visibleColumns, next: !p.visibleColumns.next } }))} label="Proyect." />
                                </div>
                            </div>

                            {/* Custom Fields */}
                            <div className="pt-4 border-t border-white/5">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Campos Propios</span>
                                    <button onClick={addCustomColumn} className="p-1 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 rounded-md transition-colors"><Plus size={14} /></button>
                                </div>
                                <div className="space-y-1">
                                    {config.customColumns.map(col => (
                                        <div key={col.id} className="flex items-center justify-between p-2 bg-slate-900/50 rounded-lg group">
                                            <span className="text-[10px] font-bold text-white uppercase italic">{col.name}</span>
                                            <button onClick={() => deleteCustomColumn(col.id)} className="text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={12} /></button>
                                        </div>
                                    ))}
                                    {config.customColumns.length === 0 && <p className="text-[9px] text-slate-600 italic">No hay campos extra...</p>}
                                </div>
                            </div>
                        </div>
                    </ControlSection>
                </div>

                {/* Preview Canvas */}
                <div className="flex-1 flex flex-col bg-slate-900/40 rounded-[2.5rem] border border-white/5 relative overflow-hidden group">
                    <div className="absolute top-6 left-1/2 -translate-x-1/2 px-4 py-1.5 bg-white/5 rounded-full border border-white/10 text-[9px] font-black uppercase text-slate-500 flex items-center gap-2">
                        <Eye size={12} className="text-indigo-400" /> Vista Previa Interactiva
                    </div>

                    <div className="flex-1 flex items-center justify-center p-8">
                        <div
                            className="w-full max-w-3xl aspect-[1.4/1] bg-white rounded-xl shadow-2xl overflow-hidden shadow-black/50 transition-all duration-500"
                            style={{ backgroundColor: config.backgroundColor }}
                        >
                            {/* Dummy Sheet */}
                            <div className="p-10 space-y-8 h-full">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h1 className="text-3xl font-black italic tracking-tighter" style={{ color: config.colors.titleColor || config.colors.primary, fontFamily: config.font }}>RUTINA DE ENTRENAMIENTO</h1>
                                        <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest mt-1 italic">CLIENTE: Juan Pérez</p>
                                    </div>
                                    <div className="w-24 h-12 bg-slate-50 border border-dashed border-slate-200 rounded-xl flex items-center justify-center text-[8px] font-black text-slate-300">
                                        {config.logoPath ? <div className="text-indigo-400 rotate-[-5deg] scale-125 italic">LOGO</div> : 'LOGO'}
                                    </div>
                                </div>

                                {/* Vertical Layout Preview */}
                                <div className="flex rounded-xl overflow-hidden border border-slate-200 shadow-lg">
                                    <div
                                        className="w-16 flex items-center justify-center text-white font-black text-xs uppercase"
                                        style={{ backgroundColor: config.colors.primary }}
                                    >
                                        <span className="-rotate-90 whitespace-nowrap">DÍA 1</span>
                                    </div>
                                    <div className="flex-1">
                                        {/* Headers */}
                                        <div className="flex border-b border-white/20" style={{ backgroundColor: config.colors.accent }}>
                                            <div className="flex-1 p-2 text-[8px] font-bold uppercase" style={{ color: config.colors.headerColor || '#ffffff' }}>Ejercicio</div>
                                            <div className="w-12 p-2 text-center text-[8px] font-bold uppercase border-l border-white/10" style={{ color: config.colors.headerColor || '#ffffff' }}>Series</div>
                                            <div className="w-12 p-2 text-center text-[8px] font-bold uppercase border-l border-white/10" style={{ color: config.colors.headerColor || '#ffffff' }}>Reps</div>
                                            <div className="w-12 p-2 text-center text-[8px] font-bold uppercase border-l border-white/10" style={{ color: config.colors.headerColor || '#ffffff' }}>RPE</div>
                                        </div>
                                        {/* Rows */}
                                        <div className="bg-white">
                                            {[1, 2, 3].map(i => (
                                                <div key={i} className="flex border-b border-slate-100 last:border-0 hover:bg-slate-50">
                                                    <div className="flex-1 p-2 text-[9px] font-medium text-slate-600">Press Banca</div>
                                                    <div className="w-12 p-2 text-center text-[9px] text-slate-400 border-l border-slate-100">4</div>
                                                    <div className="w-12 p-2 text-center text-[9px] text-slate-400 border-l border-slate-100">10-12</div>
                                                    <div className="w-12 p-2 text-center text-[9px] text-slate-400 border-l border-slate-100">8</div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                {/* End of Preview Content */}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function ControlSection({ title, icon: Icon, children }) {
    return (
        <div className="bg-slate-900/30 rounded-3xl border border-white/5 p-5 animate-in slide-in-from-left duration-300">
            <h4 className="text-[9px] font-black text-slate-600 uppercase tracking-[0.3em] mb-4 flex items-center gap-2">
                <Icon size={12} className="text-slate-500" /> {title}
            </h4>
            {children}
        </div>
    );
}

function ColorInput({ label, value, onChange }) {
    return (
        <div>
            <label className="text-[8px] font-black text-slate-600 uppercase mb-1 block">{label}</label>
            <div className="flex items-center gap-2 p-1.5 bg-slate-900 rounded-xl border border-white/5">
                <input type="color" value={value} onChange={e => onChange(e.target.value)} className="w-6 h-6 rounded-lg bg-transparent border-none p-0 cursor-pointer" />
                <span className="text-[8px] font-mono text-slate-500">{value}</span>
            </div>
        </div>
    );
}

function FieldToggle({ active, onClick, label }) {
    return (
        <button
            onClick={onClick}
            className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-lg border text-[9px] font-black uppercase transition-all",
                active ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" : "bg-slate-900/50 border-white/5 text-slate-600"
            )}
        >
            <div className={cn("w-1.5 h-1.5 rounded-full", active ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]" : "bg-slate-700")} />
            {label}
        </button>
    );
}
