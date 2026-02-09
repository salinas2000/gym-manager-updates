// Default configuration values for template designer
export const defaultConfig = {
    colors: {
        primary: '#1e293b',
        accent: '#10b981',
        gymNameColor: '#1e293b',
        dayLabelColor: '#334155',
        titleColor: '#1e293b',
        headerColor: '#475569',
        backgroundColor: '#f8fafc'
    },
    fonts: {
        title: { family: 'Inter', size: 24 },
        gymName: { family: 'Inter', size: 20 },
        header: { family: 'Inter', size: 12 },
        body: { family: 'Inter', size: 10 },
        dayLabel: { family: 'Inter', size: 10 }
    },
    // Columnas fijas y su orden (siempre visibles)
    fixedColumns: [
        { key: 'name', label: 'Ejercicio', width: 25 },
        { key: 'series', label: 'Series', width: 10 },
        { key: 'reps', label: 'Reps', width: 10 }
    ],
    // Columnas opcionales: se cargan dinámicamente desde exercise_field_config
    // Solo se incluyen los campos creados por el usuario en la biblioteca
    optionalColumns: [],
    // Campos personalizados del usuario (dinámicos desde exercise_field_config)
    customFields: [],
    // Mantener compatibilidad con versiones anteriores
    visibleColumns: {
        rpe: true,
        rest: true,
        weight: true,
        next: true
    },
    customColumns: []
};

export const fontFamilies = ['Inter', 'Roboto', 'Calibri', 'Verdana', 'Georgia', 'Arial'];

export const fontSizes = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32];

export const backgroundPresets = [
    { label: 'Papel', color: '#f8fafc' },
    { label: 'Blanco', color: '#ffffff' },
    { label: 'Sepia', color: '#fef3c7' },
    { label: 'Menta', color: '#f0fdf4' }
];
