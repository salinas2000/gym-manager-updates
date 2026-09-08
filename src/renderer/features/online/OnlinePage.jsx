import React, { useEffect, useState } from 'react';
import {
    ClipboardList, Plus, Trash2, GripVertical, ArrowUp, ArrowDown,
    Info, CalendarClock, Lock, BookMarked, Check, Pencil, Send, X,
} from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { useNotifications } from '../../context/NotificationContext';
import { decidirAviso } from './reglasAviso';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import ConfirmationModal from '../../components/ui/ConfirmationModal';
import SurveyAnswers from './SurveyAnswers';
import { unwrap, unwrapList } from '../../lib/ipc';

/**
 * Encuesta semanal de los clientes online.
 *
 * El flujo es: primero se crean PLANTILLAS, y luego se publica la que toque.
 * Escribir y publicar son dos cosas distintas a propósito: así el entrenador
 * puede preparar y retocar encuestas sin que nada le llegue al cliente hasta
 * que lo diga expresamente.
 *
 * Y una regla que gobierna todo: la encuesta de ESTA semana no se toca. Hay
 * clientes que ya la han respondido; cambiarla dejaría media semana con una
 * versión y media con otra. Por eso publicar activa siempre para el lunes,
 * salvo la primera de todas, que entra al momento porque no hay nada que
 * proteger.
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
const etiquetaTipo = (t) => (TIPOS.find(x => x.id === t) || TIPOS[0]).label;

/** '2026-09-08' → '8 de septiembre'. */
function fechaBonita(iso) {
    if (!iso) return '';
    const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
        'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number);
    if (!y) return iso;
    return `${d} de ${MESES[m - 1]}`;
}

const normalizar = (q, i) => ({
    local_id: Number(q.local_id) || (Date.now() + i),
    label: q.label || '',
    type: q.type || 'text',
    options: Array.isArray(q.options) ? q.options : [],
    required: !!q.required,
});

function SubPestanas({ vista, setVista }) {
    return (
        <div className="flex gap-1 border-b border-white/10">
            {[['estado', 'Encuesta activa'], ['plantillas', 'Plantillas'], ['respuestas', 'Respuestas']].map(([v, label]) => (
                <button
                    key={v}
                    onClick={() => setVista(v)}
                    className={`-mb-px border-b-2 px-4 py-2 text-sm font-bold transition-colors ${vista === v
                        ? 'border-violet-500 text-white'
                        : 'border-transparent text-slate-500 hover:text-slate-300'}`}
                >
                    {label}
                </button>
            ))}
        </div>
    );
}

/** Lista de preguntas en solo lectura. */
function ListaPreguntas({ preguntas }) {
    return (
        <ol className="space-y-1.5">
            {preguntas.map((q, i) => (
                <li key={q.local_id} className="text-sm text-slate-400 flex gap-2">
                    <span className="text-slate-600 tabular-nums">{i + 1}.</span>
                    <span className="flex-1">{q.label}</span>
                    <span className="text-[11px] text-slate-600 shrink-0">{etiquetaTipo(q.type)}</span>
                </li>
            ))}
        </ol>
    );
}

