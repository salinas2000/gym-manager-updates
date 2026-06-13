import React, { useState } from 'react';
import { ArrowLeft, Save, Calendar, AlertTriangle, GripHorizontal, Users } from 'lucide-react';
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
    const [acceptedOverlap, setAcceptedOverlap] = useState(false);
    const [previousMesocycles, setPreviousMesocycles] = useState([]);
    const [showCopyPrevious, setShowCopyPrevious] = useState(false);

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
                    // Store full mesocycle data for "copy previous" feature
                    setPreviousMesocycles(res.data.filter(m => m.routines && m.routines.length > 0));

                    // Find latest end date and suggest next start
                    if (ranges.length > 0) {
                        const lastMeso = ranges[0]; // Sorted desc by End Date
                        if (lastMeso.end) {
                            // Parse dates without timezone to avoid UTC shifts
                            const [ey, em, ed] = lastMeso.end.split('T')[0].split('-').map(Number);
                            const lastEnd = new Date(ey, em - 1, ed);
                            const nextDay = new Date(ey, em - 1, ed + 1);

                            const today = new Date();
                            today.setHours(0, 0, 0, 0);
                            const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

                            let nextStart;
                            if (nextDay >= firstOfMonth) {
                                // El mesociclo anterior termina en este mes o después → día siguiente al fin
                                nextStart = nextDay;
                            } else {
                                // La fecha fin del anterior es anterior al 1 de este mes → día 1 del mes actual
                                nextStart = firstOfMonth;
                            }

                            const pad = n => String(n).padStart(2, '0');
                            const nextStartStr = `${nextStart.getFullYear()}-${pad(nextStart.getMonth() + 1)}-${pad(nextStart.getDate())}`;
                            setSuggestedDate(nextStartStr);
                            setStartDate(nextStartStr);

                            // Recalc End Date based on new Start
                            const end = new Date(nextStart);
                            end.setDate(nextStart.getDate() + (weeks * 7));
                            const endStr = `${end.getFullYear()}-${pad(end.getMonth() + 1)}-${pad(end.getDate())}`;
                            setEndDate(endStr);
                        }
                    }
                }
            });
        }
    }, [customerId, templateMode, initialData]);

    const copyFromPreviousMesocycle = (meso) => {
        if (meso.routines && meso.routines.length > 0) {
            const newDays = meso.routines.map(r => ({
                id: Date.now() + Math.random(),
                name: r.name,
                items: (r.items || []).map(i => ({
                    exerciseId: i.exercise_id,
                    _guiId: crypto.randomUUID(),
                    exercise_name: i.exercise_name,
                    notes: i.notes || '',
                    superset_group: i.superset_group ?? null,
                    superset_rounds: i.superset_rounds ?? null,
                    custom_fields: i.custom_fields || {}
                }))
            }));
            setDays(newDays);
            setCurrentDayId(newDays[0].id);
        }
        setShowCopyPrevious(false);
    };

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

    // Day reordering (drag the tabs left/right). Auto-numbered names ("Día N")
    // are re-numbered by position; custom names (e.g. "Push") are kept.
    const [dayDragIndex, setDayDragIndex] = useState(null);
    const [dayDragOverIndex, setDayDragOverIndex] = useState(null);
    const reorderDays = (from, to) => {
        if (from == null || to == null || from === to) return;
        setDays(prev => {
            const arr = [...prev];
            const [moved] = arr.splice(from, 1);
            arr.splice(to, 0, moved);
            return arr.map((d, i) => /^Día \d+$/.test(d.name) ? { ...d, name: `Día ${i + 1}` } : d);
        });
    };

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

    // Copiar plan de otro cliente
    const [otherClients, setOtherClients] = useState([]);
    const [otherClientId, setOtherClientId] = useState('');
    const [otherClientMesos, setOtherClientMesos] = useState([]);
    const [loadingOtherMesos, setLoadingOtherMesos] = useState(false);

    const loadOtherClients = async () => {
        try {
            const res = await window.api.customers.getAll();
            const list = res?.success ? res.data : (Array.isArray(res) ? res : []);
            // Exclude the current customer from the list.
            setOtherClients((list || []).filter(c => String(c.id) !== String(customerId)));
        } catch (e) { console.error(e); }
    };

    const loadOtherClientMesos = async (clientId) => {
        setOtherClientId(clientId);
        setOtherClientMesos([]);
        if (!clientId) return;
        setLoadingOtherMesos(true);
        try {
            const res = await window.api.training.getMesocycles(Number(clientId));
            const list = res?.success ? res.data : (Array.isArray(res) ? res : []);
            setOtherClientMesos(list || []);
        } catch (e) { console.error(e); }
        finally { setLoadingOtherMesos(false); }
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

    const handleContinueWithOverlap = () => {
        setAcceptedOverlap(true);
        setError(null);
        setStep(2);
    };

    // Save & Share
    const handleFinish = async (allowOverlap = false) => {
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
                allowOverlap,
                daysPerWeek: days.length, // Auto-calculate from number of routines
                // Pass `id` for each day. For days loaded from the DB this is
                // the real routine id (integer assigned by SQLite); for days
                // added fresh in the editor it's a Date.now() float that won't
                // collide with any DB id. The backend uses an existence check
                // (does this id appear in routines WHERE mesocycle_id = ?) to
                // decide UPDATE vs INSERT — so passing a non-DB id here is
                // safe and simply triggers INSERT.
                routines: days.map(d => ({
                    id: d.id,
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
        <div className="flex flex-col h-full bg-slate-950/50 absolute inset-0 z-10 backdrop-blur-xl pt-9">
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
                                <div className="flex gap-2">
                                    {!templateMode && previousMesocycles.length > 0 && (
                                        <button
                                            onClick={() => {
                                                setShowCopyPrevious(!showCopyPrevious);
                                                if (showTemplates) setShowTemplates(false);
                                            }}
                                            className="text-xs font-bold text-amber-400 hover:text-white bg-amber-500/10 hover:bg-amber-600 px-3 py-1.5 rounded-lg transition-all"
                                        >
                                            {showCopyPrevious ? 'Cerrar' : '📋 Copiar Anterior'}
                                        </button>
                                    )}
                                    <button
                                        onClick={() => {
                                            setShowTemplates(!showTemplates);
                                            if (!showTemplates) { loadTemplates(); loadOtherClients(); }
                                            if (showCopyPrevious) setShowCopyPrevious(false);
                                        }}
                                        className="text-xs font-bold text-blue-400 hover:text-white bg-blue-500/10 hover:bg-blue-600 px-3 py-1.5 rounded-lg transition-all"
                                    >
                                        {showTemplates ? 'Cerrar Plantillas' : '📂 Cargar Plantilla'}
                                    </button>
                                </div>
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

                                    {/* Copiar plan de otro cliente */}
                                    <div className="border-t border-white/5 p-4">
                                        <div className="flex items-center gap-2 mb-3">
                                            <Users size={16} className="text-violet-400" />
                                            <div>
                                                <h4 className="text-sm font-bold text-white">Copiar plan de otro cliente</h4>
                                                <p className="text-xs text-slate-400">Reutiliza un plan ya hecho de otra persona</p>
                                            </div>
                                        </div>
                                        <select
                                            value={otherClientId}
                                            onChange={(e) => loadOtherClientMesos(e.target.value)}
                                            className="w-full bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-violet-500 mb-3"
                                        >
                                            <option value="">Selecciona un cliente…</option>
                                            {otherClients.map(c => (
                                                <option key={c.id} value={c.id}>{c.name}</option>
                                            ))}
                                        </select>
                                        {otherClientId && (
                                            loadingOtherMesos ? (
                                                <p className="text-xs text-slate-500 py-2 text-center">Cargando planes…</p>
                                            ) : otherClientMesos.length === 0 ? (
                                                <p className="text-xs text-slate-500 py-2 text-center">Este cliente no tiene planes.</p>
                                            ) : (
                                                <div className="grid grid-cols-2 gap-3 max-h-48 overflow-y-auto">
                                                    {otherClientMesos.map(meso => (
                                                        <button
                                                            key={meso.id}
                                                            onClick={() => { copyFromPreviousMesocycle(meso); setShowTemplates(false); }}
                                                            className="group text-left p-3 bg-slate-800/30 hover:bg-slate-800 rounded-xl transition-all border border-white/5 hover:border-violet-500/50"
                                                        >
                                                            <h5 className="font-bold text-white text-sm line-clamp-1 group-hover:text-violet-300 transition-colors">{meso.name}</h5>
                                                            <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                                                                <span>💪 {meso.routines?.length || 0} días</span>
                                                                <span>•</span>
                                                                <span>{meso.routines?.reduce((acc, r) => acc + (r.items?.length || 0), 0) || 0} ej.</span>
                                                            </div>
                                                        </button>
                                                    ))}
                                                </div>
                                            )
                                        )}
                                    </div>
                                </div>
                            )}

                            {showCopyPrevious && (
                                <div className="mb-6 bg-gradient-to-br from-slate-900 to-slate-950 rounded-2xl border border-amber-500/20 shadow-2xl overflow-hidden">
                                    <div className="bg-gradient-to-r from-amber-600/20 to-orange-600/20 border-b border-amber-500/30 p-4">
                                        <div className="flex items-center gap-2">
                                            <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center">
                                                <span className="text-lg">📋</span>
                                            </div>
                                            <div>
                                                <h4 className="text-sm font-bold text-white">Copiar Mesociclo Anterior</h4>
                                                <p className="text-xs text-slate-400">Reutiliza la estructura de un mesociclo previo</p>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="p-4 max-h-64 overflow-y-auto space-y-2">
                                        {previousMesocycles.map(meso => (
                                            <button
                                                key={meso.id}
                                                onClick={() => copyFromPreviousMesocycle(meso)}
                                                className="w-full text-left p-3 bg-slate-800/30 hover:bg-slate-800 rounded-xl transition-all border border-white/5 hover:border-amber-500/50 hover:shadow-lg hover:shadow-amber-500/10 group"
                                            >
                                                <div className="flex items-center justify-between">
                                                    <div>
                                                        <h5 className="font-bold text-white text-sm group-hover:text-amber-300 transition-colors">
                                                            {meso.name}
                                                        </h5>
                                                        <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                                                            <span>{meso.start_date ? new Date(meso.start_date).toLocaleDateString() : 'Sin fecha'}</span>
                                                            <span>•</span>
                                                            <span>💪 {meso.routines?.length || 0} rutinas</span>
                                                            <span>•</span>
                                                            <span>{meso.routines?.reduce((acc, r) => acc + (r.items?.length || 0), 0) || 0} ejercicios</span>
                                                        </div>
                                                    </div>
                                                    <div className="text-[9px] font-black uppercase tracking-widest text-amber-400 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        Copiar
                                                    </div>
                                                </div>
                                            </button>
                                        ))}
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
                                                    Puedes crear este plan como una excepción si necesitas que coexista con el actual.
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex flex-col gap-2">
                                            <button
                                                onClick={handleContinueWithOverlap}
                                                className="w-full bg-orange-600 hover:bg-orange-500 text-white px-4 py-2.5 rounded-xl font-bold transition-all flex items-center justify-center gap-2"
                                            >
                                                <span>✅</span> Diseñar como Excepción
                                            </button>
                                            <button
                                                onClick={onViewHistory || onBack}
                                                className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2"
                                            >
                                                <Calendar size={14} />
                                                Ver Historial de Mesociclos
                                            </button>
                                        </div>
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
                            {days.map((day, idx) => (
                                <div
                                    key={day.id}
                                    draggable
                                    onDragStart={() => setDayDragIndex(idx)}
                                    onDragEnd={() => { setDayDragIndex(null); setDayDragOverIndex(null); }}
                                    onDragOver={(e) => { e.preventDefault(); if (dayDragOverIndex !== idx) setDayDragOverIndex(idx); }}
                                    onDrop={(e) => { e.preventDefault(); reorderDays(dayDragIndex, idx); setDayDragIndex(null); setDayDragOverIndex(null); }}
                                    className={`relative group rounded-lg transition-all ${dayDragOverIndex === idx && dayDragIndex !== idx ? 'ring-2 ring-blue-400' : ''} ${dayDragIndex === idx ? 'opacity-50' : ''}`}
                                >
                                    <button
                                        onClick={() => setCurrentDayId(day.id)}
                                        className={`px-4 py-2 rounded-lg text-sm font-bold transition-all border flex items-center gap-2 cursor-grab active:cursor-grabbing ${currentDayId === day.id
                                            ? 'bg-blue-600 text-white border-blue-500'
                                            : 'bg-slate-800 text-slate-400 border-white/5 hover:bg-slate-700'
                                            }`}
                                        title="Arrastra para reordenar los días"
                                    >
                                        <GripHorizontal size={13} className="opacity-40 flex-shrink-0" />
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
                        onClick={() => handleFinish(acceptedOverlap)}
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
