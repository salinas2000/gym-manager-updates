import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        this.setState({ errorInfo });
        console.error('[ErrorBoundary] Caught error:', error, errorInfo);
    }

    handleReset = () => {
        this.setState({ hasError: false, error: null, errorInfo: null });
    };

    handleReload = () => {
        window.location.reload();
    };

    render() {
        if (this.state.hasError) {
            // Section-level boundary (not full page)
            if (this.props.fallback) {
                return this.props.fallback;
            }

            return (
                <div className="flex items-center justify-center min-h-[400px] p-8">
                    <div className="text-center max-w-md">
                        <div className="bg-red-500/10 w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-red-500/20">
                            <AlertTriangle className="text-red-500" size={40} />
                        </div>
                        <h2 className="text-xl font-bold text-white mb-2">
                            Algo ha ido mal
                        </h2>
                        <p className="text-sm text-slate-400 mb-6 leading-relaxed">
                            Se ha producido un error inesperado. Puedes intentar recuperar la vista o recargar la aplicacion.
                        </p>
                        {this.state.error && (
                            <div className="bg-slate-900/50 border border-white/5 rounded-xl p-3 mb-6 text-left">
                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Detalle del error</p>
                                <p className="text-xs text-red-400 font-mono break-all">
                                    {this.state.error.message || 'Error desconocido'}
                                </p>
                            </div>
                        )}
                        <div className="flex gap-3 justify-center">
                            <button
                                onClick={this.handleReset}
                                className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold transition-all border border-white/5 active:scale-95 flex items-center gap-2"
                            >
                                <RefreshCw size={16} />
                                Reintentar
                            </button>
                            <button
                                onClick={this.handleReload}
                                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold transition-all active:scale-95"
                            >
                                Recargar App
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
