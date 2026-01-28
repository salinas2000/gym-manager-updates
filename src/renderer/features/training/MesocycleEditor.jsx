import React, { useState } from 'react';
import { ArrowLeft, Save, Calendar, AlertTriangle } from 'lucide-react';
import RoutineBuilder from './RoutineBuilder';
import ConfirmationModal from '../../components/ui/ConfirmationModal';
import LoadingSpinner from '../../components/ui/LoadingSpinner';

export default function MesocycleEditor({ customerId, customerName, initialData, onBack, onSave, templateMode = false, onViewHistory }) {
    const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', children: null, onConfirm: () => { }, type: 'info' });
    const [step, setStep] = useState(initialData ? 2 : 1); // 1: Config, 2: Builder

    // Config State
    const [name, setName] = useState(initialData?.name || '');
    const [startDate, setStartDate] = useState(initialData?.start_date?.split('T')[0] || new Date().toISOString().split('T')[0]);
    const [weeks, setWeeks] = useState(4);
    const [endDate, setEndDate] = useState(initialData?.end_date?.split('T')[0] || '');
    const [isTemplate, setIsTemplate] = useState(templateMode || false);

    // Smart Dates Logic
    const [occupiedRanges, setOccupiedRanges] = useState([]);
    const [suggestedDate, setSuggestedDate] = useState(null);

    React.useEffect(() => {
        if (customerId && !templateMode && !initialData) {
            window.api.training.getMesocycles(customerId).then(res => {
                if (res.success) {
                    const activeMesos = res.data.filter(m => m.active);
                    const ranges = activeMesos.map(m => ({
                        name: m.name,
                        start: m.start_date,
                        end: m.end_date
                    })).sort((a, b) => new Date(b.end || '9999-12-31') - new Date(a.end || '9999-12-31'));

                    setOccupiedRanges(ranges);

                    // Find latest end date
                    if (ranges.length > 0) {
                        const lastMeso = ranges[0]; // Sorted desc by End Date
                        if (lastMeso.end) {
                            const lastEnd = new Date(lastMeso.end);
                            const nextStart = new Date(lastEnd);
                            nextStart.setDate(lastEnd.getDate() + 1); // Next day
                            const nextStartStr = nextStart.toISOString().split('T')[0];

                            setSuggestedDate(nextStartStr);
                            setStartDate(nextStartStr); // Auto-apply suggestion

                            // Recalc End Date based on new Start
                            const end = new Date(nextStart);
                            end.setDate(nextStart.getDate() + (weeks * 7));
                            setEndDate(end.toISOString().split('T')[0]);
                        }
                    }
                }
            });
        }
    }, [customerId, templateMode, initialData]);

    // Routine State (must be before daysPerWeek)
    const [days, setDays] = useState(initialData?.routines && initialData.routines.length > 0
        ? initialData.routines.map(r => ({
            id: r.id || Date.now() + Math.random(),
            name: r.name,
            items: (r.items || []).map(i => ({ ...i, _guiId: i.id || crypto.randomUUID() }))
        }))
        : [{ id: 1, name: 'Día 1', items: [] }]
    );
    const [currentDayId, setCurrentDayId] = useState(days[0].id);
    const [daysPerWeek, setDaysPerWeek] = useState(initialData?.days_per_week || days.length);

    // Errors
    const [error, setError] = useState(null);
    const [isSaving, setIsSaving] = useState(false);

    // Templates
    const [showTemplates, setShowTemplates] = useState(false);
    const [templates, setTemplates] = useState([]);
    const [templateDaysFilter, setTemplateDaysFilter] = useState(null);
    const [selectedTemplate, setSelectedTemplate] = useState(null); // Track selected template

    const loadTemplates = async (daysFilter = null) => {
        try {
            const res = await window.api.training.getTemplates ? await window.api.training.getTemplates(daysFilter) : { success: false };
            if (res.success) setTemplates(res.data);
        } catch (e) { console.error(e); }
    };

    // Auto-generate name: "Customer Name - Month Year"
    const generateAutoName = () => {
        if (!customerName || templateMode) return;

        const date = new Date(startDate);
        const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
            'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
        const monthName = months[date.getMonth()];
        const year = date.getFullYear();

        const autoName = `${customerName} - ${monthName} ${year}`;
        setName(autoName);
    };



    // Auto-calculate end date
    const handleWeeksChange = (w) => {
        setWeeks(w);
        const start = new Date(startDate);
        const end = new Date(start);
        end.setDate(start.getDate() + (w * 7));
        setEndDate(end.toISOString().split('T')[0]);
    };

    // Initialize End Date if new
    React.useEffect(() => {
        if (!initialData && !endDate) {
            handleWeeksChange(4);
        }
    }, []);

    // Prepare for Builder
    const handleNext = async () => {
        if (!name.trim()) return setError('El nombre es obligatorio.');

        // Validate Overlaps before proceeding to step 2
        if (!isTemplate && customerId) {
            try {
                const response = await window.api.training.checkOverlap(customerId, startDate, endDate, initialData?.id);

                if (response.success && response.data.hasOverlap) {
                    setError('overlap'); // Special error state to show navigation button
                    return;
                }
            } catch (err) {
                console.error('Error checking overlap:', err);
                setError('Error al validar las fechas. Por favor, intenta de nuevo.');
                return;
            }
        }

        setError(null);
        setStep(2);
    };

    // Save & Share
    const handleFinish = async () => {
        setIsSaving(true);
        setError(null);
        try {
            const finalData = {
                id: initialData?.id, // If editing
                customerId, // Might be null/dummy for templates
                name,
                startDate,
                endDate,
                notes: 'Creado desde App',
                isTemplate,
                daysPerWeek: days.length, // Auto-calculate from number of routines
                routines: days.map(d => ({
                    name: d.name,
                    dayGroup: '',
                    items: d.items
                }))
            };

            // ALWAYS SAVE, NEVER SHARE DIRECTLY FROM HERE
            const result = await window.api.training.saveMesocycle(finalData);

            if (result.success || result.lastInsertRowid) {
                // Success! Navigate back to history
                onSave();
            } else {
                // Check if it's an overlap error
                const errorMsg = result.error || 'Error desconocido';
                if (errorMsg.includes('solapan') || errorMsg.includes('overlap')) {
                    setError('⚠️ Las fechas se solapan con otro mesociclo activo. Por favor, ajusta las fechas de inicio y fin para que no coincidan con otro plan activo.');
                } else {
                    setError('Error al guardar: ' + errorMsg);
                }
            }

        } catch (err) {
            console.error(err);
            const errorMsg = err.message || 'Error inesperado';
            if (errorMsg.includes('solapan') || errorMsg.includes('overlap')) {
                setError('⚠️ Las fechas se solapan con otro mesociclo activo. Por favor, ajusta las fechas de inicio y fin para que no coincidan con otro plan activo.');
            } else {
                setError('Error inesperado al guardar: ' + errorMsg);
            }
        } finally {
            setIsSaving(false);
        }
    };

    // --- RENDER ---

    return (
        <div className="flex flex-col h-full bg-slate-950/50 absolute inset-0 z-10 backdrop-blur-xl">
            {/* TOOLBAR */}
            <div className="bg-slate-900 border-b border-white/5 p-4 flex justify-between items-center shadow-2xl">
                <div className="flex items-center gap-4">
                    <button onClick={onBack} className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition-colors">
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <h2 className="font-bold text-white text-lg leading-tight">
                            {isTemplate
                                ? (initialData ? 'Editar Plantilla' : 'Nueva Plantilla')
                                : (initialData ? 'Editar Mesociclo' : 'Nuevo Mesociclo')
                            }
                        </h2>
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                            {!isTemplate && customerName && (
                                <span className="text-blue-400 font-bold uppercase tracking-wider">{customerName}</span>
                            )}
                            <span className="text-slate-600">|</span>
                            <span>{name || 'Sin Nombre'}</span>
                        </div>
                    </div>
                </div>

                <div className="flex gap-2">
                    {/* Toolbar actions removed to avoid duplication with footer */}
                </div>
            </div>

            {/* CONTENT */}
            <div className="flex-1 overflow-hidden p-6 relative">

                {/* STEP 1: CONFIG */}
                {step === 1 && (
                    <div className="max-w-xl mx-auto mt-10">
                        <div className="bg-slate-900/80 p-8 rounded-3xl border border-white/5 shadow-2xl space-y-6">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                    <Calendar className={templateMode ? "text-emerald-400" : "text-blue-400"} />
                                    {templateMode ? 'Configuración de Plantilla' : 'Configuración del Plan'}
                                </h3>
                                <button
                                    onClick={() => {
                                        setShowTemplates(!showTemplates);
                                        if (!showTemplates) loadTemplates();
                                    }}
                                    className="text-xs font-bold text-blue-400 hover:text-white bg-blue-500/10 hover:bg-blue-600 px-3 py-1.5 rounded-lg transition-all"
                                >
                                    {showTemplates ? 'Cerrar Plantillas' : '📂 Cargar Plantilla'}
                                </button>
                            </div>

                            {showTemplates && (
                                <div className="mb-6 bg-gradient-to-br from-slate-900 to-slate-950 rounded-2xl border border-blue-500/20 shadow-2xl overflow-hidden">
                                    {/* Header with Filters */}
                                    <div className="bg-gradient-to-r from-blue-600/20 to-indigo-600/20 border-b border-blue-500/30 p-4">
                                        <div className="flex items-center justify-between mb-3">
                                            <div className="flex items-center gap-2">
                                                <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                                                    <span className="text-lg">📚</span>
                                                </div>
                                                <div>
                                                    <h4 className="text-sm font-bold text-white">Biblioteca de Plantillas</h4>
                                                    <p className="text-xs text-slate-400">Selecciona una base para tu mesociclo</p>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Filter Buttons */}
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs text-slate-400 font-medium">Filtrar por días:</span>
                                            <div className="flex gap-1.5">
                                                <button
                                                    onClick={() => { setTemplateDaysFilter(null); loadTemplates(null); }}
                                                    className={`text-xs px-3 py-1.5 rounded-lg font-bold transition-all ${!templateDaysFilter
                                                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/50'
                                                        : 'bg-slate-800/50 text-slate-400 hover:text-white hover:bg-slate-700'
                                                        }`}
                                                >
                                                    Todos
                                                </button>
                                                {[3, 4, 5, 6, 7].map(d => (
                                                    <button
                                                        key={d}
                                                        onClick={() => { setTemplateDaysFilter(d); loadTemplates(d); }}
                                                        className={`text-xs px-3 py-1.5 rounded-lg font-bold transition-all ${templateDaysFilter === d
                                                            ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/50'
                                                            : 'bg-slate-800/50 text-slate-400 hover:text-white hover:bg-slate-700'
                                                            }`}
                                                    >
                                                        {d} días
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Templates Grid */}
                                    <div className="p-4 max-h-64 overflow-y-auto">
                                        {templates.length === 0 ? (
                                            <div className="text-center py-8">
                                                <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-slate-800/50 flex items-center justify-center">
                                                    <span className="text-3xl opacity-50">📭</span>
                                                </div>
                                                <p className="text-sm text-slate-500 font-medium">
                                                    No hay plantillas guardadas
                                                    {templateDaysFilter && <span className="text-slate-400"> de <span className="text-emerald-400 font-bold">{templateDaysFilter} días</span></span>}
                                                </p>
                                                <p className="text-xs text-slate-600 mt-1">Crea tu primera plantilla guardando un mesociclo como plantilla</p>
                                            </div>
                                        ) : (
                                            <div className="grid grid-cols-2 gap-3">
                                                {templates.map(tpl => (
                                                    <button
                                                        key={tpl.id}
                                                        onClick={() => {
                                                            // DON'T copy the name - user must provide their own
                                                            setSelectedTemplate(tpl.name); // Track which template was selected
                                                            if (tpl.routines && tpl.routines.length > 0) {
                                                                const newDays = tpl.routines.map(r => ({
                                                                    id: Date.now() + Math.random(),
                                                                    name: r.name,
                                                                    items: r.items.map(i => ({ ...i, id: undefined, exercise_name: i.exercise_name }))
                                                                }));
                                                                setDays(newDays);
                                                                setCurrentDayId(newDays[0].id);
                                                            }
                                                            setShowTemplates(false);
                                                        }}
                                                        className="group relative text-left p-4 bg-slate-800/30 hover:bg-slate-800 rounded-xl transition-all border border-white/5 hover:border-blue-500/50 hover:shadow-lg hover:shadow-blue-500/20"
                                                    >
                                                        {/* Template Card */}
                                                        <div className="flex items-start justify-between mb-2">
                                                            <div className="flex-1">
                                                                <h5 className="font-bold text-white text-sm group-hover:text-blue-300 transition-colors line-clamp-1">
                                                                    {tpl.name}
                                                                </h5>
                                                            </div>
                                                            <div className="ml-2 px-2 py-0.5 rounded-md bg-emerald-500/20 border border-emerald-500/30">
                                                                <span className="text-xs font-bold text-emerald-300">
                                                                    {tpl.days_per_week || tpl.routines?.length || 0}d
                                                                </span>
                                                            </div>
                                                        </div>

                                                        <div className="flex items-center gap-2 text-xs text-slate-500">
                                                            <span>💪 {tpl.routines?.length || 0} rutinas</span>
                                                            <span>•</span>
                                                            <span>{tpl.routines?.reduce((acc, r) => acc + (r.items?.length || 0), 0) || 0} ejercicios</span>
                                                        </div>

                                                        {/* Hover Effect */}
                                                        <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-blue-500/0 to-indigo-500/0 group-hover:from-blue-500/5 group-hover:to-indigo-500/5 transition-all pointer-events-none"></div>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {selectedTemplate && (
                                <div className="bg-indigo-500/10 border border-indigo-500/30 rounded-xl p-3 flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></div>
                                    <span className="text-sm text-indigo-300 font-medium">
                                        📋 Plantilla base: <span className="text-indigo-100 font-bold">{selectedTemplate}</span>
                                    </span>
                                </div>
                            )}

                            {error && (
                                error === 'overlap' ? (
                                    <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 space-y-3">
                                        <div className="flex items-start gap-2 text-red-400">
                                            <AlertTriangle size={20} className="flex-shrink-0 mt-0.5" />
                                            <div className="flex-1">
                                                <p className="font-bold text-sm">Las fechas se solapan con otro mesociclo activo</p>
                                                <p className="text-xs text-red-300 mt-1">
                                                    Ya existe un plan de entrenamiento activo para este cliente en las fechas seleccionadas.
                                                    Las fechas no pueden coincidir con otro mesociclo activo.
                                                </p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={onViewHistory || onBack}
                                            className="w-full bg-red-600 hover:bg-red-500 text-white px-4 py-2.5 rounded-xl font-bold transition-all flex items-center justify-center gap-2"
                                        >
                                            <Calendar size={18} />
                                            Ver Historial de Mesociclos
                                        </button>
                                    </div>
                                ) : (
                                    <div className="bg-red-500/10 text-red-400 p-4 rounded-xl border border-red-500/20 flex items-center gap-2 text-sm">
                                        <AlertTriangle size={16} /> {error}
                                    </div>
                                )
                            )}

                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <label className="block text-sm font-bold text-slate-400">Nombre del Objetivo</label>
                                    {!templateMode && customerName && (
                                        <button
                                            type="button"
                                            onClick={generateAutoName}
                                            className="text-xs font-bold text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 px-3 py-1 rounded-lg transition-all flex items-center gap-1"
                                        >
                                            <span>✨</span> Auto-rellenar
                                        </button>
                                    )}
                                </div>
                                <div className="relative z-10">
                                    <input
                                        type="text"
                                        value={name}
                                        onChange={e => setName(e.target.value)}
                                        placeholder="Ej: Pretemporada 2026, Hipertrofia Fase 1..."
                                        className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 text-lg font-medium placeholder:text-slate-600"
                                    />
                                </div>
                            </div>

                            {!templateMode && (
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-bold text-slate-400 mb-2">Fecha Inicio</label>
                                        <input
                                            type="date"
                                            value={startDate}
                                            onChange={e => {
                                                const newDate = e.target.value;
                                                setStartDate(newDate);
                                                // Recalculate End Date
                                                const start = new Date(newDate);
                                                const end = new Date(start);
                                                end.setDate(start.getDate() + (weeks * 7));
                                                setEndDate(end.toISOString().split('T')[0]);
                                            }}
                                            className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 font-medium"
                                        />

                                        {/* OCCUPIED DATES INFO */}
                                        {occupiedRanges.length > 0 && (
                                            <div className="mt-3 bg-slate-800/50 rounded-lg p-3 border border-dashed border-white/10">
                                                <p className="text-[10px] uppercase font-bold text-slate-500 mb-2 flex items-center gap-1">
                                                    <Calendar size={12} /> Periodos Ocupados
                                                </p>
                                                <div className="space-y-1">
                                                    {occupiedRanges.map((range, idx) => (
                                                        <div key={idx} className="text-xs text-slate-400 flex justify-between bg-slate-900/50 px-2 py-1 rounded">
                                                            <span>{range.name}</span>
                                                            <span className="font-mono text-slate-500">
                                                                {new Date(range.start).toLocaleDateString()} - {range.end ? new Date(range.end).toLocaleDateString() : 'Activo'}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                                {suggestedDate && startDate === suggestedDate && (
                                                    <p className="text-xs text-emerald-400 mt-2 font-bold flex items-center gap-1">
                                                        ✨ Fecha sugerida aplicada automáticamente
                                                    </p>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-slate-400 mb-2">Duración (Semanas)</label>
                                        <select
                                            value={weeks}
                                            onChange={e => handleWeeksChange(parseInt(e.target.value))}
                                            className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 font-medium appearance-none"
                                        >
                                            {[2, 4, 6, 8, 12, 16].map(w => <option key={w} value={w}>{w} Semanas</option>)}
                                        </select>
                                    </div>
                                </div>
                            )}

                            <div className="pt-4 border-t border-white/5 flex items-center justify-between">
                                {!isTemplate && (
                                    <p className="text-sm text-slate-500">
                                        Fin Estimado: <span className="text-white font-bold">{endDate || '-'}</span>
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* STEP 2: BUILDER */}
                {step === 2 && (
                    <div className="flex flex-col h-full gap-4">
                        {/* DAY TABS */}
                        <div className="flex gap-2 overflow-x-auto pb-1 min-h-[50px]">
                            {days.map(day => (
                                <div key={day.id} className="relative group">
                                    <button
                                        onClick={() => setCurrentDayId(day.id)}
                                        className={`px-4 py-2 rounded-lg text-sm font-bold transition-all border flex items-center gap-2 ${currentDayId === day.id
                                            ? 'bg-blue-600 text-white border-blue-500'
                                            : 'bg-slate-800 text-slate-400 border-white/5 hover:bg-slate-700'
                                            }`}
                                    >
                                        {/* SIMPLE TEXT (Clickable, no selection issues) */}
                                        <span>{day.name}</span>
                                    </button>

                                    {days.length > 1 && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setConfirmModal({
                                                    isOpen: true,
                                                    title: 'Eliminar Día',
                                                    children: `¿Estás seguro de que quieres eliminar "${day.name}"? Se perderán todos los ejercicios de este día.`,
                                                    type: 'danger',
                                                    confirmText: 'Eliminar',
                                                    onConfirm: () => {
                                                        const newDays = days.filter(d => d.id !== day.id);
                                                        setDays(newDays);
                                                        if (currentDayId === day.id) setCurrentDayId(newDays[0].id);
                                                    }
                                                });
                                            }}
                                            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5 w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                                        >
                                            x
                                        </button>
                                    )}
                                </div>
                            ))}
                            <button
                                onClick={() => {
                                    const newId = Date.now();
                                    setDays([...days, { id: newId, name: `Día ${days.length + 1}`, items: [] }]);
                                    setCurrentDayId(newId);
                                }}
                                className="px-3 py-2 rounded-lg bg-slate-800/50 border border-dashed border-white/10 text-slate-400 hover:text-white transition-all"
                            >
                                +
                            </button>
                        </div>

                        {/* REUSE SPLIT VIEW COMPONENT */}
                        <RoutineBuilder
                            days={days}
                            setDays={setDays}
                            currentDayId={currentDayId}
                        />
                    </div>
                )}

            </div>

            {/* FOOTER */}
            <div className="p-4 border-t border-white/5 bg-slate-900/50 flex justify-between items-center">
                <button
                    onClick={step === 1 ? onBack : () => setStep(1)}
                    className="text-slate-400 hover:text-white font-bold px-4 py-2 rounded-lg hover:bg-white/5 transition-all flex items-center gap-2"
                >
                    <ArrowLeft size={18} />
                    {step === 1 ? 'Cancelar' : 'Volver'}
                </button>

                {step === 1 ? (
                    <button
                        onClick={handleNext}
                        className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-xl font-bold transition-all shadow-lg shadow-blue-900/20 flex items-center gap-2"
                    >
                        Siguiente Paso
                        <ArrowLeft size={18} className="rotate-180" />
                    </button>
                ) : (
                    <button
                        onClick={handleFinish}
                        disabled={isSaving}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2 rounded-xl font-bold transition-all shadow-lg shadow-emerald-900/20 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed min-w-[160px] justify-center"
                    >
                        {isSaving ? (
                            <LoadingSpinner size="sm" color="white" />
                        ) : (
                            <>
                                Guardar Entrenamiento
                                <Save size={18} />
                            </>
                        )}
                    </button>
                )}
            </div>

            <ConfirmationModal
                isOpen={confirmModal.isOpen}
                title={confirmModal.title}
                onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                onConfirm={confirmModal.onConfirm}
                type={confirmModal.type}
                confirmText={confirmModal.confirmText || 'Confirmar'}
            >
                {confirmModal.children}
            </ConfirmationModal>
        </div>
    );
}
