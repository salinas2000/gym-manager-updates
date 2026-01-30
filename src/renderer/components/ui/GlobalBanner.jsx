import React, { useEffect } from 'react';
import { useGym } from '../../context/GymContext';
import { useNotifications } from '../../context/NotificationContext';
import { Megaphone } from 'lucide-react';

/**
 * GlobalNotificationListener (formerly GlobalBanner)
 * Listens for new broadcast messages and shows them as Toasts.
 * It renders NOTHING visually.
 */
export default function GlobalBanner() {
    const { broadcast } = useGym();
    const { addNotification } = useNotifications();

    useEffect(() => {
        if (!broadcast) return;

        // Unique ID for the message (fallback to timestamp if id is missing, though db should have it)
        const msgId = broadcast.id || broadcast.created_at;
        const lastSeen = localStorage.getItem('last_seen_broadcast_id');

        // If it's a new message we haven't seen yet
        if (msgId && msgId !== lastSeen) {

            // Show Toast
            addNotification({
                type: broadcast.type || 'info',
                message: broadcast.message,
                duration: 8000 // Show for a bit longer
            });

            // Mark as seen
            localStorage.setItem('last_seen_broadcast_id', msgId);
            console.log('[GlobalNotification] New message shown:', msgId);
        }
    }, [broadcast, addNotification]);

    return null; // Invisible component
}
