import React, { useState, useEffect, useMemo } from 'react';
import { CalendarDays, Plus, Users, Clock, Trash2, Edit2, Eye, EyeOff, UserCheck, ChevronLeft, ChevronRight, X, RefreshCw, Phone, Mail, Dumbbell, GripVertical } from 'lucide-react';
import ClassFormModal from './ClassFormModal';
import ScheduleEditor from './ScheduleEditor';
import ConfirmationModal from '../../components/ui/ConfirmationModal';

const GYM_CLASS_NAME = 'Gimnasio';
const DAY_NAMES = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const DAY_SHORT = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

const COLOR_MAP = {
    blue:   { bg: 'bg-blue-500/15',    border: 'border-blue-500/30',    text: 'text-blue-400',    dot: 'bg-blue-500',    solid: '#3b82f6' },
    red:    { bg: 'bg-red-500/15',     border: 'border-red-500/30',     text: 'text-red-400',     dot: 'bg-red-500',     solid: '#ef4444' },
    green:  { bg: 'bg-emerald-500/15', border: 'border-emerald-500/30', text: 'text-emerald-400', dot: 'bg-emerald-500', solid: '#10b981' },
    purple: { bg: 'bg-purple-500/15',  border: 'border-purple-500/30',  text: 'text-purple-400',  dot: 'bg-purple-500',  solid: '#8b5cf6' },
    orange: { bg: 'bg-orange-500/15',  border: 'border-orange-500/30',  text: 'text-orange-400',  dot: 'bg-orange-500',  solid: '#f97316' },
    pink:   { bg: 'bg-pink-500/15',    border: 'border-pink-500/30',    text: 'text-pink-400',    dot: 'bg-pink-500',    solid: '#ec4899' },
    yellow: { bg: 'bg-yellow-500/15',  border: 'border-yellow-500/30',  text: 'text-yellow-400',  dot: 'bg-yellow-500',  solid: '#eab308' },
    cyan:   { bg: 'bg-cyan-500/15',    border: 'border-cyan-500/30',    text: 'text-cyan-400',    dot: 'bg-cyan-500',    solid: '#06b6d4' },
};

function getColor(theme) {
    return COLOR_MAP[theme] || COLOR_MAP.blue;
}

/** Generate time slots at `intervalMin` minute intervals between start and end (HH:MM). */
function generateTimeSlots(start, end, intervalMin = 30) {
    const slots = [];
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    let cur = sh * 60 + sm;
    const endMin = eh * 60 + em;
    while (cur <= endMin) {
        slots.push(`${String(Math.floor(cur / 60)).padStart(2, '0')}:${String(cur % 60).padStart(2, '0')}`);
        cur += intervalMin;
    }
    return slots;
}

// ─── Tabs ────────────────────────────────────────────────────────────────────
const TABS = [
    { id: 'gym',     label: 'Gimnasio',           icon: Dumbbell },
    { id: 'classes', label: 'Clases',             icon: CalendarDays },
    { id: 'manage',  label: 'Gestión de Clases',  icon: Edit2 },
];

