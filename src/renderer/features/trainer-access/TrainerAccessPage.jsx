import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    UserPlus, Mail, Loader2, Trash2, Users, Search, Check, X,
    KeyRound, Clock, CheckCircle2, AlertCircle, Shield,
} from 'lucide-react';
import { useGym } from '../../context/GymContext';
import ConfirmationModal from '../../components/ui/ConfirmationModal';
import { textIncludes } from '../../lib/text';

// Unwrap IPC double-wrap { success, data: <handlerResult> } and the
// handler's own { success, data: [...] }. Returns the inner result.
function unwrap(res) {
    if (!res) return null;
    if (res && typeof res === 'object' && 'data' in res && res.success !== undefined) {
        // top-level IPC envelope
        return res.data ?? null;
    }
    return res;
}
function asArray(res) {
    const inner = unwrap(res);
    if (Array.isArray(inner)) return inner;
    if (inner && Array.isArray(inner.data)) return inner.data;
    return [];
}

function statusBadge(t) {
    if (!t.active) return { label: 'Revocado', cls: 'bg-red-500/10 text-red-400 border-red-500/20', icon: X };
    if (t.linked_at) return { label: 'Activo', cls: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', icon: CheckCircle2 };
    return { label: 'Invitado', cls: 'bg-amber-500/10 text-amber-400 border-amber-500/20', icon: Clock };
}

function InviteForm({ gymId, onDone }) {
    const queryClient = useQueryClient();
    const [email, setEmail] = useState('');
    const [name, setName] = useState('');
    const [busy, setBusy] = useState(false);
    const [msg, setMsg] = useState(null);

    const submit = async (e) => {
        e.preventDefault();
        if (busy || !email.trim()) return;
        setBusy(true); setMsg(null);
        try {
            const res = await window.api.cloud.inviteTrainer(gymId, email.trim(), name.trim() || null);
            const inner = unwrap(res) || {};
            if (inner.success) {
                setMsg({ kind: 'ok', text: inner.message || 'Invitación enviada' });
                setEmail(''); setName('');
                queryClient.invalidateQueries(['trainers']);
                onDone?.();
            } else {
                setMsg({ kind: 'err', text: inner.error || 'No se pudo invitar' });
            }
        } catch (err) {
            setMsg({ kind: 'err', text: err?.message || 'Error inesperado' });
        } finally { setBusy(false); }
    };

    return (
        <form onSubmit={submit} className="rounded-2xl border border-white/10 bg-gradient-to-br from-blue-600/5 to-cyan-600/5 p-5">
            <div className="mb-3 flex items-center gap-2">
                <UserPlus className="text-blue-400" size={18} />
                <h3 className="text-base font-bold text-white">Invitar entrenador</h3>
            </div>
            <p className="mb-4 text-xs text-slate-400">
                Recibirá un email con un enlace para crear su contraseña. Después podrá iniciar sesión
                en su propio PC en modo entrenador y ver solo los clientes que le asignes.
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_auto]">
                <input
                    type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                    placeholder="correo@dominio.com"
                    className="rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm font-medium text-white outline-none focus:border-blue-500"
                />
                <input
                    type="text" value={name} onChange={(e) => setName(e.target.value)}
                    placeholder="Nombre (opcional)"
                    className="rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm font-medium text-white outline-none focus:border-blue-500"
                />
                <button
                    type="submit" disabled={busy || !email.trim()}
                    className="flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white shadow-lg shadow-blue-900/20 transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                    {busy ? <Loader2 size={16} className="animate-spin" /> : <Mail size={16} />}
                    {busy ? 'Enviando…' : 'Enviar invitación'}
                </button>
            </div>
            {msg && (
                <div className={`mt-3 flex items-start gap-2 rounded-lg border px-3 py-2 text-sm ${msg.kind === 'ok' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : 'border-red-500/30 bg-red-500/10 text-red-300'}`}>
                    {msg.kind === 'ok' ? <CheckCircle2 size={16} className="mt-0.5 shrink-0" /> : <AlertCircle size={16} className="mt-0.5 shrink-0" />}
                    <span>{msg.text}</span>
                </div>
            )}
        </form>
    );
}

