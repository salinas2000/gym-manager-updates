import React, { useEffect, useMemo, useState } from 'react';
import { ClipboardList, ChevronDown, ChevronRight, Users } from 'lucide-react';
import LoadingSpinner from '../../components/ui/LoadingSpinner';

/**
 * Respuestas de la encuesta de TODOS los clientes, agrupadas por semana.
 *
 * Complementa la pestaña de la ficha individual: aquí el entrenador ve de una
 * pasada quién ha respondido esta semana y qué ha contestado cada uno, sin ir
 * cliente por cliente.
 */

function tramoSemana(weekStart) {
    if (!weekStart) return '';
    const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
        'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    const [y, m, d] = String(weekStart).slice(0, 10).split('-').map(Number);
    if (!y) return weekStart;
    const a = new Date(y, m - 1, d);
    const b = new Date(y, m - 1, d + 6);
    return a.getMonth() === b.getMonth()
        ? `${a.getDate()} – ${b.getDate()} de ${MESES[a.getMonth()]}`
        : `${a.getDate()} de ${MESES[a.getMonth()]} – ${b.getDate()} de ${MESES[b.getMonth()]}`;
}

/** Lunes de la semana en curso, en hora local. */
function semanaActual() {
    const x = new Date();
    const day = x.getDay();
    x.setDate(x.getDate() - (day === 0 ? 6 : day - 1));
    return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
}

function valorLegible(v) {
    if (v === null || v === undefined || v === '') return '—';
    if (Array.isArray(v)) return v.join(', ');
    if (typeof v === 'boolean') return v ? 'Sí' : 'No';
    return String(v);
}

export default function SurveyAnswers() {
    const [respuestas, setRespuestas] = useState([]);
    const [cargando, setCargando] = useState(true);
    const [abierta, setAbierta] = useState(semanaActual());

    useEffect(() => {
        let cancelado = false;
        window.api.cloud.getSurveyAnswers(null, null, 200)
            .then(res => { if (!cancelado) setRespuestas(res?.data || []); })
            .catch(() => { if (!cancelado) setRespuestas([]); })
            .finally(() => { if (!cancelado) setCargando(false); });
        return () => { cancelado = true; };
    }, []);

    // Agrupadas por semana, de la más reciente a la más antigua.
    const porSemana = useMemo(() => {
        const mapa = new Map();
        for (const r of respuestas) {
            const k = String(r.week_start).slice(0, 10);
            if (!mapa.has(k)) mapa.set(k, []);
            mapa.get(k).push(r);
        }
        return [...mapa.entries()].sort((a, b) => b[0].localeCompare(a[0]));
    }, [respuestas]);

    if (cargando) return <div className="flex justify-center py-10"><LoadingSpinner /></div>;

    if (respuestas.length === 0) {
        return (
            <div className="text-center py-12 text-slate-500">
                <ClipboardList size={40} className="mx-auto mb-3 opacity-40" />
                <p className="text-sm">Todavía no hay respuestas.</p>
                <p className="text-xs mt-1 text-slate-600">
                    Aparecerán aquí en cuanto tus clientes online rellenen la encuesta.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {porSemana.map(([semana, filas]) => {
                const esActual = semana === semanaActual();
                const desplegada = abierta === semana;
                return (
                    <div key={semana} className="rounded-xl border border-white/5 bg-slate-800/40 overflow-hidden">
                        <button
                            onClick={() => setAbierta(desplegada ? null : semana)}
                            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/[0.02] transition-colors text-left"
                        >
                            {desplegada ? <ChevronDown size={16} className="text-slate-500" /> : <ChevronRight size={16} className="text-slate-500" />}
                            <span className="font-bold text-white text-sm">{tramoSemana(semana)}</span>
                            {esActual && (
                                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                                    Esta semana
                                </span>
                            )}
                            <span className="ml-auto flex items-center gap-1.5 text-xs text-slate-400">
                                <Users size={13} />
                                {filas.length} {filas.length === 1 ? 'respuesta' : 'respuestas'}
                            </span>
                        </button>

                        {desplegada && (
                            <div className="px-4 pb-4 space-y-3 border-t border-white/5 pt-3">
                                {filas.map(r => {
                                    const preguntas = Array.isArray(r.question_snapshot) && r.question_snapshot.length
                                        ? r.question_snapshot
                                        : Object.keys(r.answers || {}).map(k => ({ local_id: k, label: `Pregunta ${k}` }));
                                    return (
                                        <div key={r.id} className="rounded-lg bg-slate-950/40 border border-white/5 p-3">
                                            <p className="text-sm font-bold text-blue-300 mb-2">
                                                {r.customer_name || `Cliente #${r.customer_local_id}`}
                                            </p>
                                            <div className="space-y-1.5">
                                                {preguntas.map(q => (
                                                    <div key={q.local_id} className="text-sm">
                                                        <span className="text-slate-500">{q.label}: </span>
                                                        <span className="text-white font-medium">
                                                            {valorLegible((r.answers || {})[String(q.local_id)])}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