export default function ClassManager() {
    const [activeTab, setActiveTab] = useState('gym');
    const [classes, setClasses] = useState([]);
    const [weeklySchedule, setWeeklySchedule] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('active');

    // Week navigation (shared between gym + classes timetables)
    const [weekOffset, setWeekOffset] = useState(0);
    const [weekBookings, setWeekBookings] = useState([]);
    const [bookingsLoading, setBookingsLoading] = useState(false);

    // Attendees drawer
    const [selectedSlot, setSelectedSlot] = useState(null);

    // Modals
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingClass, setEditingClass] = useState(null);
    const [scheduleClass, setScheduleClass] = useState(null);
    const [classToDelete, setClassToDelete] = useState(null);

    // Drag-and-drop toast feedback
    const [moveToast, setMoveToast] = useState(null);

    // ── Computed week dates ────────────────────────────────────────────────
    const weekDates = useMemo(() => {
        const today = new Date();
        const dow = today.getDay();
        const monday = new Date(today);
        monday.setDate(today.getDate() - (dow === 0 ? 6 : dow - 1) + weekOffset * 7);
        return Array.from({ length: 7 }, (_, i) => {
            const d = new Date(monday);
            d.setDate(monday.getDate() + i);
            return d.toISOString().split('T')[0];
        });
    }, [weekOffset]);

    const weekLabel = useMemo(() => {
        const fmt = (d) => new Date(d + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
        return `${fmt(weekDates[0])} — ${fmt(weekDates[6])}`;
    }, [weekDates]);

    // ── Separate gym vs class schedules ────────────────────────────────────
    const gymSchedule = useMemo(() => weeklySchedule.filter(s => s.class_name === GYM_CLASS_NAME), [weeklySchedule]);
    const classSchedule = useMemo(() => weeklySchedule.filter(s => s.class_name !== GYM_CLASS_NAME), [weeklySchedule]);

    const gymTimeSlots = useMemo(() => {
        const t = new Set(); gymSchedule.forEach(s => t.add(s.start_time));
        return Array.from(t).sort();
    }, [gymSchedule]);

    const classTimeSlots = useMemo(() => {
        const t = new Set(); classSchedule.forEach(s => t.add(s.start_time));
        return Array.from(t).sort();
    }, [classSchedule]);

    // ── Data loading ───────────────────────────────────────────────────────
    useEffect(() => { loadData(); }, [filter]);
    useEffect(() => { if (activeTab === 'gym' || activeTab === 'classes') loadWeekBookings(); }, [weekDates, activeTab]);

    // ── Auto-refresh: listen for bookings:updated from main process (poll every 30s) ──
    useEffect(() => {
        if (!window.api?.classes?.onBookingsUpdated) return;
        const unsub = window.api.classes.onBookingsUpdated((data) => {
            console.log('📅 [ClassManager] Bookings updated via', data.eventType);
            // If we're on the timetable tabs, silently refresh bookings
            if (activeTab === 'gym' || activeTab === 'classes') {
                loadWeekBookings();
            }
        });
        return () => unsub();
    }, [activeTab, weekDates]);

    const loadData = async () => {
        setLoading(true);
        try {
            const [cRes, sRes] = await Promise.all([
                window.api.classes.getAll(filter),
                window.api.classes.getWeeklySchedule(),
            ]);
            if (cRes.success) setClasses(cRes.data);
            if (sRes.success) setWeeklySchedule(sRes.data);
        } catch (err) { console.error('Error loading classes:', err); }
        finally { setLoading(false); }
    };

    const loadWeekBookings = async () => {
        setBookingsLoading(true);
        try {
            const res = await window.api.classes.getBookingsForWeek(weekDates[0], weekDates[6]);
            console.log('[UI] getBookingsForWeek result:', JSON.stringify(res));
            if (res.success) setWeekBookings(res.data);
            else console.error('[UI] getBookingsForWeek failed:', res.error);
        } catch (err) { console.error('Error loading week bookings:', err); }
        finally { setBookingsLoading(false); }
    };

    // ── Bookings lookup ────────────────────────────────────────────────────
    const bookingsBySlotDate = useMemo(() => {
        const map = {};
        weekBookings.forEach(b => {
            const k = `${b.schedule_id}:${b.booking_date}`;
            if (!map[k]) map[k] = [];
            map[k].push(b);
        });
        return map;
    }, [weekBookings]);

    // ── Handlers ───────────────────────────────────────────────────────────
    const handleCreate = () => { setEditingClass(null); setIsFormOpen(true); };
    const handleEdit = (cls) => { setEditingClass(cls); setIsFormOpen(true); };
    const handleToggleActive = async (cls) => {
        try { const r = await window.api.classes.toggleActive(cls.id); if (r.success) loadData(); }
        catch (err) { console.error(err); }
    };
    const confirmDelete = async () => {
        if (!classToDelete) return;
        try { const r = await window.api.classes.delete(classToDelete.id); if (r.success) loadData(); }
        catch (err) { console.error(err); }
        finally { setClassToDelete(null); }
    };
    const handleFormSave = () => { setIsFormOpen(false); setEditingClass(null); loadData(); };
    const handleScheduleSave = () => { setScheduleClass(null); loadData(); };

    const openAttendees = (slot, date) => {
        const attendees = bookingsBySlotDate[`${slot.schedule_id}:${date}`] || [];
        setSelectedSlot({ slot, date, attendees });
    };

    // ── Drag & Drop: move schedule to a different day/time ────────────────
    const handleMoveSchedule = async (scheduleId, newDayOfWeek, newStartTime, newEndTime) => {
        try {
            const res = await window.api.classes.updateSchedule(scheduleId, {
                day_of_week: newDayOfWeek,
                start_time: newStartTime,
                end_time: newEndTime,
            });
            if (res.success) {
                await loadData();
                loadWeekBookings();
                setMoveToast(`Clase movida a ${DAY_NAMES[newDayOfWeek]} ${newStartTime}`);
                setTimeout(() => setMoveToast(null), 3000);
            } else {
                setMoveToast(null);
                alert(res.error || 'Error al mover la clase');
            }
        } catch (err) {
            alert(err.message || 'Error al mover la clase');
        }
    };

    // ═══════════════════════════════════════════════════════════════════════
    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
                        <CalendarDays className="text-blue-500" size={32} />
                        Clases y Horarios
                    </h1>
                    <p className="text-slate-400 mt-1">Horario del gimnasio, clases grupales y asistencia.</p>
                </div>
                <button onClick={handleCreate}
                    className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold transition-all shadow-lg shadow-blue-600/20">
                    <Plus size={20} /> Nueva Clase
                </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-slate-900/50 p-1 rounded-xl border border-white/5 w-fit">
                {TABS.map(tab => (
                    <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                            activeTab === tab.id ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-white/5'
                        }`}>
                        <tab.icon size={16} /> {tab.label}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            {activeTab === 'gym' && (
                <GymTimetable
                    weekDates={weekDates} weekLabel={weekLabel} weekOffset={weekOffset} setWeekOffset={setWeekOffset}
                    schedule={gymSchedule} timeSlots={gymTimeSlots} bookingsBySlotDate={bookingsBySlotDate}
                    bookingsLoading={bookingsLoading} onRefresh={loadWeekBookings} onSlotClick={openAttendees}
                />
            )}
            {activeTab === 'classes' && (
                <ClassesTimetable
                    weekDates={weekDates} weekLabel={weekLabel} weekOffset={weekOffset} setWeekOffset={setWeekOffset}
                    schedule={classSchedule} timeSlots={classTimeSlots} bookingsBySlotDate={bookingsBySlotDate}
                    bookingsLoading={bookingsLoading} onRefresh={loadWeekBookings} onSlotClick={openAttendees}
                    onMoveSchedule={handleMoveSchedule}
                />
            )}
            {activeTab === 'manage' && (
                <ClassesManageView
                    classes={classes} weeklySchedule={classSchedule} loading={loading}
                    filter={filter} setFilter={setFilter}
                    onEdit={handleEdit} onToggleActive={handleToggleActive}
                    onDelete={(c) => setClassToDelete(c)} onSchedule={(c) => setScheduleClass(c)}
                />
            )}

            {/* Attendees Drawer */}
            {selectedSlot && (
                <AttendeesDrawer slot={selectedSlot.slot} date={selectedSlot.date}
                    attendees={selectedSlot.attendees} onClose={() => setSelectedSlot(null)} />
            )}

            {/* Modals */}
            {isFormOpen && <ClassFormModal editData={editingClass} onSave={handleFormSave}
                onClose={() => { setIsFormOpen(false); setEditingClass(null); }} />}
            {scheduleClass && <ScheduleEditor gymClass={scheduleClass} onSave={handleScheduleSave}
                onClose={() => setScheduleClass(null)} />}
            <ConfirmationModal isOpen={!!classToDelete} title="Eliminar clase"
                message={`Seguro que quieres eliminar "${classToDelete?.name}"? Se borrarán todos sus horarios.`}
                onConfirm={confirmDelete} onCancel={() => setClassToDelete(null)} type="danger" />

            {/* Drag-and-drop toast */}
            {moveToast && (
                <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-emerald-500/90 backdrop-blur-sm text-white px-5 py-3 rounded-xl font-bold text-sm shadow-2xl shadow-emerald-500/20 animate-in fade-in slide-in-from-bottom-4 duration-300">
                    <CalendarDays size={16} /> {moveToast}
                </div>
            )}
        </div>
    );
}


// ═══════════════════════════════════════════════════════════════════════════════
// SHARED: Week Navigation bar
// ═══════════════════════════════════════════════════════════════════════════════

function WeekNav({ weekLabel, weekOffset, setWeekOffset, bookingsLoading, onRefresh }) {
    const isCurrentWeek = weekOffset === 0;
    return (
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
                <button onClick={() => setWeekOffset(o => o - 1)} className="p-2 hover:bg-white/10 rounded-lg transition-all">
                    <ChevronLeft size={20} className="text-slate-400" />
                </button>
                <div className="text-center min-w-[200px]">
                    <span className="text-white font-bold text-lg">{weekLabel}</span>
                    {isCurrentWeek && <span className="ml-2 text-xs text-blue-400 font-bold">(Esta semana)</span>}
                </div>
                <button onClick={() => setWeekOffset(o => o + 1)} className="p-2 hover:bg-white/10 rounded-lg transition-all">
                    <ChevronRight size={20} className="text-slate-400" />
                </button>
                {!isCurrentWeek && (
                    <button onClick={() => setWeekOffset(0)} className="text-xs text-blue-400 font-bold hover:text-blue-300 ml-2">Hoy</button>
                )}
            </div>
            <button onClick={onRefresh} disabled={bookingsLoading}
                className="flex items-center gap-2 px-3 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-slate-400 text-sm font-medium">
                <RefreshCw size={14} className={bookingsLoading ? 'animate-spin' : ''} /> Actualizar
            </button>
        </div>
    );
}

function DayHeaders({ weekDates }) {
    return (
        <div className="grid grid-cols-[80px_repeat(7,1fr)] border-b border-white/5">
            <div className="p-3 text-center"><span className="text-slate-500 text-xs font-bold">HORA</span></div>
            {weekDates.map((date, i) => {
                const d = new Date(date + 'T12:00:00');
                const isToday = date === new Date().toISOString().split('T')[0];
                return (
                    <div key={date} className={`p-3 text-center border-l border-white/5 ${isToday ? 'bg-blue-500/10' : ''}`}>
                        <div className={`text-xs font-bold ${isToday ? 'text-blue-400' : 'text-slate-500'}`}>{DAY_SHORT[i]}</div>
                        <div className={`text-sm font-black ${isToday ? 'text-white' : 'text-slate-300'}`}>{d.getDate()}</div>
                    </div>
                );
            })}
        </div>
    );
}


// ═══════════════════════════════════════════════════════════════════════════════
// GYM TIMETABLE — Simplified: just hour slots with people count
// ═══════════════════════════════════════════════════════════════════════════════

function GymTimetable({ weekDates, weekLabel, weekOffset, setWeekOffset, schedule, timeSlots, bookingsBySlotDate, bookingsLoading, onRefresh, onSlotClick }) {
    return (
        <div className="space-y-4">
            <WeekNav weekLabel={weekLabel} weekOffset={weekOffset} setWeekOffset={setWeekOffset}
                bookingsLoading={bookingsLoading} onRefresh={onRefresh} />

            <div className="bg-slate-900/30 rounded-2xl border border-white/5 overflow-hidden">
                <DayHeaders weekDates={weekDates} />

                {timeSlots.length === 0 ? (
                    <div className="text-center py-12 px-6 text-slate-500">
                        <Dumbbell className="mx-auto mb-3 text-slate-600" size={40} />
                        <p className="font-medium mb-2">No hay franjas de gimnasio configuradas</p>
                        <p className="text-xs text-slate-600 mb-4 max-w-md mx-auto">
                            Crea una clase llamada <span className="font-mono bg-slate-800 px-1.5 py-0.5 rounded text-slate-300">Gimnasio</span> en
                            la pestaña <strong>"Gestión de Clases"</strong> y añade los horarios de apertura.
                            Tus clientes vern las franjas en la app movil.
                        </p>
                    </div>
                ) : (
                    timeSlots.map(time => (
                        <div key={time} className="grid grid-cols-[80px_repeat(7,1fr)] border-b border-white/5 last:border-b-0">
                            <div className="p-3 flex items-center justify-center border-r border-white/5">
                                <span className="text-slate-400 text-sm font-bold">{time}</span>
                            </div>
                            {weekDates.map((date, dayIndex) => {
                                const isToday = date === new Date().toISOString().split('T')[0];
                                const slot = schedule.find(s => s.day_of_week === dayIndex && s.start_time === time);
                                if (!slot) return <div key={date} className={`border-l border-white/5 ${isToday ? 'bg-blue-500/5' : ''}`} />;

                                const key = `${slot.schedule_id}:${date}`;
                                const attendees = bookingsBySlotDate[key] || [];
                                const count = attendees.length;
                                const capacity = slot.max_capacity;
                                const pct = capacity > 0 ? Math.min((count / capacity) * 100, 100) : 0;
                                const barColor = count >= capacity ? '#ef4444' : pct > 75 ? '#f97316' : pct > 40 ? '#eab308' : '#10b981';

                                return (
                                    <button key={date}
                                        onClick={() => onSlotClick(slot, date)}
                                        className={`border-l border-white/5 p-2 hover:bg-white/5 transition-all cursor-pointer ${isToday ? 'bg-blue-500/5' : ''}`}>
                                        <div className="flex items-center justify-between mb-1.5">
                                            <div className="flex items-center gap-1">
                                                <UserCheck size={11} className="text-slate-500" />
                                                <span className={`text-xs font-black ${count > 0 ? 'text-white' : 'text-slate-600'}`}>{count}</span>
                                            </div>
                                            <span className="text-[10px] text-slate-600">/{capacity}</span>
                                        </div>
                                        <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                                            <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: barColor }} />
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}


// ═══════════════════════════════════════════════════════════════════════════════
// CLASSES TIMETABLE — Shows group classes (Spinning, Yoga, etc.) with details
// ═══════════════════════════════════════════════════════════════════════════════

function ClassesTimetable({ weekDates, weekLabel, weekOffset, setWeekOffset, schedule, timeSlots, bookingsBySlotDate, bookingsLoading, onRefresh, onSlotClick, onMoveSchedule }) {
    const [draggedSlot, setDraggedSlot] = useState(null);
    const [dropTarget, setDropTarget] = useState(null);

    // Build a full time grid (30-min intervals) so there are empty cells to drag into
    const fullTimeSlots = useMemo(() => {
        if (schedule.length === 0) return generateTimeSlots('08:00', '20:00');
        const allTimes = [...schedule.map(s => s.start_time), ...schedule.map(s => s.end_time)].sort();
        const earliest = allTimes[0];
        const latest = allTimes[allTimes.length - 1];
        const startH = Math.max(6, parseInt(earliest.split(':')[0]) - 1);
        const endH = Math.min(23, parseInt(latest.split(':')[0]) + 1);
        // Generate 30-min grid
        const gridSet = new Set(generateTimeSlots(`${String(startH).padStart(2, '0')}:00`, `${String(endH).padStart(2, '0')}:00`));
        // Also include actual start times that may not fall on :00 or :30
        schedule.forEach(s => gridSet.add(s.start_time));
        return [...gridSet].sort();
    }, [schedule]);

    // ── Drag handlers ─────────────────────────────────────────────────────
    const handleDragStart = (e, slot) => {
        setDraggedSlot(slot);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', slot.schedule_id.toString());
        // Ghost preview
        if (e.target) e.target.style.opacity = '0.4';
    };

    const handleDragEnd = (e) => {
        if (e.target) e.target.style.opacity = '1';
        setDraggedSlot(null);
        setDropTarget(null);
    };

    const handleDragOver = (e, dayIndex, time) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        const key = `${dayIndex}:${time}`;
        if (dropTarget !== key) setDropTarget(key);
    };

    const handleDragLeave = (e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setDropTarget(null);
    };

    const handleDrop = async (e, dayIndex, time) => {
        e.preventDefault();
        setDropTarget(null);
        if (!draggedSlot) return;

        // Same position? no-op
        if (draggedSlot.day_of_week === dayIndex && draggedSlot.start_time === time) {
            setDraggedSlot(null);
            return;
        }

        // Calculate new end_time from duration
        const [h, m] = time.split(':').map(Number);
        const totalMin = h * 60 + m + draggedSlot.duration_minutes;
        const newEndTime = `${String(Math.floor(totalMin / 60)).padStart(2, '0')}:${String(totalMin % 60).padStart(2, '0')}`;

        if (onMoveSchedule) await onMoveSchedule(draggedSlot.schedule_id, dayIndex, time, newEndTime);
        setDraggedSlot(null);
    };

    // ── Render ────────────────────────────────────────────────────────────
    return (
        <div className="space-y-4">
            <WeekNav weekLabel={weekLabel} weekOffset={weekOffset} setWeekOffset={setWeekOffset}
                bookingsLoading={bookingsLoading} onRefresh={onRefresh} />

            <div className="bg-slate-900/30 rounded-2xl border border-white/5 overflow-hidden">
                <DayHeaders weekDates={weekDates} />

                {fullTimeSlots.length === 0 ? (
                    <div className="text-center py-16 text-slate-500">
                        <CalendarDays className="mx-auto mb-3 text-slate-600" size={40} />
                        <p className="font-medium">No hay clases grupales configuradas</p>
                        <p className="text-sm mt-1">Ve a "Gestión de Clases" para crear clases</p>
                    </div>
                ) : (
                    fullTimeSlots.map(time => {
                        const hasClasses = schedule.some(s => s.start_time === time);
                        return (
                            <div key={time} className={`grid grid-cols-[80px_repeat(7,1fr)] border-b border-white/5 last:border-b-0 transition-all ${hasClasses ? 'min-h-[72px]' : 'min-h-[40px]'}`}>
                                {/* Time label */}
                                <div className={`flex items-center justify-center border-r border-white/5 ${hasClasses ? 'p-3' : 'p-1'}`}>
                                    <span className={`text-sm font-bold ${hasClasses ? 'text-slate-400' : 'text-slate-600/50'}`}>{time}</span>
                                </div>

                                {/* Day columns */}
                                {weekDates.map((date, dayIndex) => {
                                    const isToday = date === new Date().toISOString().split('T')[0];
                                    const daySlots = schedule.filter(s => s.day_of_week === dayIndex && s.start_time === time);
                                    const isDropHere = dropTarget === `${dayIndex}:${time}`;
                                    const isDragging = !!draggedSlot;

                                    return (
                                        <div key={date}
                                            className={`border-l border-white/5 transition-all ${hasClasses ? 'p-1.5' : 'p-0.5'}
                                                ${isToday ? 'bg-blue-500/5' : ''}
                                                ${isDropHere ? 'bg-blue-500/20 ring-2 ring-inset ring-blue-400/60' : ''}
                                                ${isDragging && !isDropHere ? 'hover:bg-white/5' : ''}`}
                                            onDragOver={(e) => handleDragOver(e, dayIndex, time)}
                                            onDragLeave={handleDragLeave}
                                            onDrop={(e) => handleDrop(e, dayIndex, time)}>

                                            {daySlots.map(slot => {
                                                const c = getColor(slot.color_theme);
                                                const attendees = bookingsBySlotDate[`${slot.schedule_id}:${date}`] || [];
                                                const count = attendees.length;
                                                const isFull = count >= slot.max_capacity;
                                                const isBeingDragged = draggedSlot?.schedule_id === slot.schedule_id;

                                                return (
                                                    <div key={slot.schedule_id}
                                                        draggable
                                                        onDragStart={(e) => handleDragStart(e, slot)}
                                                        onDragEnd={handleDragEnd}
                                                        onClick={() => onSlotClick(slot, date)}
                                                        className={`w-full ${c.bg} border ${c.border} rounded-xl p-2 text-left transition-all
                                                            cursor-grab active:cursor-grabbing hover:scale-[1.02] hover:shadow-lg
                                                            ${isBeingDragged ? 'opacity-30 scale-95 ring-2 ring-dashed ring-white/20' : ''}`}>

                                                        <div className="flex items-center gap-1.5 mb-1">
                                                            <GripVertical size={12} className="text-slate-600/60 flex-shrink-0 -ml-0.5" />
                                                            <div className={`w-2 h-2 rounded-full ${c.dot} flex-shrink-0`} />
                                                            <span className={`text-xs font-black ${c.text} truncate flex-1`}>{slot.class_name}</span>
                                                        </div>
                                                        {slot.instructor && <div className="text-[10px] text-slate-500 truncate pl-5 mb-1">{slot.instructor}</div>}
                                                        <div className="flex items-center gap-1 pl-5">
                                                            <UserCheck size={10} className={isFull ? 'text-red-400' : 'text-slate-500'} />
                                                            <span className={`text-[10px] font-bold ${isFull ? 'text-red-400' : 'text-slate-500'}`}>{count}/{slot.max_capacity}</span>
                                                        </div>
                                                    </div>
                                                );
                                            })}

                                            {/* Drop zone indicator for empty cells while dragging */}
                                            {isDragging && daySlots.length === 0 && isDropHere && (
                                                <div className="flex items-center justify-center h-full min-h-[30px]">
                                                    <span className="text-[10px] font-bold text-blue-400/80">Soltar aquí</span>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        );
                    })
                )}
            </div>

            <p className="text-xs text-slate-500 text-center flex items-center justify-center gap-1.5">
                <GripVertical size={12} className="text-slate-600" />
                Arrastra las clases para moverlas a otro día u hora
            </p>
        </div>
    );
}


// ═══════════════════════════════════════════════════════════════════════════════
// ATTENDEES DRAWER — Slide-in panel showing who's booked
// ═══════════════════════════════════════════════════════════════════════════════

function AttendeesDrawer({ slot, date, attendees, onClose }) {
    const c = getColor(slot.color_theme);
    const d = new Date(date + 'T12:00:00');
    const dateLabel = d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
    const isGym = slot.class_name === GYM_CLASS_NAME;

    return (
        <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
            <div className="relative w-full max-w-md bg-slate-900 border-l border-white/10 shadow-2xl overflow-y-auto animate-in slide-in-from-right duration-300"
                onClick={e => e.stopPropagation()}>

                {/* Header */}
                <div className={`${isGym ? 'bg-emerald-500/10 border-emerald-500/20' : c.bg + ' border-b ' + c.border} border-b p-6`}>
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                            {isGym ? <Dumbbell size={20} className="text-emerald-400" /> : <div className={`w-3 h-3 rounded-full ${c.dot}`} />}
                            <h2 className={`text-xl font-black ${isGym ? 'text-emerald-400' : c.text}`}>
                                {isGym ? `Gimnasio` : slot.class_name}
                            </h2>
                        </div>
                        <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-lg">
                            <X size={20} className="text-slate-400" />
                        </button>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-slate-400">
                        <span className="capitalize">{dateLabel}</span>
                        <span className="font-bold">{slot.start_time} - {slot.end_time}</span>
                    </div>
                    {!isGym && slot.instructor && <div className="text-sm text-slate-500 mt-1">Instructor: {slot.instructor}</div>}
                    <div className="mt-4 flex items-center gap-3">
                        <div className={`text-2xl font-black ${isGym ? 'text-emerald-400' : c.text}`}>{attendees.length}</div>
                        <div className="text-slate-400 text-sm">de {slot.max_capacity} plazas</div>
                        <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden ml-2">
                            <div className="h-full rounded-full transition-all"
                                style={{
                                    width: `${Math.min((attendees.length / slot.max_capacity) * 100, 100)}%`,
                                    backgroundColor: attendees.length >= slot.max_capacity ? '#ef4444' : (isGym ? '#10b981' : c.solid || '#3b82f6'),
                                }} />
                        </div>
                    </div>
                </div>

                {/* Attendee List */}
                <div className="p-4">
                    <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-3">
                        Personas Apuntadas ({attendees.length})
                    </h3>
                    {attendees.length === 0 ? (
                        <div className="text-center py-12">
                            <Users className="mx-auto text-slate-600 mb-3" size={36} />
                            <p className="text-slate-500 text-sm font-medium">Nadie apuntado todavía</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {attendees.map((a, i) => (
                                <div key={a.id} className="flex items-center gap-3 p-3 bg-white/5 rounded-xl border border-white/5 hover:bg-white/10 transition-all">
                                    <div className="w-9 h-9 rounded-lg bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                                        <span className="text-sm font-black text-blue-400">
                                            {a.customer_name?.split(' ').map(n => n[0]).join('').slice(0, 2) || '?'}
                                        </span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-sm font-bold text-white truncate">{a.customer_name}</div>
                                        <div className="flex items-center gap-3 mt-0.5">
                                            {a.customer_email && <span className="text-[11px] text-slate-500 flex items-center gap-1 truncate"><Mail size={10} /> {a.customer_email}</span>}
                                            {a.customer_phone && <span className="text-[11px] text-slate-500 flex items-center gap-1"><Phone size={10} /> {a.customer_phone}</span>}
                                        </div>
                                    </div>
                                    <div className="text-xs font-bold text-slate-600">#{i + 1}</div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}


// ═══════════════════════════════════════════════════════════════════════════════
// CLASSES MANAGE VIEW — CRUD cards (includes Gimnasio with special badge)
// ═══════════════════════════════════════════════════════════════════════════════

function ClassesManageView({ classes, weeklySchedule, loading, filter, setFilter, onEdit, onToggleActive, onDelete, onSchedule }) {
    // Include ALL classes including the special "Gimnasio" one so the owner
    // can edit its capacity, color and schedules from the management view.
    // Gimnasio is rendered with a distinct badge so it's not confused with a regular class.
    const managedClasses = useMemo(() => classes, [classes]);

    const scheduleByDay = DAY_NAMES.map((name, i) => ({
        day: i, name, slots: weeklySchedule.filter(s => s.day_of_week === i),
    }));
    const [expandedDay, setExpandedDay] = useState(new Date().getDay() === 0 ? 6 : new Date().getDay() - 1);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex gap-4">
                    <StatCard icon={CalendarDays} color="text-blue-400" label="Total" value={managedClasses.length} />
                    <StatCard icon={Eye} color="text-emerald-400" label="Activas" value={managedClasses.filter(c => c.active).length} />
                    <StatCard icon={Clock} color="text-purple-400" label="Horarios" value={weeklySchedule.length} />
                </div>
                <select value={filter} onChange={(e) => setFilter(e.target.value)}
                    className="bg-slate-800 border border-white/10 text-slate-300 rounded-xl px-4 py-2.5 font-bold text-sm">
                    <option value="all">Todas</option>
                    <option value="active">Activas</option>
                    <option value="inactive">Inactivas</option>
                </select>
            </div>

            <div>
                <h2 className="text-sm font-black text-slate-500 uppercase tracking-widest mb-4">Clases Grupales</h2>
                {loading ? (
                    <div className="text-center py-12 text-slate-500">Cargando...</div>
                ) : managedClasses.length === 0 ? (
                    <div className="text-center py-16 bg-slate-900/30 rounded-2xl border border-white/5">
                        <CalendarDays className="mx-auto text-slate-600 mb-4" size={48} />
                        <p className="text-slate-400 font-medium">No hay clases grupales creadas</p>
                        <p className="text-slate-500 text-sm mt-1">Crea tu primera clase para empezar</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {managedClasses.map(cls => {
                            const c = getColor(cls.color_theme);
                            return (
                                <div key={cls.id} className={`${c.bg} border ${c.border} rounded-2xl p-5 transition-all hover:scale-[1.01] ${!cls.active ? 'opacity-50' : ''}`}>
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="flex items-center gap-2">
                                            <div className={`w-3 h-3 rounded-full ${c.dot}`} />
                                            <h3 className={`font-black text-lg ${c.text}`}>{cls.name}</h3>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <button onClick={() => onEdit(cls)} className="p-1.5 hover:bg-white/10 rounded-lg" title="Editar"><Edit2 size={14} className="text-slate-400" /></button>
                                            <button onClick={() => onToggleActive(cls)} className="p-1.5 hover:bg-white/10 rounded-lg" title={cls.active ? 'Desactivar' : 'Activar'}>
                                                {cls.active ? <EyeOff size={14} className="text-slate-400" /> : <Eye size={14} className="text-emerald-400" />}
                                            </button>
                                            <button onClick={() => onDelete(cls)} className="p-1.5 hover:bg-red-500/20 rounded-lg" title="Eliminar"><Trash2 size={14} className="text-red-400" /></button>
                                        </div>
                                    </div>
                                    {cls.description && <p className="text-slate-400 text-xs mb-3 line-clamp-2">{cls.description}</p>}
                                    <div className="flex items-center gap-4 text-xs text-slate-400 mb-4">
                                        {cls.instructor && <span className="flex items-center gap-1"><Users size={12} /> {cls.instructor}</span>}
                                        <span className="flex items-center gap-1"><Users size={12} /> {cls.max_capacity} plazas</span>
                                        <span className="flex items-center gap-1"><Clock size={12} /> {cls.duration_minutes} min</span>
                                    </div>
                                    <button onClick={() => onSchedule(cls)}
                                        className="w-full text-center text-xs font-bold text-slate-300 bg-white/5 hover:bg-white/10 py-2 rounded-xl transition-all">
                                        Gestionar Horarios ({cls.schedule_count || 0})
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Weekly overview accordion */}
            <div>
                <h2 className="text-sm font-black text-slate-500 uppercase tracking-widest mb-4">Horario Semanal de Clases</h2>
                <div className="bg-slate-900/30 rounded-2xl border border-white/5 overflow-hidden">
                    {scheduleByDay.map(({ day, name, slots }) => (
                        <div key={day} className="border-b border-white/5 last:border-b-0">
                            <button onClick={() => setExpandedDay(expandedDay === day ? -1 : day)}
                                className="w-full flex items-center justify-between px-5 py-3 hover:bg-white/5 transition-all">
                                <div className="flex items-center gap-3">
                                    <span className="font-bold text-white text-sm">{name}</span>
                                    <span className="text-xs text-slate-500 font-medium">{slots.length} {slots.length === 1 ? 'clase' : 'clases'}</span>
                                </div>
                            </button>
                            {expandedDay === day && (
                                <div className="px-5 pb-4 space-y-2">
                                    {slots.length === 0 ? (
                                        <p className="text-slate-500 text-xs italic pl-4">Sin clases programadas</p>
                                    ) : slots.map(slot => {
                                        const sc = getColor(slot.color_theme);
                                        return (
                                            <div key={slot.schedule_id} className={`flex items-center gap-3 py-2 px-3 rounded-xl ${sc.bg} border ${sc.border}`}>
                                                <div className={`w-2 h-2 rounded-full ${sc.dot}`} />
                                                <span className={`font-bold text-sm ${sc.text}`}>{slot.class_name}</span>
                                                <span className="text-slate-400 text-xs">{slot.start_time} - {slot.end_time}</span>
                                                {slot.instructor && <span className="text-slate-500 text-xs">| {slot.instructor}</span>}
                                                <span className="text-slate-500 text-xs ml-auto">{slot.max_capacity} plazas</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

function StatCard({ icon: Icon, color, label, value }) {
    return (
        <div className="bg-slate-900/50 backdrop-blur-xl border border-white/5 px-5 py-3 rounded-2xl flex items-center gap-3">
            <Icon className={color} size={18} />
            <div>
                <div className="text-xs text-slate-500 font-medium">{label}</div>
                <div className={`text-lg font-black ${color}`}>{value}</div>
            </div>
        </div>
    );
}
