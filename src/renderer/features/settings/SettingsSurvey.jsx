import React, { useEffect, useState } from 'react';
import { ClipboardList, Plus, Trash2, Save, GripVertical, ArrowUp, ArrowDown, Info, CalendarClock } from 'lucide-react';
import { useGym } from '../../context/GymContext';
import { useToast } from '../../context/ToastContext';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import ConfirmationModal from '../../components/ui/ConfirmationModal';
import SurveyAnswers from './SurveyAnswers';

/**
 * Constructor de la encuesta semanal.
 *
 * El entrenador escribe aquí las preguntas y los clientes ONLINE (los que
 * tienen el horario oculto) las responden en la app una vez por semana.
 * Al enviarla, no vuelve a aparecerles hasta el lunes siguiente.
 *
 * Las preguntas viven solo en la nube: no tocan la base local ni la
 * sincronización.
 */

const TIPOS = [
    { id: 'text', label: 'Texto corto' },
    { id: 'textarea', label: 'Texto largo' },
    { id: 'number', label: 'Número' },
    { id: 'boolean', label: 'Sí / No' },
    { id: 'single', label: 'Una opción' },
    { id: 'multi', label: 'Varias opciones' },
];

const conOpciones = (t) => t === 'single' || t === 'multi';

/** '2026-09-08' → '8 de septiembre'. */
function fechaBonita(iso) {
    if (!iso) return '';
    const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
        'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number);
    if (!y) return iso;
    return `${d} de ${MESES[m - 1]}`;
}

/**
 * De jueves a domingo se recuerda que lo que se cambie ahora entra el lunes.
 * Es el momento util: a principios de semana no toca, y el lunes ya es tarde
 * para la semana que empieza.
 */
function esFinDeSemanaLaboral() {
    const d = new Date().getDay();      // 0 = domingo, 4 = jueves
    return d === 4 || d === 5 || d === 6 || d === 0;
}

function SubPestanas({ vista, setVista }) {
    return (
        <div className="flex gap-1 border-b border-white/10">
            {[['preguntas', 'Preguntas'], ['respuestas', 'Respuestas']].map(([v, label]) => (
                <button
                    key={v}
                    onClick={() => setVista(v)}
                    className={`-mb-px border-b-2 px-4 py-2 text-sm font-bold transition-colors ${vista === v
                        ? 'border-blue-500 text-white'
                        : 'border-transparent text-slate-500 hover:text-slate-300'}`}
                >
                    {label}
                </button>
            ))}
        </div>
    );
}

