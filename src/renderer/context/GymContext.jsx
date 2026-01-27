import React, { createContext, useContext, useEffect, useState } from 'react';

const GymContext = createContext();

export function GymProvider({ children }) {
    const [customers, setCustomers] = useState([]);
    const [tariffs, setTariffs] = useState([]);
    const [payments, setPayments] = useState({}); // Map: customerId -> [payment records]

    const [loading, setLoading] = useState(true);
    const [settings, setSettings] = useState({
        gym_name: 'Gym Manager',
        manager_name: 'Admin',
        role: 'Gerente'
    });

    const refreshData = async () => {
        if (!window.api) {
            console.error("Critical Error: window.api is undefined. Preload script failed to load or Context Isolation blocked.");
            setLoading(false);
            return;
        }

        try {
            const [customersRes, tariffsRes, settingsRes] = await Promise.all([
                window.api.customers.getAll(),
                window.api.tariffs.getAll(),
                window.api.settings.getAll()
            ]);

            if (customersRes.success) setCustomers(customersRes.data || []);
            if (tariffsRes.success) setTariffs(tariffsRes.data || []);
            if (settingsRes.success && settingsRes.data) {
                setSettings(prev => ({ ...prev, ...settingsRes.data }));
            }

        } catch (error) {
            console.error("Failed to load data:", error);
        } finally {
            setLoading(false);
        }
    };

    const addTariff = async (data) => {
        if (!window.api) return false;
        const result = await window.api.tariffs.create(data);
        if (result.success) {
            setTariffs(prev => [...prev, result.data]);
            return true;
        }
        return false;
    };

    const deleteTariff = async (id) => {
        if (!window.api) return;
        setTariffs(prev => prev.filter(t => t.id !== id));
        await window.api.tariffs.delete(id);
    };

    useEffect(() => {
        refreshData();
    }, []);

    const addCustomer = async (data) => {
        if (!window.api) return false;
        const result = await window.api.customers.create(data);
        if (result.success) {
            // Add to top list
            setCustomers(prev => [result.data, ...prev]);
            return true;
        }
        return false;
    };

    const updateCustomer = async (id, data) => {
        if (!window.api) return false;
        const result = await window.api.customers.update(id, data);
        if (result.success) {
            // Update local state
            setCustomers(prev => prev.map(c => c.id === id ? result.data : c));
            return true;
        }
        return false;
    };

    const updateTariff = async (id, data) => {
        if (!window.api) return false;
        const result = await window.api.tariffs.update(id, data);
        if (result.success) {
            setTariffs(prev => prev.map(t => t.id === id ? { ...t, ...result.data } : t));
            return true;
        }
        return false;
    }

    const toggleCustomerStatus = async (id, mode = 'immediate') => {
        if (!window.api) return;

        // We rely on backend response for the new state because it depends on the mode (scheduled vs immediate)
        const result = await window.api.customers.toggleActive(id, mode);

        if (result.success) {
            setCustomers(prev => prev.map(c =>
                c.id === id ? result.data : c
            ));
        }
    };

    const loadPaymentsForCustomer = async (customerId) => {
        if (!window.api) return;
        const result = await window.api.payments.getByCustomer(customerId);
        if (result.success) {
            setPayments(prev => ({ ...prev, [customerId]: result.data }));
        }
    }

    const addPayment = async (data) => {
        if (!window.api) return false;

        const result = await window.api.payments.create(data);
        if (result.success) {
            setPayments(prev => ({
                ...prev,
                [data.customer_id]: [result.data, ...(prev[data.customer_id] || [])]
            }));
            return true;
        }
        return false;
    };

    const deletePayment = async (customerId, paymentId) => {
        if (!window.api) return false;

        const result = await window.api.payments.delete(paymentId);
        if (result.success) {
            setPayments(prev => ({
                ...prev,
                [customerId]: (prev[customerId] || []).filter(p => p.id !== paymentId)
            }));
            return true;
        }
        return false;
    };

    // Helper to check if paid in specific month (0-11) of current year
    const isPaid = (customerId, monthIndex) => {
        const customerPayments = payments[customerId] || [];
        const currentYear = new Date().getFullYear();

        return customerPayments.some(p => {
            const d = new Date(p.payment_date);
            return d.getMonth() === monthIndex && d.getFullYear() === currentYear;
        });
    };

    return (
        <GymContext.Provider value={{
            customers,
            tariffs,
            addCustomer,
            updateCustomer,
            addTariff,
            updateTariff,
            deleteTariff,
            toggleCustomerStatus,
            loading,
            loadPaymentsForCustomer,
            addPayment,
            deletePayment,
            // getPaymentForMonth Helper
            getPaymentForMonth: (customerId, monthIndex, year) => {
                const list = payments[customerId] || [];
                return list.find(p => {
                    const d = new Date(p.payment_date);
                    return d.getMonth() === monthIndex && d.getFullYear() === year;
                });
            },
            isPaid,
            isPaid,
            refreshData,
            settings,
            updateSettings: async (newSettings) => {
                if (!window.api) return;
                const res = await window.api.settings.update(newSettings);
                if (res.success) {
                    setSettings(prev => ({ ...prev, ...res.data }));
                    return true;
                }
                return false;
            }
        }}>
            {children}
        </GymContext.Provider>
    );
}

export const useGym = () => useContext(GymContext);
