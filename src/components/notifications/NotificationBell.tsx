'use client';
import { useState } from 'react';
import { Bell } from 'lucide-react';
import { useNotifications } from '@/src/context/NotificationsContext';
import NotificationsDrawer from '@/src/components/notifications/NotificationsDrawer';

// V2 §22 — Bell sits in the TopBar to the left of the role-switcher chip.
// Badge behavior:
//   • 0 unseen  → no badge
//   • unseen > 0 with no action-severity → small red dot
//   • unseen > 0 with at least one action → numeric badge (1, 2, … 9+)

export default function NotificationBell() {
  const { unseenCount, actionUnreadCount } = useNotifications();
  const [open, setOpen] = useState(false);

  const showBadge = unseenCount > 0;
  const showNumeric = actionUnreadCount > 0;
  const numericLabel = actionUnreadCount > 9 ? '9+' : String(actionUnreadCount);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="Notifications"
        aria-label={showBadge ? `Notifications (${unseenCount} unread)` : 'Notifications'}
        className="relative w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
        <Bell className="w-4 h-4" />
        {showBadge && (
          showNumeric ? (
            <span
              className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 inline-flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold leading-none ring-2 ring-white tabular-nums">
              {numericLabel}
            </span>
          ) : (
            <span
              className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-500 ring-2 ring-white" />
          )
        )}
      </button>
      <NotificationsDrawer open={open} onClose={() => setOpen(false)} />
    </>
  );
}