export default function SettingsSurvey() {
    const { settings } = useGym();
    const toast = useToast();
    const [preguntas, setPreguntas] = useState([]);
    const [cargando, setCargando] = useState(true);
    const [guardando, setGuardando] = useState(false);
    // 'preguntas' = escribir la encuesta | 'respuestas' = lo que han contestado
    const [vista, setVista] = useState('preguntas');
    // Desde que lunes aplicaria lo que se guarde ahora, y si hay un cambio
    // pendiente de entrar.
    const [vigencia, setVigencia] = useState({ aplicariaDesde: null, pendienteDesde: null, esPrimera: true });

    useEffect(() => {
        let cancelado = false;
        window.api.cloud.getSurveyQuestions()
            .then(res => {
                if (cancelado) return;
                const filas = (res?.data || []).map(q => ({
                    local_id: Number(q.local_id),
                    label: q.label || '',
                    type: q.type || 'text',
                    options: Array.isArray(q.options) ? q.options : [],
                    required: !!q.required,
                }));
                setPreguntas(filas);
                setVigencia({
                    aplicariaDesde: res?.aplicariaDesde || null,
                    pendienteDesde: res?.pendienteDesde || null,
                    esPrimera: !!res?.esPrimera,
                });
            })
            .catch(() => { if (!cancelado) setPreguntas([]); })
            .finally(() => { if (!cancelado) setCargando(false); });
        return () => { cancelado = true; };
    }, []);

    const actualizar = (i, campo, valor) =>
        setPreguntas(prev => prev.map((q, n) => (n === i ? { ...q, [campo]: valor } : q)));

    const anadir = () =>
        setPreguntas(prev => [...prev, {
            local_id: Date.now() + prev.length,
            label: '', type: 'text', options: [], required: false,
        }]);

    // Se confirma con el modal de la aplicación, no con un diálogo del sistema.
    const [confirmar, setConfirmar] = useState({ isOpen: false, indice: -1, texto: '' });

    const pedirQuitar = (i) =>
        setConfirmar({ isOpen: true, indice: i, texto: preguntas[i]?.label || 'esta pregunta' });

    const quitarConfirmado = () => {
        setPreguntas(prev => prev.filter((_, n) => n !== confirmar.indice));
        setConfirmar({ isOpen: false, indice: -1, texto: '' });
    };

    const mover = (i, delta) => setPreguntas(prev => {
        const j = i + delta;
        if (j < 0 || j >= prev.length) return prev;
        const arr = [...prev];
        [arr[i], arr[j]] = [arr[j], arr[i]];
        return arr;
    });

    const guardar = async () => {
        const vacias = preguntas.filter(q => !q.label.trim());
        if (vacias.length > 0) {
            toast.error('Hay preguntas sin enunciado. Escríbelas o elimínalas.');
            return;
        }
        const sinOpciones = preguntas.filter(q => conOpciones(q.type) && q.options.filter(o => o.trim()).length < 2);
        if (sinOpciones.length > 0) {
            toast.error('Las preguntas de opciones necesitan al menos dos.');
            return;
        }
        setGuardando(true);
        const res = await window.api.cloud.saveSurveyQuestions(
            null,
            preguntas.map(q => ({
                ...q,
                label: q.label.trim(),
                options: conOpciones(q.type) ? q.options.map(o => o.trim()).filter(Boolean) : null,
            }))
        );
        setGuardando(false);
        if (res?.success) {
            toast.success(res.esPrimera
                ? 'Encuesta guardada. Tus clientes online ya la ven.'
                : `Guardada. Entrará en vigor el lunes ${fechaBonita(res.desde)}; esta semana siguen con la anterior.`);
            setVigencia(v => ({ ...v, pendienteDesde: res.esPrimera ? null : res.desde, esPrimera: false }));
        }
        else toast.error(res?.error || 'No se pudo guardar');
    };

    if (cargando) {
        return <div className="flex justify-center py-10"><LoadingSpinner /></div>;
    }

    if (vista === 'respuestas') {
        return (
            <div className="space-y-4">
                <SubPestanas vista={vista} setVista={setVista} />
                <SurveyAnswers />
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <SubPestanas vista={vista} setVista={setVista} />

            {/* Cambio ya programado para el lunes. */}
            {vigencia.pendienteDesde && (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/[0.07] p-4 flex gap-3">
                    <CalendarClock size={18} className="text-amber-400 shrink-0 mt-0.5" />
                    <div className="text-sm">
                        <p className="font-bold text-amber-300">
                            Cambio programado para el {fechaBonita(vigencia.pendienteDesde)}
                        </p>
                        <p className="text-amber-200/80 mt-0.5">
                            Estás editando la encuesta que entrará ese lunes. Esta semana tus clientes
                            siguen viendo la anterior, para que todos respondan lo mismo.
                        </p>
                    </div>
                </div>
            )}

            {/* Recordatorio de jueves a domingo: es cuando toca prepararla. */}
            {!vigencia.pendienteDesde && !vigencia.esPrimera && esFinDeSemanaLaboral() && (
                <div className="rounded-xl border border-violet-500/30 bg-violet-500/[0.07] p-4 flex gap-3">
                    <CalendarClock size={18} className="text-violet-400 shrink-0 mt-0.5" />
                    <div className="text-sm">
                        <p className="font-bold text-violet-300">¿Cambias la encuesta para la semana que viene?</p>
                        <p className="text-violet-200/80 mt-0.5">
                            Lo que guardes ahora entrará el lunes {fechaBonita(vigencia.aplicariaDesde)}.
                            Si no tocas nada, tus clientes seguirán con las mismas preguntas.
                        </p>
                    </div>
                </div>
            )}

            <div className="rounded-xl border border-blue-500/20 bg-blue-500/[0.06] p-4 flex gap-3">
                <Info size={18} className="text-blue-400 shrink-0 mt-0.5" />
                <div className="text-sm text-slate-300">
                    <p className="font-bold text-blue-300 mb-1">Encuesta semanal para clientes online</p>
                    <p className="text-slate-400">
                        La ven <strong>solo tus clientes online</strong>, en el sitio donde los demás tienen
                        el horario. La responden <strong>una vez por semana</strong>: al enviarla no les
                        vuelve a aparecer hasta el lunes. Sus respuestas están en la pestaña{' '}
                        <strong>Respuestas</strong> y en la ficha de cada cliente.
                        {!vigencia.esPrimera && (
                            <> Los cambios que hagas <strong>entran en vigor el lunes</strong>, nunca a mitad
                            de semana.</>
                        )}
                    </p>
                </div>
            </div>

            {preguntas.length === 0 && (
                <div className="text-center py-10 text-slate-500">
                    <ClipboardList size={40} className="mx-auto mb-3 opacity-40" />
                    <p className="text-sm">Aún no has creado ninguna pregunta.</p>
                </div>
            )}

            <div className="space-y-3">
                {preguntas.map((q, i) => (
                    <div key={q.local_id} className="rounded-xl border border-white/5 bg-slate-800/40 p-4">
                        <div className="flex items-start gap-3">
                            <div className="flex flex-col gap-1 pt-2 text-slate-600">
                                <GripVertical size={16} />
                                <button onClick={() => mover(i, -1)} disabled={i === 0}
                                    className="hover:text-blue-400 disabled:opacity-20" title="Subir">
                                    <ArrowUp size={14} />
                                </button>
                                <button onClick={() => mover(i, 1)} disabled={i === preguntas.length - 1}
                                    className="hover:text-blue-400 disabled:opacity-20" title="Bajar">
                                    <ArrowDown size={14} />
                                </button>
                            </div>

                            <div className="flex-1 space-y-3">
                                <input
                                    type="text"
                                    placeholder="Escribe la pregunta (p. ej. ¿Cómo te has sentido esta semana?)"
                                    className="w-full glass-input text-white bg-slate-950/50 focus:border-blue-500"
                                    value={q.label}
                                    onChange={e => actualizar(i, 'label', e.target.value)}
                                />

                                <div className="flex flex-wrap items-center gap-3">
                                    <select
                                        className="glass-input text-white bg-slate-950/50 text-sm py-1.5"
                                        value={q.type}
                                        onChange={e => actualizar(i, 'type', e.target.value)}
                                    >
                                        {TIPOS.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                                    </select>

                                    <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
                                        <input type="checkbox" checked={q.required}
                                            onChange={e => actualizar(i, 'required', e.target.checked)} />
                                        Obligatoria
                                    </label>
                                </div>

                                {conOpciones(q.type) && (
                                    <div>
                                        <label className="text-[11px] uppercase font-bold text-slate-500">
                                            Opciones (una por línea)
                                        </label>
                                        <textarea
                                            rows={3}
                                            placeholder={'Alta\nMedia\nBaja'}
                                            className="mt-1 w-full glass-input text-white bg-slate-950/50 text-sm resize-none"
                                            value={(q.options || []).join('\n')}
                                            onChange={e => actualizar(i, 'options', e.target.value.split('\n'))}
                                        />
                                    </div>
                                )}
                            </div>

                            <button onClick={() => pedirQuitar(i)}
                                className="text-slate-600 hover:text-red-400 transition-colors pt-2"
                                title="Eliminar pregunta">
                                <Trash2 size={16} />
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            <div className="flex items-center justify-between pt-2">
                <button onClick={anadir}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl border border-white/10 text-slate-300 hover:bg-slate-800 transition-colors text-sm font-bold">
                    <Plus size={16} /> Añadir pregunta
                </button>

                <button onClick={guardar} disabled={guardando}
                    className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2 rounded-xl font-bold transition-all disabled:opacity-50">
                    {guardando ? <LoadingSpinner size="sm" color="white" /> : <><Save size={16} /> Guardar encuesta</>}
                </button>
            </div>

            <ConfirmationModal
                isOpen={confirmar.isOpen}
                title="Eliminar pregunta"
                type="danger"
                confirmText="Eliminar"
                onClose={() => setConfirmar({ isOpen: false, indice: -1, texto: '' })}
                onConfirm={quitarConfirmado}
            >
                ¿Seguro que quieres eliminar <span className="text-white font-medium">
                    &quot;{confirmar.texto}&quot;
                </span>? Las respuestas ya enviadas se conservan: cada una guarda el
                enunciado tal como estaba al responderla.
            </ConfirmationModal>
        </div>
    );
}
