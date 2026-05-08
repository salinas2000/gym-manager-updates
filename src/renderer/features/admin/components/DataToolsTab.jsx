import React, { useState } from 'react';
import { Dumbbell, Users, Download, Upload, Send, Cloud } from 'lucide-react';
import { useToast } from '../../../context/ToastContext';
import ImportDatasetModal from '../../training/ImportDatasetModal';
import ImportCustomersJsonModal from '../../customers/ImportCustomersJsonModal';

export function DataToolsTab({ gyms = [] }) {
    const toast = useToast();

    const [isImportExercisesOpen, setIsImportExercisesOpen] = useState(false);
    const [isImportCustomersOpen, setIsImportCustomersOpen] = useState(false);
    const [targetGymId, setTargetGymId] = useState('');
    const [pushingKind, setPushingKind] = useState(null); // 'exercise' | 'customer' | null

    const handleExportExercises = async () => {
        try {
            const res = await window.api.training.exportDataset();
            const data = res?.success ? res : (res?.data || res);
            if (data?.cancelled) return;
            if (data?.success) {
                toast.success(`${data.count} ejercicios exportados a ${data.filePath?.split(/[\\/]/).pop()}`);
            }
        } catch (err) {
            toast.error(err.message || 'Error al exportar');
        }
    };

    const handleExportCustomers = async () => {
        try {
            const res = await window.api.customers.exportDataset();
            const data = res?.success ? res : (res?.data || res);
            if (data?.cancelled) return;
            if (data?.success) {
                toast.success(`${data.count} clientes exportados a ${data.filePath?.split(/[\\/]/).pop()}`);
            }
        } catch (err) {
            toast.error(err.message || 'Error al exportar');
        }
    };

    const handlePush = async (kind) => {
        if (!targetGymId) {
            toast.error('Selecciona un gimnasio destino');
            return;
        }
        setPushingKind(kind);
        try {
            const fn = kind === 'exercise'
                ? window.api.cloud.pushExerciseDatasetToGym
                : window.api.cloud.pushCustomerDatasetToGym;
            const res = await fn(targetGymId);
            const data = res?.success ? res : (res?.data || res);
            if (data?.success) {
                toast.success(`Dataset enviado. El gimnasio recibirá una notificación para cargarlo.`);
            } else {
                toast.error(data?.error || 'Error al enviar');
            }
        } catch (err) {
            toast.error(err.message || 'Error al enviar');
        } finally {
            setPushingKind(null);
        }
    };

    // Deduplicate by gym_id (a gym can have multiple licenses; we want unique gyms)
    const eligibleGyms = (() => {
        const map = new Map();
        for (const g of gyms || []) {
            if (!g.gym_id || g.active === false) continue;
            if (!map.has(g.gym_id)) {
                map.set(g.gym_id, { ...g, license_count: 1 });
            } else {
                map.get(g.gym_id).license_count++;
            }
        }
        return [...map.values()].sort((a, b) => (a.gym_name || '').localeCompare(b.gym_name || ''));
    })();

    return (
        <div className="p-8 space-y-8">
            {/* Sección Ejercicios */}
            <Section
                icon={<Dumbbell size={20} className="text-emerald-400" />}
                title="Biblioteca de Ejercicios"
                description="Importa o exporta el catálogo de ejercicios del gimnasio en formato JSON. La importación es add-only: nunca sobrescribe los ejercicios existentes."
            >
                <ToolButton
                    onClick={() => setIsImportExercisesOpen(true)}
                    icon={<Upload size={16} />}
                    label="Importar dataset (.json)"
                    sub="Añade categorías y ejercicios desde un archivo JSON. Respeta los existentes."
                    color="emerald"
                />
                <ToolButton
                    onClick={handleExportExercises}
                    icon={<Download size={16} />}
                    label="Exportar biblioteca (.json)"
                    sub="Genera un JSON con tus categorías, subcategorías y ejercicios. Listo para enviar a otro gimnasio."
                    color="amber"
                />
            </Section>

            {/* Sección Clientes */}
            <Section
                icon={<Users size={20} className="text-blue-400" />}
                title="Clientes"
                description="Importa o exporta la cartera de clientes en formato JSON. La importación es add-only por email: clientes existentes se respetan."
            >
                <ToolButton
                    onClick={() => setIsImportCustomersOpen(true)}
                    icon={<Upload size={16} />}
                    label="Importar clientes (.json)"
                    sub="Añade clientes desde un archivo JSON. Saltea los que tengan el mismo email."
                    color="blue"
                />
                <ToolButton
                    onClick={handleExportCustomers}
                    icon={<Download size={16} />}
                    label="Exportar clientes (.json)"
                    sub="Genera un JSON con tus clientes (sin pagos ni mesociclos)."
                    color="amber"
                />
            </Section>

            {/* Sección Enviar a otro gimnasio */}
            <Section
                icon={<Cloud size={20} className="text-fuchsia-400" />}
                title="Enviar a otro gimnasio"
                description="Empuja TU biblioteca de ejercicios o TU cartera de clientes a otro gimnasio (vía Supabase). El gimnasio receptor verá una notificación para cargar el dataset (add-only)."
            >
                <div className="md:col-span-2">
                    <label className="text-xs text-slate-500 uppercase tracking-wider block mb-1">Gimnasio destino</label>
                    <select
                        value={targetGymId}
                        onChange={(e) => setTargetGymId(e.target.value)}
                        className="w-full bg-slate-950/60 border border-white/10 rounded-xl px-3 py-2 text-white focus:border-fuchsia-500 outline-none"
                    >
                        <option value="">— Selecciona un gimnasio —</option>
                        {eligibleGyms.map(g => (
                            <option key={g.gym_id} value={g.gym_id}>
                                {g.gym_name || g.organization_name || g.gym_id} · {g.gym_id.slice(0, 8)}…{g.license_count > 1 ? ` (${g.license_count} licencias)` : ''}
                            </option>
                        ))}
                    </select>
                    {eligibleGyms.length === 0 && (
                        <p className="text-xs text-amber-400/80 mt-2">No hay gimnasios disponibles para envío.</p>
                    )}
                </div>
                <ToolButton
                    onClick={() => handlePush('exercise')}
                    disabled={!targetGymId || pushingKind !== null}
                    icon={pushingKind === 'exercise' ? <Spinner /> : <Send size={16} />}
                    label="Enviar mis ejercicios"
                    sub="Sube mi biblioteca completa al gimnasio destino. Le aparecerá una notificación."
                    color="fuchsia"
                />
                <ToolButton
                    onClick={() => handlePush('customer')}
                    disabled={!targetGymId || pushingKind !== null}
                    icon={pushingKind === 'customer' ? <Spinner /> : <Send size={16} />}
                    label="Enviar mis clientes"
                    sub="Sube mi cartera de clientes al gimnasio destino. Add-only por email."
                    color="fuchsia"
                />
            </Section>

            {/* Modals */}
            <ImportDatasetModal
                isOpen={isImportExercisesOpen}
                onClose={() => setIsImportExercisesOpen(false)}
            />
            <ImportCustomersJsonModal
                isOpen={isImportCustomersOpen}
                onClose={() => setIsImportCustomersOpen(false)}
            />
        </div>
    );
}

