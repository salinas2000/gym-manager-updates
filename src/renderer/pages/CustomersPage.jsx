import React, { useState } from 'react';
import CustomerTable from '../features/customers/CustomerTable';
import AddCustomerModal from '../features/customers/AddCustomerModal';
import CustomerHistoryModal from '../features/customers/CustomerHistoryModal';
import PaymentDrawer from '../features/finance/PaymentDrawer';
import PaymentGrid from '../features/finance/PaymentGrid';

export default function CustomersPage({ onNavigate }) {
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [customerToEdit, setCustomerToEdit] = useState(null);
    const [customerHistory, setCustomerHistory] = useState(null);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);

    const handleOpenHistory = (customer) => {
        setSelectedCustomer(customer);
        setIsDrawerOpen(true);
    };

    const handleEditHistory = (customer) => {
        setCustomerHistory(customer);
        setIsHistoryModalOpen(true);
    };

    const handleEditCustomer = (customer) => {
        setCustomerToEdit(customer);
        setIsAddModalOpen(true);
    };

    const handleAddCustomer = () => {
        setCustomerToEdit(null);
        setIsAddModalOpen(true);
    };

    const handleOpenTraining = (customer) => {
        // Navigate to history view for this customer
        // We need to pass the customer selection to the parent app state?
        // Or can we navigate with params?
        // For now, App.jsx handles state. We might need to lift 'onNavigate' to support passing data.
        // Let's assume onNavigate can accept (view, data).
        onNavigate('history', customer);
    };

    return (
        <>
            <CustomerTable
                onOpenHistory={handleOpenHistory}
                onAddCustomer={handleAddCustomer}
                onManageTariffs={() => onNavigate('tariffs')}
                onEditCustomer={handleEditCustomer}
                onEditHistory={handleEditHistory}
                onOpenTraining={handleOpenTraining}
            />

            {/* OVERLAYS */}
            <PaymentDrawer
                isOpen={isDrawerOpen}
                onClose={() => setIsDrawerOpen(false)}
                customer={selectedCustomer}
            >
                <PaymentGrid customer={selectedCustomer} />
            </PaymentDrawer>

            <AddCustomerModal
                isOpen={isAddModalOpen}
                onClose={() => setIsAddModalOpen(false)}
                customerToEdit={customerToEdit}
            />

            <CustomerHistoryModal
                isOpen={isHistoryModalOpen}
                onClose={() => setIsHistoryModalOpen(false)}
                customer={customerHistory}
            />
        </>
    );
}
