import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import TrainerApp from './TrainerApp.jsx';
import './index.css';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient();

// Mode is decided by main.js: it opens this renderer with ?mode=trainer
// when a trainer session is active, otherwise plain boss mode.
const isTrainerMode = new URLSearchParams(window.location.search).get('mode') === 'trainer';

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <QueryClientProvider client={queryClient}>
            {isTrainerMode ? <TrainerApp /> : <App />}
        </QueryClientProvider>
    </React.StrictMode>,
);