function AssignDialog({ gymId, trainer, onClose }) {
    const queryClient = useQueryClient();
    const { customers } = useGym();
    const [search, setSearch] = useState('');
    const [picked, setPicked] = useState(() => new Set(
        (customers || []).filter((c) => c.assigned_trainer_id === trainer.id).map((c) => c.id)
    ));
    const [busy, setBusy] = useState(false);
    // Anchor for shift-click range selection. Stores the last clicked id and
    // whether that click was "picking" (true) or "unpicking" (false) — we apply
    // the same operation to the whole range so dragging a selection feels natural.
    const [anchor, setAnchor] = useState(null); // { id, picking }

    const filtered = useMemo(() =>
        (customers || [])
            .filter((c) => c.active === 1)
            .filter((c) => textIncludes(`${c.first_name} ${c.last_name}`, search))
            .sort((a, b) => `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`))
    , [customers, search]);

    // Selection stats relative to the CURRENT filtered list (so the buttons
    // act on what the user is actually seeing).
    const visibleIds = useMemo(() => filtered.map((c) => c.id), [filtered]);
    const visibleSelected = useMemo(() => visibleIds.filter((id) => picked.has(id)).length, [visibleIds, picked]);
    const allVisibleSelected = visibleIds.length > 0 && visibleSelected === visibleIds.length;

    const handleClick = (id, e) => {
        // Shift-click → range select between anchor and this row.
        if (e.shiftKey && anchor && anchor.id !== id) {
            const a = visibleIds.indexOf(anchor.id);
            const b = visibleIds.indexOf(id);
            if (a !== -1 && b !== -1) {
                const [lo, hi] = a < b ? [a, b] : [b, a];
                const next = new Set(picked);
                for (let i = lo; i <= hi; i++) {
                    if (anchor.picking) next.add(visibleIds[i]);
                    else next.delete(visibleIds[i]);
                }
                setPicked(next);
                return;
            }
        }
        const next = new Set(picked);
        const willPick = !next.has(id);
        if (willPick) next.add(id); else next.delete(id);
        setPicked(next);
        setAnchor({ id, picking: willPick });
    };

    const selectAllVisible = () => {
        const next = new Set(picked);
        visibleIds.forEach((id) => next.add(id));
        setPicked(next);
    };
    const clearVisible = () => {
        const next = new Set(picked);
        visibleIds.forEach((id) => next.delete(id));
        setPicked(next);
    };
    const invertVisible = () => {
        const next = new Set(picked);
        visibleIds.forEach((id) => { if (next.has(id)) next.delete(id); else next.add(id); });
        setPicked(next);
    };

    const save = async () => {
        setBusy(true);
        try {
            const original = new Set((customers || []).filter((c) => c.assigned_trainer_id === trainer.id).map((c) => c.id));
            const toAdd = [...picked].filter((id) => !original.has(id));
            const toRemove = [...original].filter((id) => !picked.has(id));
            if (toAdd.length) await window.api.cloud.assignCustomersToTrainer(gymId, trainer.id, toAdd);
            if (toRemove.length) await window.api.cloud.assignCustomersToTrainer(gymId, null, toRemove);
            queryClient.invalidateQueries(['trainers']);
            // Refresh customers context so assigned_trainer_id reflects change.
            await window.api.customers.list?.();
            onClose();
        } finally { setBusy(false); }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
            <div className="m-4 flex h-[80vh] w-full max-w-2xl flex-col rounded-2xl border border-white/10 bg-slate-950 shadow-2xl" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
                    <div>
                        <h3 className="text-lg font-bold text-white">Asignar clientes</h3>
                        <p className="text-sm text-slate-400">{trainer.full_name || trainer.email}</p>
                    </div>
                    <button onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-white/5 hover:text-white"><X size={18} /></button>
                </div>
                <div className="border-b border-white/5 p-4">
                    <div className="relative">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                        <input
                            value={search} onChange={(e) => setSearch(e.target.value)}
                            placeholder="Buscar cliente…"
                            className="w-full rounded-lg border border-white/10 bg-slate-900 py-2 pl-9 pr-3 text-sm text-white outline-none focus:border-blue-500"
                        />
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                        <button
                            type="button"
                            onClick={allVisibleSelected ? clearVisible : selectAllVisible}
                            disabled={visibleIds.length === 0}
                            className="flex items-center gap-1.5 rounded-md border border-blue-500/30 bg-blue-500/10 px-2.5 py-1.5 text-xs font-bold text-blue-300 transition hover:bg-blue-500/20 disabled:opacity-40"
                        >
                            {allVisibleSelected ? <X size={13} /> : <Check size={13} />}
                            {allVisibleSelected ? 'Quitar todos' : 'Seleccionar todos'}
                            {search && visibleIds.length > 0 && <span className="opacity-70">({visibleIds.length})</span>}
                        </button>
                        {visibleSelected > 0 && visibleSelected < visibleIds.length && (
                            <button
                                type="button"
                                onClick={invertVisible}
                                className="rounded-md border border-white/10 bg-slate-800/60 px-2.5 py-1.5 text-xs font-bold text-slate-300 transition hover:bg-slate-700"
                            >
                                Invertir
                            </button>
                        )}
                        <p className="ml-auto text-xs text-slate-500">
                            <span className="font-bold text-white">{picked.size}</span> total
                            {search && <span> · {visibleSelected}/{visibleIds.length} visibles</span>}
                        </p>
                    </div>
                    <p className="mt-2 text-[11px] text-slate-600">
                        Tip: <kbd className="rounded bg-slate-800 px-1 py-0.5 text-slate-400">Shift</kbd> + clic selecciona un rango.
                    </p>
                </div>
                <div className="flex-1 overflow-y-auto p-3">
                    {filtered.length === 0 ? (
                        <div className="py-12 text-center text-sm text-slate-500">Sin coincidencias.</div>
                    ) : filtered.map((c) => {
                        const isPicked = picked.has(c.id);
                        const otherTrainer = c.assigned_trainer_id && c.assigned_trainer_id !== trainer.id;
                        return (
                            <button
                                key={c.id}
                                onClick={(e) => handleClick(c.id, e)}
                                className={`mb-1 flex w-full select-none items-center justify-between rounded-lg border px-3 py-2.5 text-left transition ${isPicked ? 'border-blue-500/40 bg-blue-500/10' : 'border-transparent hover:bg-white/5'}`}
                            >
                                <div className="flex items-center gap-3">
                                    <div className={`flex size-5 items-center justify-center rounded border ${isPicked ? 'border-blue-500 bg-blue-500' : 'border-white/20'}`}>
                                        {isPicked && <Check size={12} className="text-white" />}
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold text-white">{c.first_name} {c.last_name}</p>
                                        {otherTrainer && <p className="text-xs text-amber-400">Asignado a otro entrenador (lo moverás)</p>}
                                    </div>
                                </div>
                            </button>
                        );
                    })}
                </div>
                <div className="flex justify-end gap-2 border-t border-white/10 px-5 py-4">
                    <button onClick={onClose} disabled={busy} className="rounded-lg px-4 py-2 text-sm font-bold text-slate-300 hover:bg-white/5">Cancelar</button>
                    <button onClick={save} disabled={busy} className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-500 disabled:opacity-50">
                        {busy ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                        Guardar
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function TrainerAccessPage() {
    const queryClient = useQueryClient();
    const [confirmModal, setConfirmModal] = useState({ isOpen: false });
    const [assignFor, setAssignFor] = useState(null);

    const { data: gymInfo } = useQuery({
        queryKey: ['license-data'],
        queryFn: async () => {
            const res = await window.api.license.getData();
            return unwrap(res) || res || {};
        },
    });
    const gymId = gymInfo?.gym_id;

    const { data: trainers = [], isLoading } = useQuery({
        queryKey: ['trainers', gymId],
        enabled: !!gymId,
        queryFn: async () => asArray(await window.api.cloud.listTrainers(gymId)),
    });

    const revokeMutation = useMutation({
        mutationFn: ({ trainerId }) => window.api.cloud.revokeTrainer(gymId, trainerId),
        onSuccess: () => queryClient.invalidateQueries(['trainers']),
    });

    const handleRevoke = (t) => setConfirmModal({
        isOpen: true,
        title: 'Revocar acceso',
        type: 'danger',
        confirmText: 'Revocar',
        children: (
            <div>
                <p>¿Seguro que quieres revocar el acceso de <strong>{t.full_name || t.email}</strong>?</p>
                <p className="mt-2 text-sm text-slate-400">No podrá iniciar sesión más y todos sus clientes asignados quedarán sin entrenador.</p>
            </div>
        ),
        onConfirm: () => revokeMutation.mutate({ trainerId: t.id }),
    });

    return (
        <div className="mx-auto h-full max-w-5xl space-y-5 overflow-y-auto p-6">
            <header>
                <div className="flex items-center gap-3">
                    <div className="rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 p-2.5">
                        <Shield className="text-white" size={22} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-white">Acceso de entrenadores</h1>
                        <p className="text-sm text-slate-400">Invita a colaboradores para que gestionen clientes desde su propio PC.</p>
                    </div>
                </div>
            </header>

            <InviteForm gymId={gymId} />

            <section>
                <div className="mb-3 flex items-center gap-2">
                    <Users size={16} className="text-slate-400" />
                    <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400">Entrenadores ({trainers.length})</h2>
                </div>

                {isLoading ? (
                    <div className="flex items-center justify-center gap-2 py-12 text-slate-400">
                        <Loader2 className="size-5 animate-spin" /> Cargando…
                    </div>
                ) : trainers.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-white/10 bg-slate-900/30 py-16 text-center">
                        <KeyRound className="mx-auto mb-3 size-10 text-slate-700" />
                        <p className="font-bold text-slate-300">Sin entrenadores invitados aún</p>
                        <p className="mt-1 text-sm text-slate-500">Invita al primero con el formulario de arriba.</p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {trainers.map((t) => {
                            const badge = statusBadge(t);
                            const Icon = badge.icon;
                            return (
                                <div key={t.id} className="flex items-center justify-between rounded-xl border border-white/5 bg-slate-900/40 p-4">
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2">
                                            <p className="truncate font-bold text-white">{t.full_name || t.email}</p>
                                            <span className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${badge.cls}`}>
                                                <Icon size={10} />
                                                {badge.label}
                                            </span>
                                        </div>
                                        {t.full_name && <p className="truncate text-xs text-slate-500">{t.email}</p>}
                                        <p className="mt-1 text-xs text-slate-500">
                                            {t.assigned_customers} cliente{t.assigned_customers === 1 ? '' : 's'} asignado{t.assigned_customers === 1 ? '' : 's'}
                                            {!t.linked_at && t.active && ' · pendiente de aceptar'}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {t.active && (
                                            <button
                                                onClick={() => setAssignFor(t)}
                                                className="rounded-lg border border-white/10 bg-slate-800/60 px-3 py-2 text-xs font-bold text-blue-300 hover:bg-slate-700 hover:text-white"
                                            >
                                                Asignar clientes
                                            </button>
                                        )}
                                        {t.active && (
                                            <button
                                                onClick={() => handleRevoke(t)}
                                                className="rounded-lg border border-white/10 bg-slate-800/40 p-2 text-red-400 hover:bg-red-700 hover:text-white"
                                                title="Revocar acceso"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </section>

            {assignFor && <AssignDialog gymId={gymId} trainer={assignFor} onClose={() => setAssignFor(null)} />}
            <ConfirmationModal
                isOpen={confirmModal.isOpen}
                title={confirmModal.title}
                type={confirmModal.type}
                confirmText={confirmModal.confirmText}
                onClose={() => setConfirmModal({ isOpen: false })}
                onConfirm={confirmModal.onConfirm}
            >
                {confirmModal.children}
            </ConfirmationModal>
        </div>
    );
}
