/**
 * Documentación de usuario, organizada por módulo.
 *
 * Es la ÚNICA fuente del contenido del centro de ayuda. Para editar la
 * documentación, cambia el texto aquí — la página de Ayuda (HelpPage.jsx) lo
 * renderiza automáticamente.
 *
 * Estructura de cada módulo:
 *   { key, title, icon, intro, sections: [{ heading, body?, steps?, tip? }] }
 *   - body:  uno o varios párrafos (string o array de strings)
 *   - steps: lista numerada de pasos
 *   - tip:   consejo destacado al final de la sección
 */

import {
    LayoutDashboard, Users, CalendarDays, UserCog, Package,
    CreditCard, Settings, Dumbbell, BookOpen, Clock, Smartphone, Bell,
} from 'lucide-react';

export const HELP_MODULES = [
    {
        key: 'dashboard',
        title: 'Panel / Estadísticas',
        icon: LayoutDashboard,
        intro: 'El panel principal te da una visión rápida del estado del gimnasio: ingresos, clientes activos, pagos pendientes y la evolución del mes.',
        sections: [
            {
                heading: '¿Qué veo aquí?',
                body: 'Tarjetas con los números clave (clientes activos, ingresos del mes, altas recientes) y gráficas de evolución. Es solo lectura: para gestionar cada cosa, entra en su módulo correspondiente.',
            },
            {
                heading: 'Consejo de uso diario',
                body: 'Abre el panel al empezar la jornada para detectar de un vistazo pagos vencidos o caídas de actividad.',
                tip: 'Los números se actualizan a medida que registras pagos y altas en el resto de módulos.',
            },
        ],
    },
    {
        key: 'customers',
        title: 'Clientes',
        icon: Users,
        intro: 'Aquí gestionas la ficha de cada cliente: datos personales, tarifa, ficha médica, acceso a la app móvil y su evolución.',
        sections: [
            {
                heading: 'Crear un cliente',
                steps: [
                    'Pulsa "Nuevo Cliente".',
                    'Rellena nombre, apellidos y los datos de contacto.',
                    'Asigna una tarifa (define la cuota y cada cuánto paga).',
                    'Opcional: completa altura, peso, fecha de nacimiento y ficha médica (enfermedades, lesiones, alergías, cirugías).',
                    'Guarda. El cliente queda activo y empieza a contar su periodo de pago.',
                ],
                tip: 'El email es necesario si luego quieres invitarle a la app móvil.',
            },
            {
                heading: 'Editar y dar de baja',
                body: 'Entra en la ficha del cliente para modificar cualquier dato. Cambiar la tarifa afecta a los próximos cobros, no a los ya registrados. Un cliente inactivo deja de contar en estadísticas pero conserva su historial.',
            },
            {
                heading: 'Dar acceso a la app móvil',
                body: 'Desde la ficha del cliente, pestaña "App Móvil", pulsa invitar. El cliente recibe un email para crear su contraseña y entrar. Desde ahí ve sus rutinas, pagos, clases y puede apuntarse a actividades.',
                tip: 'Si el cliente ya tenía cuenta en otro gimnasio con ese mismo email, se le da acceso al tuyo automáticamente sin reenviar invitación.',
            },
            {
                heading: 'Ficha médica',
                body: 'Los datos médicos son privados y sirven para que el entrenador adapte el trabajo. El cliente puede consultarlos desde su app.',
            },
        ],
    },
    {
        key: 'classes',
        title: 'Clases y Horarios',
        icon: CalendarDays,
        intro: 'Configura el horario del gimnasio y las clases grupales (spinning, yoga…). Los clientes reservan plaza desde la app y tú ves quién viene.',
        sections: [
            {
                heading: 'Las tres pestañas',
                body: [
                    '• Gimnasio: el horario de apertura con aforo por franja. Pulsa "Configurar horario" para definir días y horas.',
                    '• Clases: el calendario semanal de tus clases grupales. Arrastra una clase para moverla de día u hora.',
                    '• Gestión de Clases: crea, edita y borra las clases y sus horarios.',
                ],
            },
            {
                heading: 'Crear una clase',
                steps: [
                    'Ve a "Nueva Clase" (o pestaña Gestión de Clases).',
                    'Pon nombre, instructor, aforo máximo, duración y color.',
                    'Añade los horarios semanales (día + hora).',
                    'Guarda. La clase aparece en el calendario y en la app del cliente.',
                ],
            },
            {
                heading: 'Ver quién se ha apuntado',
                body: 'Pulsa cualquier franja del calendario para ver la lista de personas reservadas, con su contacto. El botón "Hoy en detalle" (pestaña Gimnasio) te muestra todas las franjas de hoy con su ocupación.',
                tip: 'Las reservas llegan en tiempo real: cuando un cliente se apunta o cancela desde el móvil, lo ves al instante.',
            },
            {
                heading: 'Eventos puntuales',
                body: 'Para una clase de un día concreto (no recurrente), crea un evento esporádico con su fecha, hora y aforo propios.',
            },
        ],
    },
    {
        key: 'trainers',
        title: 'Entrenadores',
        icon: UserCog,
        intro: 'Da de alta a tus monitores, asígnales un color y define sus turnos. Los clientes ven en el horario qué monitor está de guardia.',
        sections: [
            {
                heading: 'Crear un entrenador',
                steps: [
                    'Pulsa "Nuevo Entrenador".',
                    'Pon su nombre y elige un color (lo identificará en el horario).',
                    'Opcional: teléfono y email.',
                    'Define sus turnos semanales (día + franja horaria).',
                ],
                tip: 'El color que elijas aquí es el que verá el cliente en la app, junto a cada franja en la que ese monitor trabaja.',
            },
        ],
    },
    {
        key: 'inventory',
        title: 'Almacén / Stock',
        icon: Package,
        intro: 'Controla el material y productos del gimnasio: existencias, entradas y salidas.',
        sections: [
            {
                heading: 'Gestionar productos',
                steps: [
                    'Crea un producto con su nombre y stock inicial.',
                    'Registra movimientos: compra (suma stock), venta o ajuste (corrección manual).',
                    'El stock se recalcula solo con cada movimiento.',
                ],
            },
        ],
    },
    {
        key: 'finance',
        title: 'Gestión de Pagos',
        icon: CreditCard,
        intro: 'Registra los cobros de tus clientes y lleva el control de quién está al día y quién debe.',
        sections: [
            {
                heading: 'Registrar un pago',
                steps: [
                    'Busca al cliente y pulsa registrar pago.',
                    'Confirma el importe (viene de su tarifa) y el método.',
                    'Si paga varios meses de golpe, indícalo: se registran todos y se extiende su vencimiento.',
                    'Guarda. La fecha de próximo pago se actualiza automáticamente.',
                ],
                tip: 'El cliente recibe un aviso en la app cuando le quedan pocos días para pagar.',
            },
            {
                heading: 'Ver morosos',
                body: 'Los clientes con pago vencido aparecen destacados. Desde aquí puedes registrar el cobro pendiente en un par de clics.',
            },
        ],
    },
    {
        key: 'tariffs',
        title: 'Gestión de Tarifas',
        icon: Settings,
        intro: 'Define las cuotas que asignas a los clientes: importe, periodicidad y color.',
        sections: [
            {
                heading: 'Crear una tarifa',
                steps: [
                    'Pulsa "Nueva Tarifa".',
                    'Pon nombre e importe.',
                    'Elige la periodicidad: mensual, trimestral, semestral o anual.',
                    'Indica si el importe es por mes o el total del periodo.',
                    'Asigna un color para distinguirla de un vistazo.',
                ],
                tip: 'Cambiar una tarifa afecta a los cobros futuros de los clientes que la tengan, nunca a los pagos ya registrados.',
            },
        ],
    },
    {
        key: 'training',
        title: 'Centro de Entrenamiento',
        icon: Dumbbell,
        intro: 'Crea los planes de entrenamiento (mesociclos) de cada cliente: rutinas por día, ejercicios y la prescripción de cada serie.',
        sections: [
            {
                heading: 'Crear un mesociclo',
                steps: [
                    'Elige el cliente y crea un mesociclo (un bloque de entrenamiento con fecha de inicio y fin).',
                    'Añade las rutinas/días (ej. Día 1 Empuje, Día 2 Tirón).',
                    'En cada día, añade ejercicios desde la Biblioteca.',
                    'Prescribe cada ejercicio: series y los campos que correspondan a su tipo (peso/reps en fuerza, tiempo/distancia en cardio…).',
                    'Guarda. El cliente lo ve al instante en su app.',
                ],
                tip: 'Si editas un mesociclo ya empezado, los registros que el cliente ya hizo se conservan.',
            },
            {
                heading: 'Plantillas reutilizables',
                body: 'Puedes guardar un mesociclo como plantilla para reutilizarlo con otros clientes sin volver a montarlo desde cero.',
            },
            {
                heading: 'Prioridades',
                body: 'La vista de Prioridades te ayuda a ver qué clientes necesitan una rutina nueva o una revisión, para no dejar a nadie sin plan.',
            },
        ],
    },
    {
        key: 'library',
        title: 'Biblioteca de Ejercicios',
        icon: BookOpen,
        intro: 'El catálogo de ejercicios del gimnasio, organizados por categoría. Aquí defines cómo se registra cada ejercicio y qué campos rellena el cliente.',
        sections: [
            {
                heading: 'Crear un ejercicio',
                steps: [
                    'Pulsa "Nuevo Ejercicio".',
                    'Pon nombre y categoría.',
                    'Elige el "Tipo de registro" — define qué mide el ejercicio (ver abajo).',
                    'Opcional: URL de vídeo y notas técnicas.',
                    'Define los valores objetivo por defecto si quieres.',
                ],
            },
            {
                heading: 'Tipo de registro (muy importante)',
                body: [
                    'Cada ejercicio declara cómo se mide, y eso decide qué campos ve el cliente al registrarlo en la app:',
                    '• Fuerza → peso × reps (press banca, sentadilla).',
                    '• Cardio distancia → tiempo + distancia, calcula el ritmo solo (correr, bici).',
                    '• Cardio tiempo → solo tiempo (elíptica).',
                    '• Isométrico → solo tiempo (plancha).',
                    '• Peso corporal → solo reps (dominadas, fondos).',
                    '• Personalizado → muestra todos los campos.',
                ],
                tip: 'Elige bien el tipo: así el cliente solo rellena lo que tiene sentido para ese ejercicio (en una carrera no le pedimos kilos).',
            },
            {
                heading: 'Campos rellenables',
                body: 'Cada campo (RPE, RIR, descanso, notas…) se puede activar o desactivar para todo el gimnasio. Los desactivados no aparecen ni al prescribir ni en la app. Por ejemplo, RPE y RIR vienen desactivados por defecto; actívalos si trabajas con ellos.',
            },
            {
                heading: 'Categorías',
                body: 'Organiza los ejercicios en categorías (Pecho, Pierna, Cardio…) para encontrarlos rápido al montar rutinas.',
            },
        ],
    },
    {
        key: 'history',
        title: 'Historial',
        icon: Clock,
        intro: 'Consulta lo que cada cliente ha registrado: series, pesos, tiempos y su evolución a lo largo del tiempo.',
        sections: [
            {
                heading: 'Revisar el progreso',
                body: 'Filtra por cliente y ejercicio para ver cómo evoluciona. Te sirve para ajustar la siguiente rutina con datos reales, no de memoria.',
            },
        ],
    },
    {
        key: 'mobile',
        title: 'App Móvil del cliente',
        icon: Smartphone,
        intro: 'Tus clientes tienen una app (web) donde ven sus rutinas, pagos, clases y progreso, y donde registran sus entrenamientos.',
        sections: [
            {
                heading: 'Cómo se la instalan',
                body: 'El cliente abre el enlace que recibe por email, inicia sesión y, desde el menú del navegador, elige "Añadir a pantalla de inicio" para tenerla como una app más.',
            },
            {
                heading: 'Qué puede hacer el cliente',
                body: [
                    '• Ver y registrar sus rutinas (con los campos según el tipo de cada ejercicio).',
                    '• Consultar sus pagos y cuándo le toca pagar.',
                    '• Apuntarse y cancelar clases y plazas de gimnasio.',
                    '• Ver su progreso y registrar su peso corporal.',
                    '• Consultar su ficha y datos médicos.',
                ],
            },
            {
                heading: 'Invitar o revocar acceso',
                body: 'Desde la ficha del cliente (pestaña App Móvil) invitas, reenvías contraseña o revocas el acceso. La lista de clientes con acceso se actualiza sola.',
            },
        ],
    },
    {
        key: 'notifications',
        title: 'Notificaciones',
        icon: Bell,
        intro: 'La app avisa al cliente automáticamente de cosas importantes, sin que tengas que hacer nada.',
        sections: [
            {
                heading: 'Avisos automáticos',
                body: [
                    '• "Te toca pagar en X días" — cuando se acerca su vencimiento.',
                    '• "Mañana tienes clase" — recordatorio de sus reservas.',
                    '• "Tu entrenador te ha asignado una nueva rutina" — al publicar un mesociclo nuevo.',
                ],
                tip: 'Para recibirlos, el cliente debe haber permitido las notificaciones en su app la primera vez.',
            },
        ],
    },
    {
        key: 'settings',
        title: 'Configuración',
        icon: Settings,
        intro: 'Los datos de tu gimnasio y las preferencias de la aplicación.',
        sections: [
            {
                heading: 'Datos del gimnasio',
                body: 'Nombre, logo y datos de contacto que aparecen en la app y en las comunicaciones a clientes.',
            },
            {
                heading: 'Copia de seguridad',
                body: 'Desde "Copia de Seguridad" (abajo en el menú) guardas y restauras toda la base de datos en la nube. Hazlo periódicamente o antes de cambios grandes.',
                tip: 'Tus datos se sincronizan en la nube de forma automática, pero una copia manual antes de una operación importante nunca está de más.',
            },
        ],
    },
];

export const HELP_BY_KEY = Object.fromEntries(HELP_MODULES.map(m => [m.key, m]));
