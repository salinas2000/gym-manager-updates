import React, { useState, useMemo } from 'react';
import { HelpCircle, Search, Lightbulb, ChevronRight } from 'lucide-react';
import { HELP_MODULES } from './help-content';

/** Normalize for accent-insensitive search. */
function norm(s) {
    return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/** Flatten a module's text so the search can match on any of its content. */
function moduleText(m) {
    const parts = [m.title, m.intro];
    for (const sec of m.sections || []) {
        parts.push(sec.heading);
        if (Array.isArray(sec.body)) parts.push(...sec.body);
        else if (sec.body) parts.push(sec.body);
        if (Array.isArray(sec.steps)) parts.push(...sec.steps);
        if (sec.tip) parts.push(sec.tip);
    }
    return norm(parts.join(' '));
}

export default function HelpPage() {
    const [activeKey, setActiveKey] = useState(HELP_MODULES[0]?.key);
    const [query, setQuery] = useState('');

    const filteredModules = useMemo(() => {
        const q = norm(query.trim());
        if (!q) return HELP_MODULES;
        return HELP_MODULES.filter(m => moduleText(m).includes(q));
    }, [query]);

    // If the active module got filtered out, jump to the first match.
    const active = useMemo(() => {
        const found = filteredModules.find(m => m.key === activeKey);
        return found || filteredModules[0] || null;
    }, [filteredModules, activeKey]);

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
                    <HelpCircle className="text-blue-500" size={32} />
                    Centro de Ayuda
                </h1>
                <p className="text-slate-400 mt-1">Documentación de cada módulo para realizar las gestiones del día a día.</p>
            </div>

            <div className="flex gap-6 items-start">
                {/* Left: module index */}
                <aside className="w-64 shrink-0 space-y-3">
                    {/* Search */}
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                        <input
                            type="text"
                            value={query}
                            onChange={e => setQuery(e.target.value)}
                            placeholder="Buscar en la ayuda..."
                            className="w-full bg-slate-900/60 border border-white/10 rounded-xl pl-9 pr-3 py-2.5 text-sm text-white outline-none focus:border-blue-500 transition-all placeholder:text-slate-600"
                        />
                    </div>

                    <nav className="space-y-1 bg-slate-900/30 rounded-2xl border border-white/5 p-2">
                        {filteredModules.length === 0 ? (
                            <p className="text-xs text-slate-500 px-3 py-4 text-center">Sin resultados</p>
                        ) : filteredModules.map(m => {
                            const Icon = m.icon;
                            const isActive = active?.key === m.key;
                            return (
                                <button
                                    key={m.key}
                                    onClick={() => setActiveKey(m.key)}
                                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-all ${
                                        isActive ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
                                    }`}
                                >
                                    <Icon size={16} className={isActive ? 'text-white' : 'text-slate-500'} />
                                    <span className="text-sm font-bold flex-1 truncate">{m.title}</span>
                                    {isActive && <ChevronRight size={14} />}
                                </button>
                            );
                        })}
                    </nav>
                </aside>

                {/* Right: content */}
                <div className="flex-1 min-w-0">
                    {active ? (
                        <article className="bg-slate-900/30 rounded-2xl border border-white/5 p-8 space-y-6">
                            <header className="pb-5 border-b border-white/5">
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="w-10 h-10 rounded-xl bg-blue-500/15 flex items-center justify-center">
                                        <active.icon size={20} className="text-blue-400" />
                                    </div>
                                    <h2 className="text-2xl font-black text-white">{active.title}</h2>
                                </div>
                                <p className="text-slate-400 leading-relaxed">{active.intro}</p>
                            </header>

                            <div className="space-y-7">
                                {active.sections.map((sec, i) => (
                                    <section key={i}>
                                        <h3 className="text-base font-black text-white mb-3 flex items-center gap-2">
                                            <span className="text-blue-400">{i + 1}.</span> {sec.heading}
                                        </h3>

                                        {sec.body && (
                                            <div className="space-y-2 text-slate-300 leading-relaxed text-[15px]">
                                                {(Array.isArray(sec.body) ? sec.body : [sec.body]).map((p, j) => (
                                                    <p key={j}>{p}</p>
                                                ))}
                                            </div>
                                        )}

                                        {sec.steps && (
                                            <ol className="mt-2 space-y-2">
                                                {sec.steps.map((step, j) => (
                                                    <li key={j} className="flex gap-3 text-slate-300 text-[15px] leading-relaxed">
                                                        <span className="shrink-0 w-5 h-5 rounded-md bg-slate-800 text-slate-400 text-xs font-black flex items-center justify-center mt-0.5">
                                                            {j + 1}
                                                        </span>
                                                        <span>{step}</span>
                                                    </li>
                                                ))}
                                            </ol>
                                        )}

                                        {sec.tip && (
                                            <div className="mt-3 flex gap-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3">
                                                <Lightbulb size={16} className="text-amber-400 shrink-0 mt-0.5" />
                                                <p className="text-amber-200/90 text-sm leading-relaxed">{sec.tip}</p>
                                            </div>
                                        )}
                                    </section>
                                ))}
                            </div>
                        </article>
                    ) : (
                        <div className="bg-slate-900/30 rounded-2xl border border-white/5 p-12 text-center text-slate-500">
                            No hay documentación para mostrar.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