/** Editor de una plantilla. Aquí se escribe; publicar es otra cosa. */
function EditorPlantilla({ inicial, onGuardar, onCancelar }) {
    const toast = useToast();
    const [nombre, setNombre] = useState(inicial?.name || '');
    const [preguntas, setPreguntas] = useState((inicial?.questions || []).map(normalizar));
    const [aBorrar, setABorrar] = useState({ isOpen: false, indice: -1, texto: '' });

    const actualizar = (i, campo, valor) =>
        setPreguntas(prev => prev.map((q, n) => (n === i ? { ...q, [campo]: valor } : q)));

    const mover = (i, delta) => setPreguntas(prev => {
        const j = i + delta;
        if (j < 0 || j >= prev.length) return prev;
        const arr = [...prev];
        [arr[i], arr[j]] = [arr[j], arr[i]];
        return arr;
    });

    const guardar = () => {
        if (!nombre.trim()) { toast.error('Ponle un nombre a la plantilla'); return; }
        if (preguntas.length === 0) { toast.error('Añade al menos una pregunta'); return; }
        if (preguntas.some(q => !q.label.trim())) {
            toast.error('Hay preguntas sin enunciado. Escríbelas o elimínalas.'); return;
        }
        if (preguntas.some(q => conOpciones(q.type) && q.options.filter(o => o.trim()).length < 2)) {
            toast.error('Las preguntas de opciones necesitan al menos dos.'); return;
        }
        onGuardar(nombre.trim(), preguntas.map(q => ({
            ...q,
            label: q.label.trim(),
            options: conOpciones(q.type) ? q.options.map(o => o.trim()).filter(Boolean) : null,
        })));
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-3">
                <input
                    type="text"
                    autoFocus
                    placeholder="Nombre de la plantilla (p. ej. Check-in básico)"
                    className="flex-1 glass-input text-white bg-slate-950/50 focus:border-violet-500"
                    value={nombre}
                    onChange={e => setNombre(e.target.value)}
                />
                <button onClick={onCancelar}
                    className="text-slate-500 hover:text-white transition-colors" title="Cancelar">
                    <X size={18} />
                </button>
            </div>

            {preguntas.length === 0 && (
                <div className="text-center py-8 text-slate-500">
                    <ClipboardList size={36} className="mx-auto mb-2 opacity-40" />
                    <p className="text-sm">Añade la primera pregunta.</p>
                </div>
            )}

            <div className="space-y-3">
                {preguntas.map((q, i) => (
                    <div key={q.local_id} className="rounded-xl border border-white/5 bg-slate-800/40 p-4">
                        <div className="flex items-start gap-3">
                            <div className="flex flex-col gap-1 pt-2 text-slate-600">
                                <GripVertical size={16} />
                                <button onClick={() => mover(i, -1)} disabled={i === 0}
                                    className="hover:text-violet-400 disabled:opacity-20" title="Subir">
                                    <ArrowUp size={14} />
                                </button>
                                <button onClick={() => mover(i, 1)} disabled={i === preguntas.length - 1}
                                    className="hover:text-violet-400 disabled:opacity-20" title="Bajar">
                                    <ArrowDown size={14} />
                                </button>
                            </div>

                            <div className="flex-1 space-y-3">
                                <input
                                    type="text"
                                    placeholder="Escribe la pregunta (p. ej. ¿Cómo te has sentido esta semana?)"
                                    className="w-full glass-input text-white bg-slate-950/50 focus:border-violet-500"
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

                            <button
                                onClick={() => setABorrar({ isOpen: true, indice: i, texto: q.label || 'esta pregunta' })}
                                className="text-slate-600 hover:text-red-400 transition-colors pt-2"
                                title="Eliminar pregunta">
                                <Trash2 size={16} />
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            <div className="flex items-center justify-between pt-2">
                <button onClick={() => setPreguntas(prev => [...prev, normalizar({ label: '', type: 'text' }, prev.length)])}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl border border-white/10 text-slate-300 hover:bg-slate-800 transition-colors text-sm font-bold">
                    <Plus size={16} /> Añadir pregunta
                </button>
                <button onClick={guardar}
                    className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-white px-6 py-2 rounded-xl font-bold transition-all">
                    <Check size={16} /> Guardar plantilla
                </button>
            </div>
            <p className="text-[11px] text-slate-600 text-right">
                Guardar la plantilla no la publica. Se publica desde la lista, con el botón de activar.
            </p>

            <ConfirmationModal
                isOpen={aBorrar.isOpen}
                title="Eliminar pregunta"
                type="danger"
                confirmText="Eliminar"
                onClose={() => setABorrar({ isOpen: false, indice: -1, texto: '' })}
                onConfirm={() => {
                    setPreguntas(prev => prev.filter((_, n) => n !== aBorrar.indice));
                    setABorrar({ isOpen: false, indice: -1, texto: '' });
                }}
            >
                ¿Seguro que quieres eliminar <span className="text-white font-medium">&quot;{aBorrar.texto}&quot;</span>?
            </ConfirmationModal>
        </div>
    );
}

export default function OnlinePage() {
    const toast = useToast();
    const { addNotification } = useNotifications();
    const [vista, setVista] = useState('estado');
    const [vigentes, setVigentes] = useState([]);
    const [pendientes, setPendientes] = useState([]);
    const [info, setInfo] = useState({
        aplicariaDesde: null, pendienteDesde: null, vigenteDesde: null,
        vigenteNombre: null, pendienteNombre: null, esPrimera: true,
    });
    const [plantillas, setPlantillas] = useState([]);
    const [cargando, setCargando] = useState(true);
    const [editando, setEditando] = useState(null);   // plantilla en edición, o {} para nueva
    const [confirmar, setConfirmar] = useState({ isOpen: false, tipo: null, plantilla: null });

    const cargar = async () => {
        const res = await window.api.cloud.getSurveyQuestions();
        const r = unwrap(res) || {};
        setVigentes((Array.isArray(r.vigente) ? r.vigente : []).map(normalizar));
        setPendientes(r.pendienteDesde ? unwrapList(res).map(normalizar) : []);
        setInfo({
            aplicariaDesde: r.aplicariaDesde || null,
            pendienteDesde: r.pendienteDesde || null,
            vigenteDesde: r.vigenteDesde || null,
            vigenteNombre: r.vigenteNombre || null,
            pendienteNombre: r.pendienteNombre || null,
            esPrimera: !!r.esPrimera,
        });
        const tpl = await window.api.cloud.getSurveyTemplates();
        setPlantillas(unwrapList(tpl));
    };

    useEffect(() => {
        let cancelado = false;
        cargar()
            .catch(() => { if (!cancelado) toast.error('No se pudo cargar'); })
            .finally(() => { if (!cancelado) setCargando(false); });
        return () => { cancelado = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const guardarPlantilla = async (nombre, preguntas) => {
        const res = await window.api.cloud.saveSurveyTemplate(
            null, nombre, preguntas, editando?.local_id || null
        );
        const r = unwrap(res) || {};
        if (!r.success) { toast.error(r.error || 'No se pudo guardar'); return; }
        toast.success(`Plantilla "${nombre}" guardada`);
        setEditando(null);
        await cargar();
    };

    /** Publica una plantilla: esta semana si es la primera, si no el lunes. */
    const publicar = async (p) => {
        setConfirmar({ isOpen: false, tipo: null, plantilla: null });
        const res = await window.api.cloud.saveSurveyQuestions(null, p.questions || [], p.name);
        const r = unwrap(res) || {};
        if (!r.success) { toast.error(r.error || 'No se pudo activar'); return; }
        toast.success(r.esPrimera
            ? `"${p.name}" activada. Tus clientes online ya la ven.`
            : `"${p.name}" se activará el lunes ${fechaBonita(r.desde)}.`);
        await cargar();
        setVista('estado');
    };

    const eliminarPlantilla = async (p) => {
        setConfirmar({ isOpen: false, tipo: null, plantilla: null });
        const res = await window.api.cloud.deleteSurveyTemplate(null, p.local_id);
        if ((unwrap(res) || {}).success) {
            toast.success('Plantilla eliminada');
            setPlantillas(prev => prev.filter(x => x.local_id !== p.local_id));
        } else toast.error('No se pudo eliminar');
    };

    if (cargando) return <div className="flex justify-center py-16"><LoadingSpinner /></div>;

    const esPrimera = info.esPrimera;
    // Jueves y viernes son el momento util para decidir la semana que viene:
    // el lunes ya es tarde y a principio de semana aun no sabe que cambiar.
    const diaHoy = new Date().getDay();
    const recordar = (diaHoy === 4 || diaHoy === 5) && vigentes.length > 0 && !info.pendienteDesde;

    return (
        <div className="p-6 space-y-4 h-full overflow-y-auto">
            <div>
                <h1 className="text-2xl font-bold text-white">Online</h1>
                <p className="text-sm text-slate-500">
                    Encuesta semanal de los clientes que entrenan por su cuenta.
                </p>
            </div>

            <SubPestanas vista={vista} setVista={setVista} />

            {vista === 'respuestas' && <SurveyAnswers />}

            {/* ── Estado: qué hay activo y qué entrará ── */}
            {vista === 'estado' && (
                <div className="space-y-4">
                    {recordar && (
                        <div className="rounded-xl border border-amber-500/25 bg-amber-500/[0.06] p-4 flex gap-3">
                            <CalendarClock size={18} className="text-amber-400 shrink-0 mt-0.5" />
                            <p className="text-sm text-slate-400">
                                Si quieres cambiar la encuesta de la semana que viene, activa otra
                                plantilla <strong>antes del domingo</strong>. Si no haces nada, tus
                                clientes seguirán con la de ahora.
                            </p>
                        </div>
                    )}
                    {vigentes.length === 0 ? (
                        <div className="rounded-xl border border-white/5 bg-slate-800/40 p-6 text-center">
                            <ClipboardList size={40} className="mx-auto mb-3 text-slate-700" />
                            <p className="text-sm font-bold text-slate-300">No hay ninguna encuesta activa</p>
                            <p className="text-xs text-slate-500 mt-1">
                                Crea una plantilla y publícala desde la pestaña <strong>Plantillas</strong>.
                            </p>
                            <button onClick={() => setVista('plantillas')}
                                className="mt-4 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-bold transition-colors">
                                Ir a plantillas
                            </button>
                        </div>
                    ) : (
                        <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/[0.06] p-4">
                            <div className="flex items-center gap-2 mb-3">
                                <Lock size={15} className="text-emerald-400" />
                                <p className="text-sm font-bold text-emerald-300">
                                    Activa esta semana
                                    {info.vigenteNombre ? `: ${info.vigenteNombre}` : ''}
                                </p>
                                <span className="text-[11px] text-slate-500 ml-auto">
                                    {info.vigenteDesde && info.vigenteDesde !== '2000-01-01'
                                        ? `desde el ${fechaBonita(info.vigenteDesde)}` : ''}
                                </span>
                            </div>
                            <ListaPreguntas preguntas={vigentes} />
                            <p className="mt-3 text-[11px] text-slate-500">
                                No se puede modificar: hay clientes que ya la han respondido esta semana.
                                Para cambiarla, publica otra plantilla y entrará el lunes.
                            </p>
                        </div>
                    )}

                    {/* Solo en desarrollo: el recordatorio real sale de jueves a
                        domingo, y esperar al jueves para ver como queda es absurdo. */}
                    {import.meta.env.DEV && (
                        <button
                            onClick={() => {
                                const jueves = new Date();
                                jueves.setDate(jueves.getDate() + ((4 - jueves.getDay() + 7) % 7 || 7));
                                const a = decidirAviso({
                                    hoy: jueves, clientesOnline: 1,
                                    hayVigente: vigentes.length > 0, hayPendiente: false,
                                });
                                if (!a) { toast.error('Con este estado no saldria ningun aviso'); return; }
                                addNotification({
                                    id: `${a.id}-demo`, type: 'info', title: a.title,
                                    message: a.message, priority: a.priority,
                                    actionLabel: 'IR A ONLINE', onAction: () => setVista('plantillas'),
                                });
                                toast.success('Aviso lanzado: abre la campana');
                            }}
                            className="text-[11px] text-slate-600 hover:text-slate-400 underline transition-colors">
                            [dev] ver el aviso que le saldrá el jueves
                        </button>
                    )}

                    {info.pendienteDesde && (
                        <div className="rounded-xl border border-amber-500/30 bg-amber-500/[0.07] p-4">
                            <div className="flex items-center gap-2 mb-3">
                                <CalendarClock size={15} className="text-amber-400" />
                                <p className="text-sm font-bold text-amber-300">
                                    Entrará el lunes {fechaBonita(info.pendienteDesde)}
                                    {info.pendienteNombre ? `: ${info.pendienteNombre}` : ''}
                                </p>
                            </div>
                            <ListaPreguntas preguntas={pendientes} />
                            <p className="mt-3 text-[11px] text-amber-200/70">
                                Puedes cambiarla publicando otra plantilla antes del domingo.
                            </p>
                        </div>
                    )}
                </div>
            )}

            {/* ── Plantillas: aquí se escribe y desde aquí se publica ── */}
            {vista === 'plantillas' && (
                editando ? (
                    <EditorPlantilla
                        inicial={editando.local_id ? editando : null}
                        onGuardar={guardarPlantilla}
                        onCancelar={() => setEditando(null)}
                    />
                ) : (
                    <div className="space-y-3">
                        <div className="rounded-xl border border-blue-500/20 bg-blue-500/[0.06] p-4 flex gap-3">
                            <Info size={18} className="text-blue-400 shrink-0 mt-0.5" />
                            <p className="text-sm text-slate-400">
                                Escribe aquí tus encuestas y guárdalas. Guardar <strong>no</strong> las
                                publica: cuando quieras que una llegue a tus clientes, dale a{' '}
                                <strong>{esPrimera ? 'Publicar ahora' : 'Activar'}</strong>.
                                {!esPrimera && ' Entrará el lunes, para no cambiarle la encuesta a quien ya la ha respondido esta semana.'}
                            </p>
                        </div>

                        <button onClick={() => setEditando({})}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold text-sm transition-colors">
                            <Plus size={16} /> Nueva plantilla
                        </button>

                        {plantillas.length === 0 ? (
                            <div className="text-center py-10 text-slate-500">
                                <BookMarked size={36} className="mx-auto mb-3 opacity-40" />
                                <p className="text-sm">Todavía no has creado ninguna.</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {plantillas.map(p => {
                                    const activa = info.vigenteNombre === p.name;
                                    const programada = info.pendienteNombre === p.name;
                                    return (
                                        <div key={p.local_id}
                                            className={`flex items-center gap-3 rounded-xl border p-4 ${activa
                                                ? 'border-emerald-500/30 bg-emerald-500/[0.05]'
                                                : programada
                                                    ? 'border-amber-500/30 bg-amber-500/[0.05]'
                                                    : 'border-white/5 bg-slate-800/40'}`}>
                                            <BookMarked size={16} className={activa ? 'text-emerald-400' : programada ? 'text-amber-400' : 'text-violet-400'} />
                                            <div className="min-w-0 flex-1">
                                                <p className="font-bold text-white text-sm truncate flex items-center gap-2">
                                                    {p.name}
                                                    {activa && (
                                                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                                                            Activa
                                                        </span>
                                                    )}
                                                    {programada && (
                                                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30">
                                                            El lunes
                                                        </span>
                                                    )}
                                                </p>
                                                <p className="text-[11px] text-slate-500">
                                                    {(p.questions || []).length} pregunta{(p.questions || []).length === 1 ? '' : 's'}
                                                </p>
                                            </div>

                                            <button onClick={() => setEditando(p)}
                                                className="text-slate-500 hover:text-white transition-colors p-1.5" title="Editar">
                                                <Pencil size={15} />
                                            </button>

                                            {/* La programada ya está puesta para el lunes: no hay nada
                                                que activar. La activa sí lleva botón, porque si la retocas
                                                tienes que poder mandar la versión nueva al lunes. */}
                                            {!programada && (
                                                <button
                                                    onClick={() => setConfirmar({ isOpen: true, tipo: 'publicar', plantilla: p })}
                                                    title={activa ? 'Manda la versión actual de esta plantilla al lunes que viene' : undefined}
                                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors shrink-0 ${activa
                                                        ? 'border border-white/10 text-slate-300 hover:bg-slate-700'
                                                        : 'bg-violet-600 hover:bg-violet-500 text-white'}`}>
                                                    <Send size={13} />
                                                    {esPrimera ? 'Publicar ahora' : activa ? 'Republicar' : 'Activar'}
                                                </button>
                                            )}

                                            <button
                                                onClick={() => setConfirmar({ isOpen: true, tipo: 'borrar', plantilla: p })}
                                                className="text-slate-600 hover:text-red-400 transition-colors p-1.5" title="Eliminar">
                                                <Trash2 size={15} />
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )
            )}

            <ConfirmationModal
                isOpen={confirmar.isOpen}
                title={confirmar.tipo === 'borrar' ? 'Eliminar plantilla'
                    : esPrimera ? 'Publicar encuesta' : 'Activar para el lunes'}
                type={confirmar.tipo === 'borrar' ? 'danger' : 'info'}
                confirmText={confirmar.tipo === 'borrar' ? 'Eliminar'
                    : esPrimera ? 'Publicar ahora' : 'Activar'}
                onClose={() => setConfirmar({ isOpen: false, tipo: null, plantilla: null })}
                onConfirm={() => confirmar.tipo === 'borrar'
                    ? eliminarPlantilla(confirmar.plantilla)
                    : publicar(confirmar.plantilla)}
            >
                {confirmar.tipo === 'borrar' ? (
                    <>¿Seguro que quieres eliminar <span className="text-white font-medium">
                        &quot;{confirmar.plantilla?.name}&quot;</span>? Las respuestas ya enviadas se conservan.</>
                ) : esPrimera ? (
                    <>Se publicará <span className="text-white font-medium">&quot;{confirmar.plantilla?.name}&quot;</span> y
                        tus clientes online la verán <span className="text-white font-medium">de inmediato</span>.</>
                ) : (
                    <>Se activará <span className="text-white font-medium">&quot;{confirmar.plantilla?.name}&quot;</span> el{' '}
                        <span className="text-white font-medium">lunes {fechaBonita(info.aplicariaDesde)}</span>.
                        Esta semana tus clientes siguen con la que está activa, para no cambiársela a quien ya la ha respondido.</>
                )}
            </ConfirmationModal>
        </div>
    );
}
