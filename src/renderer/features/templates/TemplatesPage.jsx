import React, { useState, useEffect } from 'react';
import { Palette, Type, Columns, Save, XCircle, Eye, Plus } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useToast } from '../../context/ToastContext';
import { useGym } from '../../context/GymContext';
import { defaultConfig } from './utils/defaultConfig';

// Tab Components
import ColorsTab from './components/ColorsTab';
import FontsTab from './components/FontsTab';
import FieldsTab from './components/FieldsTabNew';
import HistoryPanel from './components/HistoryPanel';
import PreviewPanel from './components/PreviewPanel';

const TABS = [
    { id: 'colors', label: 'Colores', icon: Palette },
    { id: 'fonts', label: 'Fuentes', icon: Type },
    { id: 'fields', label: 'Campos', icon: Columns }
];

export default function TemplatesPage() {
    const toast = useToast();
    const { settings } = useGym();
    const [loading, setLoading] = useState(false);
    const [templateInfo, setTemplateInfo] = useState({ exists: false, history: [] });
    const [activeTab, setActiveTab] = useState('colors');
    const [reloadFieldsKey, setReloadFieldsKey] = useState(0); // Key para forzar recarga de campos

    // Design State - use default config as base
    const [config, setConfig] = useState(() => ({
        ...defaultConfig
    }));

    const [designName, setDesignName] = useState('');
    const [editingFile, setEditingFile] = useState(null);

    useEffect(() => {
        loadTemplateInfo();
    }, [settings]);

    const loadTemplateInfo = async () => {
        try {
            const response = await window.api.templates.getInfo();
            console.log('[TemplatesPage] Received response:', response);
            // Unwrap IPC response: {success, data} -> data
            const info = response?.data || response;
            if (info) {
                setTemplateInfo(info);
                // Auto-load active config if present
                if (info.currentConfig) {
                    setConfig(prev => ({
                        ...defaultConfig,
                        ...info.currentConfig,
                        colors: { ...defaultConfig.colors, ...(info.currentConfig.colors || {}) },
                        fonts: { ...defaultConfig.fonts, ...(info.currentConfig.fonts || {}) },
                        visibleColumns: { ...defaultConfig.visibleColumns, ...(info.currentConfig.visibleColumns || {}) },
                        customColumns: info.currentConfig.customColumns || []
                    }));
                    setDesignName(info.currentConfig.name || '');
                    // Match active history item to editingFile
                    if (info.currentConfig.historyFilename) {
                        setEditingFile(info.currentConfig.historyFilename);
                    }
                }
            }
        } catch (err) {
            console.error('Failed to load template info:', err);
        }
    };

    const handleLoadPrev = async (filename) => {
        try {
            const response = await window.api.templates.loadConfig(filename);
            const cfg = response?.data || response;
            if (cfg) {
                setConfig(prev => ({
                    ...defaultConfig,
                    ...cfg,
                    colors: { ...defaultConfig.colors, ...(cfg.colors || {}) },
                    fonts: { ...defaultConfig.fonts, ...(cfg.fonts || {}) },
                    visibleColumns: { ...defaultConfig.visibleColumns, ...(cfg.visibleColumns || {}) },
                    customColumns: cfg.customColumns || []
                }));
                setDesignName(cfg.name || '');
                setEditingFile(filename);
            }
        } catch (e) {
            toast.error('Error al cargar diseño');
        }
    };

    const handleSave = async (asNew = false) => {
        if (!designName.trim()) {
            toast.warning('Por favor, ponle un nombre al diseño.');
            return;
        }

        setLoading(true);
        try {
            const configToSave = {
                ...config,
                name: designName,
                historyFilename: asNew ? null : editingFile
            };
            const res = await window.api.templates.generate(configToSave);
            if (res?.success) {
                toast.success(asNew ? '¡Diseño guardado como nuevo!' : '¡Diseño actualizado!');
                await loadTemplateInfo();
            } else {
                throw new Error(res?.error || 'Unknown error');
            }
        } catch (err) {
            toast.error('Error al guardar: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleCancelEdit = () => {
        setEditingFile(null);
        setDesignName('');
    };

    const handleNewDesign = () => {
        setConfig({
            ...defaultConfig,
            gymName: settings?.gym_name || 'Mi Gimnasio',
            optionalColumns: [] // Vaciar para que FieldsTab recargue desde BD
        });
        setDesignName('');
        setEditingFile(null);
        setReloadFieldsKey(prev => prev + 1); // Forzar recarga de campos
        toast.success('Nuevo diseño creado desde la plantilla base');
    };

    const handleDelete = async (filename, e) => {
        e.stopPropagation();
        try {
            await window.api.templates.delete(filename);
            toast.success('Diseño eliminado');
            await loadTemplateInfo();
        } catch (err) {
            toast.error('Error al eliminar');
        }
    };

    const handleActivate = async (filename, e) => {
        e.stopPropagation();
        try {
            await window.api.templates.activate(filename);
            toast.success('Diseño activado');
            await loadTemplateInfo();
        } catch (err) {
            toast.error('Error al activar');
        }
    };

    return (
        <div className="h-full flex flex-col bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
            {/* Header Mejorado */}
            <div className="flex-shrink-0 border-b border-white/5 bg-slate-900/50 backdrop-blur-sm">
                <div className="p-5">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="p-2.5 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 rounded-xl border border-indigo-500/30">
                                <Palette className="text-indigo-400" size={24} />
                            </div>
                            <div>
                                <h1 className="text-xl font-bold text-white tracking-tight">Diseñador de Plantillas</h1>
                                <p className="text-xs text-slate-500 mt-0.5">Personaliza el diseño de tus rutinas Excel</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={handleNewDesign}
                                className="flex items-center gap-2 px-4 py-2.5 bg-slate-800/50 hover:bg-slate-700/50 border border-white/10 hover:border-indigo-500/30 text-slate-300 hover:text-white rounded-xl font-medium text-sm transition-all"
                                title="Crear un nuevo diseño desde cero"
                            >
                                <Plus size={16} />
                                Nuevo
                            </button>
                            <div className="flex items-center gap-2 px-3 py-2 bg-slate-800/50 rounded-xl border border-white/5">
                                <input
                                    type="text"
                                    placeholder="Nombre del diseño..."
                                    value={designName}
                                    onChange={e => setDesignName(e.target.value)}
                                    className="bg-transparent border-none px-2 py-1 text-sm text-white placeholder-slate-500 focus:outline-none w-56"
                                />
                                {editingFile && (
                                    <button
                                        onClick={handleCancelEdit}
                                        className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                                        title="Cancelar edición"
                                    >
                                        <XCircle size={16} />
                                    </button>
                                )}
                            </div>
                            {editingFile && (
                                <button
                                    onClick={() => handleSave(true)}
                                    disabled={loading || !designName.trim()}
                                    className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white rounded-xl font-medium text-sm shadow-lg shadow-indigo-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                    title="Crear una copia como nuevo diseño"
                                >
                                    <Save size={16} />
                                    Guardar como Nuevo
                                </button>
                            )}
                            <button
                                onClick={() => handleSave(false)}
                                disabled={loading || !designName.trim()}
                                className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white rounded-xl font-semibold text-sm shadow-lg shadow-emerald-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Save size={16} />
                                {loading ? 'Guardando...' : editingFile ? 'Actualizar' : 'Guardar Diseño'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex overflow-hidden">
                {/* Left Panel - Controls */}
                <div className="w-96 flex-shrink-0 border-r border-white/5 flex flex-col overflow-hidden bg-slate-900/30">
                    {/* Tabs Mejorados */}
                    <div className="grid grid-cols-4 gap-1 p-2 border-b border-white/5 bg-slate-900/50">
                        {TABS.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={cn(
                                    "flex flex-col items-center justify-center gap-1.5 py-3 px-2 rounded-xl text-xs font-bold uppercase tracking-wide transition-all",
                                    activeTab === tab.id
                                        ? "text-white bg-gradient-to-br from-indigo-600 to-indigo-500 shadow-lg shadow-indigo-500/30 scale-105"
                                        : "text-slate-500 hover:text-white hover:bg-slate-800/50"
                                )}
                            >
                                <tab.icon size={18} />
                                <span className="text-[10px]">{tab.label}</span>
                            </button>
                        ))}
                    </div>

                    {/* Tab Content */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                        {activeTab === 'colors' && (
                            <ColorsTab config={config} setConfig={setConfig} />
                        )}
                        {activeTab === 'fonts' && (
                            <FontsTab config={config} setConfig={setConfig} />
                        )}
                        {activeTab === 'fields' && (
                            <FieldsTab key={reloadFieldsKey} config={config} setConfig={setConfig} />
                        )}
                    </div>

                    {/* History Panel (always visible) */}
                    <div className="flex-shrink-0 border-t border-white/5 p-4">
                        <HistoryPanel
                            templateInfo={templateInfo}
                            editingFile={editingFile}
                            onLoad={handleLoadPrev}
                            onDelete={handleDelete}
                            onActivate={handleActivate}
                        />
                    </div>
                </div>

                {/* Right Panel - Preview */}
                <div className="flex-1 flex flex-col overflow-hidden bg-slate-900/20">
                    <div className="flex items-center justify-between px-5 py-3 border-b border-white/5 bg-slate-900/50">
                        <div className="flex items-center gap-2">
                            <div className="p-1.5 bg-indigo-500/10 rounded-lg">
                                <Eye size={16} className="text-indigo-400" />
                            </div>
                            <span className="text-sm font-bold text-white">
                                Vista Previa en Tiempo Real
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="px-2 py-1 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
                                <span className="text-[10px] font-bold text-emerald-400 uppercase">Live</span>
                            </div>
                        </div>
                    </div>
                    <PreviewPanel config={config} />
                </div>
            </div>
        </div>
    );
}
