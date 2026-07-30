import React from 'react';
import ReactDOM from 'react-dom/client';
import * as Sentry from '@sentry/electron/renderer';
import App from './App.jsx';
import './index.css';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Hereda DSN y opciones del proceso main a través de un protocolo IPC propio.
//
// OJO: solo en builds de producción. El main únicamente inicializa Sentry cuando
// la app está empaquetada (ver main/config/sentry.js), y si el renderer arranca
// sin esa contraparte el SDK inunda la consola con
// "Fetch API cannot load sentry-ipc://…" en cada breadcrumb. Este guard replica
// la condición del main: el bundle de producción es el que se empaqueta.
if (import.meta.env.PROD) {
    Sentry.init({});
}

const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <QueryClientProvider client={queryClient}>
            <App />
        </QueryClientProvider>
    </React.StrictMode>,
);
