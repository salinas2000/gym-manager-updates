import React from 'react';
import TrainingManager from '../features/training/TrainingManager';

export default function TrainingPage({ onNavigate }) {
    return <TrainingManager onNavigate={onNavigate} />;
}
