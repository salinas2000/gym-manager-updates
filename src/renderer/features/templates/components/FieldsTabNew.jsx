import React, { useState, useEffect } from 'react';
import { GripVertical, Eye, EyeOff, Lock } from 'lucide-react';
import { cn } from '../../../lib/utils';
import ControlSection from './ControlSection';

// Componente para un campo arrastrable
function DraggableField({ field, index, isDragging, onDragStart, onDragEnd, onDragOver, onDrop, onToggle, onWidthChange, isFixed }) {
    const [isEditingWidth, setIsEditingWidth] = useState(false);
    const [tempWidth, setTempWidth] = useState(field.width || 10);

    const dragHandlers = {
        draggable: true,
        onDragStart: (e) => onDragStart(e, index),
        onDragEnd,
        onDragOver,
        onDrop: (e) => onDrop(e, index)
    };

    const handleWidthSubmit = () => {
        const width = Math.max(5, Math.min(50, Number(tempWidth)));
        onWidthChange(index, width, isFixed);
        setIsEditingWidth(false);
    };

    return (
        <div
            {...dragHandlers}
            className={cn(
                "flex items-center gap-3 p-3 rounded-lg border transition-all cursor-move",
                isDragging ? "opacity-50" : "",
                isFixed
                    ? "bg-indigo-500/5 border-indigo-500/20 hover:border-indigo-500/30"
                    : "bg-slate-900/50 border-white/10 hover:border-white/20"
            )}
        >
            {/* Drag Handle */}
            <div className="text-slate-600 hover:text-slate-400 transition-colors">
                <GripVertical size={16} />
            </div>

            {/* Field Info */}
            <div className="flex-1">
                <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white">{field.label}</span>
                    {field.is_mandatory_in_template && (
                        <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-400 border border-orange-500/20">
                            Obligatorio
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-2 mt-1">
                    {!isEditingWidth ? (
                        <>
                            <button
                                onClick={() => {
                                    setIsEditingWidth(true);
                                    setTempWidth(field.width || 10);
                                }}
                                className="text-[10px] text-slate-500 hover:text-indigo-400 transition-colors underline decoration-dotted"
                            >
                                Ancho: {field.width || 10} cols
                            </button>
                            {field.type && (
                                <span className="text-[10px] text-slate-600">• {field.type}</span>
                            )}
                        </>
                    ) : (
                        <div className="flex items-center gap-1">
                            <input
                                type="number"
                                min="5"
                                max="50"
                                value={tempWidth}
                                onChange={(e) => setTempWidth(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleWidthSubmit();
                                    if (e.key === 'Escape') setIsEditingWidth(false);
                                }}
                                className="w-12 px-1 py-0.5 text-[10px] bg-slate-800 border border-indigo-500/30 rounded text-white focus:outline-none focus:border-indigo-400"
                                autoFocus
                            />
                            <button
                                onClick={handleWidthSubmit}
                                className="text-[10px] px-1.5 py-0.5 bg-indigo-500/20 text-indigo-400 rounded hover:bg-indigo-500/30"
                            >
                                ✓
                            </button>
                            <button
                                onClick={() => setIsEditingWidth(false)}
                                className="text-[10px] px-1.5 py-0.5 bg-slate-700/50 text-slate-400 rounded hover:bg-slate-700"
                            >
                                ✕
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Toggle (only for optional fields) */}
            {!isFixed && (
                <button
                    onClick={() => onToggle(index)}
                    className={cn(
                        "p-2 rounded-lg transition-all",
                        field.enabled
                            ? "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
                            : "bg-slate-800/50 text-slate-600 hover:bg-slate-800"
                    )}
                    title={field.enabled ? "Ocultar columna" : "Mostrar columna"}
                >
                    {field.enabled ? <Eye size={16} /> : <EyeOff size={16} />}
                </button>
            )}
        </div>
    );
}

export default function FieldsTabNew({ config, setConfig }) {
    const [draggedIndex, setDraggedIndex] = useState(null);
    const [customFields, setCustomFields] = useState([]);
    const [loading, setLoading] = useState(true);

    // Cargar campos personalizados desde la BD
    useEffect(() => {
        loadCustomFields();
    }, []);

    const loadCustomFields = async () => {
        try {
            const response = await window.api.templates.getFieldConfigs();

            console.log('[FieldsTabNew] Response crudo:', response);
            console.log('[FieldsTabNew] Tipo de response:', typeof response, Array.isArray(response));

            // La respuesta puede venir como array directamente o dentro de .data
            let fields = [];
            if (Array.isArray(response)) {
                fields = response;
            } else if (response && Array.isArray(response.data)) {
                fields = response.data;
            } else if (response && response.success && Array.isArray(response.data)) {
                fields = response.data;
            }

            console.log('[FieldsTabNew] Campos cargados desde BD:', fields);

            // Convertir SOLO los campos creados por el usuario a formato compatible
            // NO hay campos base hardcodeados, TODO se crea desde Configuración de Campos
            // FILTRAR campos obligatorios (is_mandatory_in_template = 1) - esos van en fixedColumns
            const formattedFields = fields
                .filter(f => f.is_active && !f.is_deleted && !f.is_mandatory_in_template)
                .map(f => {
                    // Ancho dinámico según el tipo de campo
                    let width = 10;
                    if (f.type === 'text') width = 15;
                    if (f.type === 'textarea') width = 20;
                    if (f.type === 'url') width = 18;
                    if (f.type === 'number') width = 8;
                    if (f.type === 'checkbox') width = 8;
                    if (f.type === 'select') width = 12;

                    return {
                        key: f.field_key,
                        label: f.label,
                        width,
                        enabled: true,
                        type: f.type,
                        is_mandatory_in_template: f.is_mandatory_in_template,
                        isCustomField: true
                    };
                });

            console.log('[FieldsTabNew] Campos formateados:', formattedFields);
            console.log('[FieldsTabNew] config.optionalColumns actual:', config.optionalColumns);

            setCustomFields(formattedFields);

            // Si config.optionalColumns está vacío, usar los campos cargados
            // Si tiene datos, significa que es un diseño guardado, mantener su configuración
            setConfig(prev => {
                // Si ya tiene optionalColumns con datos (diseño cargado), no sobreescribir
                if (prev.optionalColumns && prev.optionalColumns.length > 0) {
                    console.log('[FieldsTabNew] Diseño cargado, haciendo merge');
                    // Hacer merge solo de campos nuevos que no existan
                    const existingKeys = new Set(prev.optionalColumns.map(c => c.key));
                    const newFields = formattedFields.filter(f => !existingKeys.has(f.key));

                    const merged = [...prev.optionalColumns, ...newFields];
                    console.log('[FieldsTabNew] Resultado después de merge:', merged);

                    return {
                        ...prev,
                        optionalColumns: merged
                    };
                }

                // Si está vacío (nuevo diseño), cargar SOLO los campos creados por el usuario
                console.log('[FieldsTabNew] Nuevo diseño, cargando campos desde BD');
                console.log('[FieldsTabNew] Campos a asignar:', formattedFields);

                return {
                    ...prev,
                    optionalColumns: formattedFields
                };
            });
        } catch (err) {
            console.error('Error loading custom fields:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleDragStart = (e, index) => {
        setDraggedIndex(index);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragEnd = () => {
        setDraggedIndex(null);
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };

    const handleDrop = (e, dropIndex) => {
        e.preventDefault();
        if (draggedIndex === null || draggedIndex === dropIndex) return;

        setConfig(prev => {
            const newColumns = [...prev.optionalColumns];
            const [removed] = newColumns.splice(draggedIndex, 1);
            newColumns.splice(dropIndex, 0, removed);

            return {
                ...prev,
                optionalColumns: newColumns
            };
        });

        setDraggedIndex(null);
    };

    const handleToggleField = (index) => {
        setConfig(prev => {
            const newColumns = [...prev.optionalColumns];
            newColumns[index] = {
                ...newColumns[index],
                enabled: !newColumns[index].enabled
            };

            return {
                ...prev,
                optionalColumns: newColumns
            };
        });
    };

    const handleWidthChange = (index, newWidth, isFixed = false) => {
        const columnType = isFixed ? 'fixedColumns' : 'optionalColumns';

        setConfig(prev => {
            const newColumns = [...prev[columnType]];
            newColumns[index] = {
                ...newColumns[index],
                width: newWidth
            };

            return {
                ...prev,
                [columnType]: newColumns
            };
        });
    };

    const handleDragStartFixed = (e, index) => {
        setDraggedIndex(index);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDropFixed = (e, dropIndex) => {
        e.preventDefault();
        if (draggedIndex === null || draggedIndex === dropIndex) return;

        setConfig(prev => {
            const newColumns = [...prev.fixedColumns];
            const [removed] = newColumns.splice(draggedIndex, 1);
            newColumns.splice(dropIndex, 0, removed);

            return {
                ...prev,
                fixedColumns: newColumns
            };
        });

        setDraggedIndex(null);
    };

    if (loading) {
        return (
            <div className="p-4 text-center text-slate-500">
                Cargando campos...
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Fixed Columns */}
            <ControlSection
                title="Columnas Fijas"
                description="Siempre visibles. Arrastra para reordenar, haz clic en el ancho para editarlo"
            >
                <div className="space-y-2">
                    {config.fixedColumns?.map((field, index) => (
                        <DraggableField
                            key={field.key}
                            field={field}
                            index={index}
                            isDragging={draggedIndex === index}
                            onDragStart={handleDragStartFixed}
                            onDragEnd={handleDragEnd}
                            onDragOver={handleDragOver}
                            onDrop={handleDropFixed}
                            onWidthChange={handleWidthChange}
                            isFixed={true}
                        />
                    ))}
                </div>
            </ControlSection>

            {/* Optional Columns */}
            <ControlSection
                title="Columnas Opcionales"
                description="Activa/desactiva, reordena y ajusta el ancho según tus necesidades"
            >
                <div className="space-y-2">
                    {(!config.optionalColumns || config.optionalColumns.length === 0) ? (
                        <div className="p-4 text-center border border-white/5 rounded-lg bg-slate-900/30">
                            <p className="text-sm text-slate-500">
                                No hay campos opcionales disponibles
                            </p>
                            <p className="text-xs text-slate-600 mt-1">
                                Crea campos personalizados en la biblioteca de ejercicios
                            </p>
                        </div>
                    ) : (
                        config.optionalColumns.map((field, index) => (
                            <DraggableField
                                key={field.key}
                                field={field}
                                index={index}
                                isDragging={draggedIndex === index}
                                onDragStart={handleDragStart}
                                onDragEnd={handleDragEnd}
                                onDragOver={handleDragOver}
                                onDrop={handleDrop}
                                onToggle={handleToggleField}
                                onWidthChange={handleWidthChange}
                                isFixed={false}
                            />
                        ))
                    )}
                </div>
            </ControlSection>

            {/* Info */}
            <div className="p-3 rounded-lg bg-blue-500/5 border border-blue-500/10">
                <p className="text-xs text-blue-300">
                    💡 <strong>Tip:</strong> Puedes reordenar TODAS las columnas (fijas y opcionales) arrastrándolas.
                    Haz clic en "Ancho: X cols" para editar el tamaño de cualquier columna.
                </p>
            </div>
        </div>
    );
}
