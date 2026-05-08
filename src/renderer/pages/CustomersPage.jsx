import React, { useState } from 'react';
import CustomerTable from '../features/customers/CustomerTable';
import AddCustomerModal from '../features/customers/AddCustomerModal';
import CustomerHistoryModal from '../features/customers/CustomerHistoryModal';
import CustomerProfileCard from '../features/customers/CustomerProfileCard';
import SendCustomersModal from '../features/customers/SendCustomersModal';
import PaymentDrawer from '../features/finance/PaymentDrawer';
import PaymentGrid from '../features/finance/PaymentGrid';
import { useGym } from '../context/GymContext';

export default function CustomersPage({ onNavigate }) {
    const { settings } = useGym();
    const isMaster = settings?.isMaster === true;
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [customerToEdit, setCustomerToEdit] = useState(null);
    const [customerHistory, setCustomerHistory] = useState(null);
    const [profileCustomer, setProfileCustomer] = useState(null);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [isSendModalOpen, setIsSendModalOpen] = useState(false);

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
        onNavigate('history', customer);
    };

    const handleOpenProfile = (customer) => {
        setProfileCustomer(customer);
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
                onOpenProfile={handleOpenProfile}
                onSendCustomers={isMaster ? () => setIsSendModalOpen(true) : undefined}
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

            <CustomerProfileCard
                isOpen={!!profileCustomer}
                onClose={() => setProfileCustomer(null)}
                customer={profileCustomer}
                onNavigateTraining={(c) => handleOpenTraining(c)}
                onOpenPayments={(c) => handleOpenHistory(c)}
            />

            <SendCustomersModal
                isOpen={isSendModalOpen}
                onClose={() => setIsSendModalOpen(false)}
            />
        </>
    );
}