function Section({ icon, title, description, children }) {
    return (
        <div className="bg-slate-900/40 border border-white/5 rounded-2xl p-6">
            <div className="flex items-start gap-3 mb-4">
                <div className="mt-0.5">{icon}</div>
                <div>
                    <h3 className="text-lg font-bold text-white">{title}</h3>
                    <p className="text-sm text-slate-400 mt-1 max-w-2xl">{description}</p>
                </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
                {children}
            </div>
        </div>
    );
}

function ToolButton({ onClick, icon, label, sub, color = 'emerald', disabled = false }) {
    const colors = {
        emerald: 'border-emerald-500/30 hover:border-emerald-500/60 hover:bg-emerald-500/5 text-emerald-400',
        amber: 'border-amber-500/30 hover:border-amber-500/60 hover:bg-amber-500/5 text-amber-400',
        blue: 'border-blue-500/30 hover:border-blue-500/60 hover:bg-blue-500/5 text-blue-400',
        fuchsia: 'border-fuchsia-500/30 hover:border-fuchsia-500/60 hover:bg-fuchsia-500/5 text-fuchsia-400',
    };
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            className={`text-left p-4 rounded-xl border transition-all bg-slate-950/40 ${colors[color]} disabled:opacity-40 disabled:cursor-not-allowed`}
        >
            <div className="flex items-center gap-2 font-bold mb-1">
                {icon}
                <span>{label}</span>
            </div>
            <div className="text-xs text-slate-400 leading-snug">{sub}</div>
        </button>
    );
}

function Spinner() {
    return <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />;
}
