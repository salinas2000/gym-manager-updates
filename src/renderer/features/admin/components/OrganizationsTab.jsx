import React from 'react';
import { FileText } from 'lucide-react';

export function OrganizationsTab({ organizations, onEdit }) {
    return (
        <table className="w-full text-left border-collapse">
            <thead>
                <tr className="border-b border-white/5 bg-slate-900/50 text-xs text-slate-500 uppercase tracking-wider">
                    <th className="p-4 font-bold">Organización</th>
                    <th className="p-4 font-bold">Email Contacto</th>
                    <th className="p-4 font-bold">Plantilla Excel</th>
                    <th className="p-4 font-bold">Fecha Alta</th>
                    <th className="p-4 font-right">Acciones</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-sm text-slate-300">
                {organizations.map((org) => (
                    <tr key={org.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="p-4 font-bold text-white">{org.name}</td>
                        <td className="p-4 text-slate-400 font-mono text-xs">{org.contact_email || '-'}</td>
                        <td className="p-4">
                            {org.excel_template_url ? (
                                <a href={org.excel_template_url} target="_blank" rel="noreferrer" className="text-emerald-400 hover:underline text-xs flex items-center gap-1">
                                    <FileText size={12} /> Ver Plantilla
                                </a>
                            ) : (
                                <span className="text-slate-500 text-xs italic">Predeterminada</span>
                            )}
                        </td>
                        <td className="p-4 text-slate-500 text-xs">{new Date(org.created_at).toLocaleDateString()}</td>
                        <td className="p-4 text-right">
                            <button
                                onClick={() => onEdit(org)}
                                className="text-blue-400 hover:text-blue-300 px-3 py-1 rounded bg-blue-500/10 hover:bg-blue-500/20 text-xs font-bold"
                            >
                                Editar
                            </button>
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
    );
}
