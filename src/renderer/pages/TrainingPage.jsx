import React from 'react';
import TrainingManager from '../features/training/TrainingManager';

export default function TrainingPage({ onNavigate, initialTab }) {
    return <TrainingManager onNavigate={onNavigate} initialTab={initialTab} />;
}
