import React from 'react';
import TrainingHistory from '../features/training/TrainingHistory';

export default function TrainingHistoryPage({ initialCustomer, onNavigate }) {
    return <TrainingHistory initialCustomer={initialCustomer} onNavigate={onNavigate} />;
}
