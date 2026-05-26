'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { X, Bell as BellIcon, CheckCheck, Settings, ChevronLeft } from 'lucide-react';
import { useNotifications, groupByBucket, BUCKET_LABEL } from '@/src/context/NotificationsContext';
import NotificationRow from '@/src/components/notifications/NotificationRow';
import type { NotificationEmailCategory } from '@/src/types/notifications';

type FilterKey = 'all' | 'unread' | 'action';

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function NotificationsDrawer({ open, onClose }: Props) {
  const { notifications, markAllRead, markAllSeen, unreadCount, emailPrefs, setEmailPref } = useNotifications();
  const [filter, setFilter]       = useState<FilterKey>('all');
  // Inline preferences view — replaces the filter row + body when open.
  const [prefsOpen, setPrefsOpen] = useState(false);

  // Auto-mark every visible notification as seen when the drawer opens.
  // Doesn't mark them read — that requires an explicit click or "Mark all".
  useEffect(() => {
    if (open) markAllSeen();
  }, [open, markAllSeen]);

  // Escape closes.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const filtered = useMemo(() => {
    if (filter === 'unread')  return notifications.filter(n => n.read_at === null);
    if (filter === 'action')  return notifications.filter(n => n.severity === 'action');
    return notifications;
  }, [notifications, filter]);

  const groups = useMemo(() => groupByBucket(filtered), [filtered]);

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-slate-900/30 backdrop-blur-[2px]" onClick={onClose} />
      <aside
        className="fixed top-0 right-0 bottom-0 z-50 bg-white shadow-2xl flex flex-col border-l border-gray-200"
        style={{ width: 420 }}
        role="dialog" aria-label="Notifications">
        {/* Header */}
        <header className="px-5 py-4 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2">
            {prefsOpen ? (
              <button onClick={() => setPrefsOpen(false)}
                title="Back to notifications"
                aria-label="Back to notifications"
                className="w-7 h-7 -ml-1 flex items-center justify-center text-gray-500 hover:bg-gray-100 rounded-md">
                <ChevronLeft className="w-4 h-4" />
              </button>
            ) : (
              <BellIcon className="w-4 h-4 text-gray-500" />
            )}
            <h2 className="text-base font-semibold text-gray-900">
              {prefsOpen ? 'Notification preferences' : 'Notifications'}
            </h2>
            {!prefsOpen && unreadCount > 0 && (
              <span className="text-[11px] text-gray-500">{unreadCount} unread</span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {!prefsOpen && (
              <>
                <button onClick={markAllRead}
                  title="Mark all as read"
                  className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors">
                  <CheckCheck className="w-3.5 h-3.5" /> Mark all read
                </button>
                <button onClick={() => setPrefsOpen(true)}
                  title="Notification preferences"
                  aria-label="Notification preferences"
                  className="w-8 h-8 flex items-center justify-center text-gray-500 hover:bg-gray-100 rounded-md">
                  <Settings className="w-4 h-4" />
                </button>
              </>
            )}
            <button onClick={onClose}
              title="Close"
              aria-label="Close notifications"
              className="w-8 h-8 flex items-center justify-center text-gray-500 hover:bg-gray-100 rounded-md">
              <X className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Preferences panel — replaces filter pills + body when open */}
        {prefsOpen ? (
          <div className="flex-1 overflow-y-auto">
            <div className="px-5 pt-4 pb-2 border-b border-gray-100">
              <p className="text-[11px] uppercase tracking-[0.08em] font-semibold text-gray-400">Email me when</p>
            </div>
            <ul className="px-5 pt-4 pb-4 space-y-4">
              {([
                { key: 'inbox',       label: 'New work lands in my inbox',    desc: 'New batches, returns, reroutes, urgent docs.' },
                { key: 'attention',   label: 'Something needs my attention',  desc: 'Missing delegate, inactive admin, retention warnings, printer issues.' },
                { key: 'assignments', label: 'My role or assignments change', desc: 'Promoted, new folder, backup activated.' },
              ] as Array<{ key: NotificationEmailCategory; label: string; desc: string }>).map(({ key, label, desc }) => (
                <li key={key}>
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm text-gray-900">{label}</p>
                    <button onClick={() => setEmailPref(key, !emailPrefs[key])}
                      aria-pressed={emailPrefs[key]}
                      title={emailPrefs[key] ? 'Email enabled' : 'Email muted'}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors flex-shrink-0 ${
                        emailPrefs[key] ? 'bg-blue-500' : 'bg-gray-200'
                      }`}>
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
                        emailPrefs[key] ? 'translate-x-4' : 'translate-x-0.5'
                      }`} />
                    </button>
                  </div>
                  <p className="text-[11px] text-gray-500 leading-tight mt-1">{desc}</p>
                </li>
              ))}
            </ul>
          </div>
        ) : (
        <>
        {/* Filter pills */}
        <div className="px-5 py-2.5 border-b border-gray-100 flex items-center gap-1.5 flex-shrink-0">
          {([
            { key: 'all',    label: 'All',             count: notifications.length },
            { key: 'unread', label: 'Unread',          count: notifications.filter(n => n.read_at === null).length },
            { key: 'action', label: 'Action required', count: notifications.filter(n => n.severity === 'action').length },
          ] as Array<{ key: FilterKey; label: string; count: number }>).map(({ key, label, count }) => {
            const active = filter === key;
            return (
              <button key={key} onClick={() => setFilter(key)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold rounded-full border transition-colors ${
                  active
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}>
                {label}
                <span className={`text-[10px] tabular-nums ${active ? 'text-blue-100' : 'text-gray-400'}`}>{count}</span>
              </button>
            );
          })}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {groups.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <BellIcon className="w-10 h-10 text-gray-200 mx-auto mb-3" />
              <p className="text-sm font-medium text-gray-700">You&apos;re all caught up.</p>
              <p className="text-xs text-gray-400 mt-1">No notifications match this filter.</p>
            </div>
          ) : (
            <div>
              {groups.map(({ bucket, items }) => (
                <section key={bucket}>
                  <p className="px-5 pt-4 pb-1.5 text-[10px] uppercase tracking-[0.08em] font-semibold text-gray-400">{BUCKET_LABEL[bucket]}</p>
                  <ul className="divide-y divide-gray-100">
                    {items.map(n => (
                      <li key={n.id}>
                        <NotificationRow n={n} onNavigate={onClose} />
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <footer className="px-5 py-3 border-t border-gray-200 flex items-center justify-center flex-shrink-0">
          <Link href="/notifications" onClick={onClose}
            className="text-xs font-semibold text-blue-600 hover:text-blue-800">
            See all ({notifications.length}) →
          </Link>
        </footer>
        </>)}
      </aside>
    </>
  );
}
