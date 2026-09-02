import { useEffect } from 'react';
import { useNotifications } from '../../context/NotificationContext';
import { unwrap } from '../../lib/ipc';
import { decidirAviso } from './reglasAviso';

/**
 * Engancha el aviso de la encuesta al centro de notificaciones.
 *
 * No pinta nada: solo mira el estado al abrir la app y una vez por hora (por
 * si la deja abierta y cambia el día, que es lo normal en un gimnasio), y
 * suelta la notificación cuando toca.
 *
 * Lo que decide si avisar está en avisoEncuesta.js, aparte y sin fechas
 * propias, para poder probarlo sin esperar al jueves.
 */
export default function AvisoEncuesta({ onNavigate }) {
    const { addNotification } = useNotifications();

    useEffect(() => {
        let cancelado = false;

        const comprobar = async () => {
            try {
                // Si el plan no lleva app móvil, no hay clientes online que valgan.
                const lic = unwrap(await window.api.license.getData());
                const features = lic?.data?.features || lic?.features || {};
                if (features.mobile_app === false) return;

                const clientes = unwrap(await window.api.customers.getAll());
                const lista = Array.isArray(clientes?.data) ? clientes.data
                    : Array.isArray(clientes) ? clientes : [];
                // Online = tiene el horario oculto (es la marca que usa la app).
                const clientesOnline = lista.filter(c =>
                    c.is_active !== 0 && Number(c.mobile_show_schedule) === 0).length;

                const enc = unwrap(await window.api.cloud.getSurveyQuestions()) || {};
                const aviso = decidirAviso({
                    hoy: new Date(),
                    clientesOnline,
                    hayVigente: Array.isArray(enc.vigente) && enc.vigente.length > 0,
                    hayPendiente: !!enc.pendienteDesde,
                });
                if (!aviso || cancelado) return;

                // Un aviso al dia como mucho. Sin esto, cada vez que abriera la
                // app volveria a salir el mismo que acaba de descartar; y al
                // llevar la fecha, si no hace nada el jueves le insiste el
                // viernes, que es justo lo que se queria.
                const clave = `avisoEncuesta:${aviso.id}`;
                const hoyStr = new Date().toDateString();
                try {
                    if (localStorage.getItem(clave) === hoyStr) return;
                    localStorage.setItem(clave, hoyStr);
                } catch { /* sin localStorage, avisar de mas es mejor que de menos */ }

                addNotification({
                    id: aviso.id,                 // por semana: no se repite al reabrir
                    type: 'info',
                    title: aviso.title,
                    message: aviso.message,
                    priority: aviso.priority,
                    actionLabel: 'IR A ONLINE',
                    onAction: () => onNavigate?.('online'),
                });
            } catch {
                // Un aviso que falla no puede molestar: si no se puede mirar
                // (sin red, licencia caida), simplemente no se avisa.
            }
        };

        comprobar();
        const t = setInterval(comprobar, 60 * 60 * 1000);

        // En desarrollo se puede forzar desde la consola para verlo sin
        // esperar al jueves:  __probarAvisoEncuesta()
        if (import.meta.env.DEV) {
            window.__probarAvisoEncuesta = (dia) => {
                const hoy = new Date();
                if (typeof dia === 'number') hoy.setDate(hoy.getDate() + ((dia - hoy.getDay() + 7) % 7));
                const aviso = decidirAviso({ hoy, clientesOnline: 1, hayVigente: true, hayPendiente: false })
                    || decidirAviso({ hoy, clientesOnline: 1, hayVigente: false, hayPendiente: false });
                if (aviso) {
                    addNotification({
                        id: `${aviso.id}-demo`, type: 'update', title: aviso.title,
                        message: aviso.message, priority: aviso.priority,
                        actionLabel: 'IR A ONLINE', onAction: () => onNavigate?.('online'),
                    });
                }
                return aviso;
            };
        }

        return () => { cancelado = true; clearInterval(t); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return null;
}
