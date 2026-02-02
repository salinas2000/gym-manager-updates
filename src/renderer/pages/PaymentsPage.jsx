import React from 'react';
import PaymentsManagement from '../features/finance/PaymentsManagement';
import { useLanguage } from '../context/LanguageContext';

export default function PaymentsPage() {
    const { t } = useLanguage();

    return (
        <div className="h-full">
            <header className="mb-8">
                <h1 className="text-4xl font-black text-white tracking-tight">{t('finance.title')}</h1>
                <p className="text-slate-400 mt-2 font-medium">Control mensual de ingresos y seguimiento de morosos.</p>
            </header>
            <PaymentsManagement />
        </div>
    );
}
