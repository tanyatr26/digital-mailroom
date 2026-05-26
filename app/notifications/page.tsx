'use client';
import { useMemo, useState, useEffect } from 'react';
import { Bell, CheckCheck, Mail } from 'lucide-react';
import { useNotifications, groupByBucket, BUCKET_LABEL } from '@/src/context/NotificationsContext';
import NotificationRow from '@/src/components/notifications/NotificationRow';
import type { NotificationEmailCategory } from '@/src/types/notifications';

// V2 §22 — Full-page notifications archive. Mirrors the drawer surface but
// with a wider column and the email-preferences placeholder docked at the
// right. Drawer remains the primary surface; this page is the "See all"
// landing.

type FilterKey = 'all' | 'unread' | 'action';

export default function NotificationsArchivePage() {
  const { notifications, markAllRead, markAllSeen, emailPrefs, setEmailPref } = useNotifications();
  const [filter, setFilter] = useState<FilterKey>('all');

  useEffect(() => { markAllSeen(); }, [markAllSeen]);

  const filtered = useMemo(() => {
    if (filter === 'unread') return notifications.filter(n => n.read_at === null);
    if (filter === 'action') return notifications.filter(n => n.severity === 'action');
    return notifications;
  }, [notifications, filter]);

  const groups = useMemo(() => groupByBucket(filtered), [filtered]);

  const filterCounts = {
    all:    notifications.length,
    unread: notifications.filter(n => n.read_at === null).length,
    action: notifications.filter(n => n.severity === 'action').length,
  };

  return (
    <div className="p-8 max-w-5xl">
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 flex items-center gap-2">
            <Bell className="w-5 h-5 text-gray-500" /> Notifications
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Everything the system has surfaced to you across the org.
          </p>
        </div>
        <button onClick={markAllRead}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
          <CheckCheck className="w-3.5 h-3.5" /> Mark all read
        </button>
      </header>

      <div className="grid grid-cols-[1fr_280px] gap-6 items-start">
        <section>
          {/* Filter pills */}
          <div className="mb-4 flex items-center gap-2 flex-wrap">
            {([
              { key: 'all',    label: 'All' },
              { key: 'unread', label: 'Unread' },
              { key: 'action', label: 'Action required' },
            ] as Array<{ key: FilterKey; label: string }>).map(({ key, label }) => {
              const active = filter === key;
              return (
                <button key={key} onClick={() => setFilter(key)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-full border transition-colors ${
                    active
                      ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}>
                  {label}
                  <span className={`text-[10px] tabular-nums ${active ? 'text-blue-100' : 'text-gray-400'}`}>{filterCounts[key]}</span>
                </button>
              );
            })}
          </div>

          {/* Body */}
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
            {groups.length === 0 ? (
              <div className="px-6 py-16 text-center">
                <Bell className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                <p className="text-sm font-medium text-gray-700">You&apos;re all caught up.</p>
                <p className="text-xs text-gray-400 mt-1">No notifications match this filter.</p>
              </div>
            ) : (
              groups.map(({ bucket, items }) => (
                <section key={bucket}>
                  <p className="px-5 pt-4 pb-1.5 text-[10px] uppercase tracking-[0.08em] font-semibold text-gray-400">{BUCKET_LABEL[bucket]}</p>
                  <ul className="divide-y divide-gray-100">
                    {items.map(n => (
                      <li key={n.id}>
                        <NotificationRow n={n} />
                      </li>
                    ))}
                  </ul>
                </section>
              ))
            )}
          </div>
        </section>

        {/* Email preferences placeholder */}
        <aside className="sticky top-6 bg-white border border-gray-200 rounded-2xl p-5">
          <p className="text-[11px] uppercase tracking-[0.08em] font-semibold text-gray-400 mb-3 flex items-center gap-1.5">
            <Mail className="w-3 h-3" /> Email me when…
          </p>
          <ul className="space-y-3">
            {([
              { key: 'inbox',       label: 'New work lands in my inbox' },
              { key: 'attention',   label: 'Something needs my attention' },
              { key: 'assignments', label: 'My role or assignments change' },
            ] as Array<{ key: NotificationEmailCategory; label: string }>).map(({ key, label }) => (
              <li key={key} className="flex items-center justify-between gap-3">
                <span className="text-sm text-gray-900">{label}</span>
                <button onClick={() => setEmailPref(key, !emailPrefs[key])}
                  aria-pressed={emailPrefs[key]}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors flex-shrink-0 ${
                    emailPrefs[key] ? 'bg-blue-500' : 'bg-gray-200'
                  }`}>
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
                    emailPrefs[key] ? 'translate-x-4' : 'translate-x-0.5'
                  }`} />
                </button>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </div>
  );
}
