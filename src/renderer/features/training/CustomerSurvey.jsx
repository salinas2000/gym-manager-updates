import React, { useEffect, useState } from 'react';
import { ClipboardList, Calendar } from 'lucide-react';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { unwrapList } from '../../lib/ipc';

/**
 * Respuestas de la encuesta semanal de un cliente.
 *
 * Viven solo en la nube (el móvil las escribe, aquí se leen), así que esto no
 * toca la base local. Cada respuesta guarda el enunciado de las preguntas tal
 * como estaban al enviarla, de modo que sigue entendiéndose aunque después se
 * reescriban o se borren.
 */

/** "1 – 7 de septiembre" a partir del lunes de la semana. */
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

function valorLegible(v) {
    if (v === null || v === undefined || v === '') return '—';
    if (Array.isArray(v)) return v.join(', ');
    if (typeof v === 'boolean') return v ? 'Sí' : 'No';
    return String(v);
}

export default function CustomerSurvey({ customerId }) {
    const [respuestas, setRespuestas] = useState([]);
    const [cargando, setCargando] = useState(true);

    useEffect(() => {
        if (!customerId) return;
        let cancelado = false;
        setCargando(true);
        window.api.cloud.getSurveyAnswers(null, customerId, 20)
            .then(res => { if (!cancelado) setRespuestas(unwrapList(res)); })
            .catch(() => { if (!cancelado) setRespuestas([]); })
            .finally(() => { if (!cancelado) setCargando(false); });
        return () => { cancelado = true; };
    }, [customerId]);

    if (cargando) return <div className="flex justify-center py-10"><LoadingSpinner /></div>;

    if (respuestas.length === 0) {
        return (
            <div className="text-center py-12 text-slate-500">
                <ClipboardList size={40} className="mx-auto mb-3 opacity-40" />
                <p className="text-sm">Este cliente aún no ha respondido ninguna encuesta.</p>
                <p className="text-xs mt-1 text-slate-600">
                    La ven solo los clientes con el horario oculto, y se responde una vez por semana.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {respuestas.map(r => {
                // El enunciado guardado en el envío manda; si no lo hubiera, se
                // muestra al menos el identificador para no perder el dato.
                const preguntas = Array.isArray(r.question_snapshot) && r.question_snapshot.length
                    ? r.question_snapshot
                    : Object.keys(r.answers || {}).map(k => ({ local_id: k, label: `Pregunta ${k}` }));

                return (
                    <div key={r.id} className="rounded-xl border border-white/5 bg-slate-800/40 p-4">
                        <div className="flex items-center gap-2 mb-3 pb-2 border-b border-white/5">
                            <Calendar size={14} className="text-blue-400" />
                            <span className="text-sm font-bold text-white">{tramoSemana(r.week_start)}</span>
                            <span className="text-[11px] text-slate-500 ml-auto">
                                {r.submitted_at ? new Date(r.submitted_at).toLocaleDateString('es-ES') : ''}
                            </span>
                        </div>
                        <div className="space-y-2">
                            {preguntas.map(q => (
                                <div key={q.local_id} className="text-sm">
                                    <p className="text-slate-400">{q.label}</p>
                                    <p className="text-white font-medium">
                                        {valorLegible((r.answers || {})[String(q.local_id)])}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
