import React, { useState } from 'react';
import { Search, Plus } from 'lucide-react';
import { useGym } from '../../context/GymContext';
import { cn } from '../../lib/utils';

export default function CustomerList({ onSelectCustomer, selectedCustomerId, onAddCustomer }) {
    const { customers = [] } = useGym();
    const [search, setSearch] = useState('');

    // Ensure customers is an array to prevent "filter is not a function"
    const safeCustomers = Array.isArray(customers) ? customers : [];

    const filtered = safeCustomers.filter(c =>
        c.first_name.toLowerCase().includes(search.toLowerCase()) ||
        c.last_name.toLowerCase().includes(search.toLowerCase()) ||
        c.email.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="glass-panel rounded-2xl p-6 h-[calc(100vh-8rem)] flex flex-col">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-lg font-semibold text-white">Members</h2>
                <button
                    onClick={onAddCustomer}
                    className="p-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20 transition-all">
                    <Plus size={20} />
                </button>
            </div>

            <div className="relative mb-6">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                <input
                    type="text"
                    placeholder="Search members..."
                    className="w-full glass-input pl-10 text-sm"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-2">
                {filtered.map(customer => (
                    <div
                        key={customer.id}
                        onClick={() => onSelectCustomer(customer)}
                        className={cn(
                            "p-3 rounded-xl cursor-pointer transition-all border border-transparent hover:border-white/5",
                            selectedCustomerId === customer.id
                                ? "bg-white/10"
                                : "hover:bg-white/5"
                        )}
                    >
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center text-sm font-bold text-slate-300">
                                    {customer.first_name[0]}{customer.last_name[0]}
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-white">{customer.first_name} {customer.last_name}</p>
                                    <p className="text-xs text-slate-500">{customer.email}</p>
                                </div>
                            </div>
                            {/* Status Dot */}
                            <div className={cn(
                                "w-2 h-2 rounded-full",
                                customer.active ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" : "bg-red-500"
                            )}></div>
                        </div>
                    </div>
                ))}

                {filtered.length === 0 && (
                    <div className="text-center text-slate-500 py-10 text-sm">
                        No members found
                    </div>
                )}
            </div>
        </div>
    );
}
