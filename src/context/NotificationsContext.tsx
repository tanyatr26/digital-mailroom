'use client';
import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { useUser } from '@/src/context/UserContext';
import type { Role } from '@/src/mocks/currentUser';
import type {
  Notification,
  NotificationEmailCategory,
  NotificationEmailPrefs,
  NotificationSeverity,
  NotificationSourceKind,
} from '@/src/types/notifications';

// V2 §22 — Notification system store. In-memory only; no localStorage per
// app constraints. Seeds are deterministic per role so the demo always
// opens with a representative spread of severities + date buckets.

const NOW = new Date('2026-05-19T10:00:00');
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3_600_000).toISOString();
const daysAgo  = (d: number) => new Date(NOW.getTime() - d * 86_400_000).toISOString();

// Role visibility filter. Mailroom-scope delegates only see operational
// notifications (B2 / C1 / C2 / C3). Folder-scope delegates only see
// inbox-flow notifications. FA and SA see their full role-appropriate set.
const DV_MAILROOM_CODES = new Set(['B2', 'C1', 'C2', 'C3']);
// F6 reminders intentionally excluded — folder-scope delegates have no
// access to admin or delegate assignments, so a reminder pointing at
// Folder Assignments / Backup Delegate wouldn't be actionable for them.
const DV_FOLDER_CODES   = new Set(['B1', 'B3', 'B5', 'B6', 'B7', 'B8']);
// SA-only categories (everything else FA sees too, except these):
const SA_ONLY_CODES     = new Set(['A10', 'A11', 'A12', 'C3', 'E2', 'F1', 'F3']);

export function isVisibleForRole(code: string, role: Role): boolean {
  if (role === 'System_Admin') return true;
  if (role === 'Folder_Admin') return !SA_ONLY_CODES.has(code);
  if (role === 'Delegate_View_Mailroom') return DV_MAILROOM_CODES.has(code);
  if (role === 'Delegate_View_Folder')   return DV_FOLDER_CODES.has(code);
  return false;
}

// Brief §22 — Each notification code maps to one of three email-pref
// categories (or null when the code is bell-drawer only and never
// emails). Used by the backend digest job; the front-end mock just
// stores the booleans. Codes not listed here default to bell-only.
const EMAIL_CATEGORY_BY_CODE: Record<string, NotificationEmailCategory | null> = {
  // Inbox — new work landing in the user's queue.
  B1:  'inbox', B2: 'inbox', B3: 'inbox', B5: 'inbox', B10: 'inbox',
  // Attention — actionable warnings / system health.
  A9:  'attention', A10: 'attention', A11: 'attention', A12: 'attention',
  F3:  'attention', F6:  'attention', B8:  'attention', E1:  'attention',
  C3:  'attention',
  // Assignments — identity, role, delegation, folder ownership lifecycle.
  A1:  'assignments', A2:  'assignments', A3:  'assignments', A4:  'assignments',
  A5:  'assignments', A6:  'assignments', A7:  'assignments', A8:  'assignments',
  A13: 'assignments', B11: 'assignments', B12: 'assignments',
  // Explicitly bell-only — no toggle exists for these. Listed for clarity.
  C1:  null, C2:  null, B9:  null,
};

export function emailCategoryForCode(code: string): NotificationEmailCategory | null {
  return EMAIL_CATEGORY_BY_CODE[code] ?? null;
}

// ── Seed data ─────────────────────────────────────────────────────
// Each seed binds to the mock user-001 (J. Smith). The visibility filter
// further constrains by current role so role-switching naturally swaps
// the notification surface without re-seeding.
function seedNotifications(): Notification[] {
  const make = (
    overrides: Partial<Notification> & Pick<Notification, 'code' | 'severity' | 'title' | 'body' | 'href' | 'created_at' | 'source_kind' | 'source_id'>,
  ): Notification => ({
    id: 'seed-' + overrides.code + '-' + Math.random().toString(36).slice(2, 8),
    recipient_user_id: 'user-001',
    type: overrides.code + '_' + overrides.source_kind,
    seen_at: null,
    read_at: null,
    archived_at: null,
    ...overrides,
  });

  return [
    // ── Today ───────────────────────────────────────────────────
    make({
      code: 'A2', severity: 'action', source_kind: 'folder', source_id: 'sales',
      title: 'You were assigned as Folder Admin of Sales',
      body: 'Karen Ng promoted you from Folder Admin of Mike Torres to Folder Admin of Sales.',
      href: '/inbox',
      created_at: hoursAgo(1),
    }),
    make({
      code: 'B1', severity: 'action', source_kind: 'folder', source_id: 'sales',
      title: 'New batch arrived in Sales',
      body: '"Sales Morning Run" — 12 documents awaiting routing.',
      href: '/inbox',
      created_at: hoursAgo(2),
    }),
    make({
      code: 'B3', severity: 'action', source_kind: 'doc', source_id: '441892',
      title: 'Document returned to your inbox',
      body: 'Mike Torres returned "Westfield Sales Contract Lot 14B" — reason: wrong recipient.',
      href: '/inbox',
      created_at: hoursAgo(4),
    }),
    make({
      code: 'B2', severity: 'action', source_kind: 'system', source_id: 'run-002',
      title: 'New mail run arrived: "Afternoon Run"',
      body: 'Nov 12, 2026 — 29 pages, 12 envelopes ready for dispatch.',
      href: '/mail-log',
      created_at: hoursAgo(3),
    }),
    make({
      code: 'A3', severity: 'info', source_kind: 'admin', source_id: 'user-kn',
      title: 'You were designated as backup delegate',
      body: 'Karen Ng designated you as her backup. Coverage starts May 23, 2026.',
      href: '/configurations/backup-delegate',
      created_at: hoursAgo(5),
    }),
    make({
      code: 'A10', severity: 'warning', source_kind: 'admin', source_id: 'user-lc',
      title: 'Admin inactive: Lisa Chen',
      body: 'No inbox activity for 35 days. Currently admin of 1 folder.',
      href: '/configurations/folder-tree',
      created_at: hoursAgo(6),
    }),
    make({
      code: 'A12', severity: 'action', source_kind: 'folder', source_id: 'legacy-permits',
      title: 'Orphaned folder: Legacy Permits',
      body: 'Bob Smith was deactivated. Reassign before mail piles up.',
      href: '/configurations/folder-assignments',
      created_at: hoursAgo(8),
    }),
    make({
      code: 'F3', severity: 'warning', source_kind: 'system', source_id: 'folder-tree',
      title: 'Folder tree health: 3 inactive admins',
      body: 'Lisa Chen, Mike Torres, and Bob Smith haven’t actioned mail recently.',
      href: '/configurations/folder-tree',
      created_at: hoursAgo(9),
    }),

    // ── Yesterday ──────────────────────────────────────────────
    make({
      code: 'B5', severity: 'action', source_kind: 'doc', source_id: '441891',
      title: 'Document rerouted into your folder',
      body: 'J. Smith (SA) rerouted "Plan Comparison Sheet" from Junk to Enrollments.',
      href: '/inbox',
      created_at: daysAgo(1),
    }),
    make({
      code: 'B8', severity: 'warning', source_kind: 'folder', source_id: 'sales',
      title: '3 documents waiting 7+ days in your inbox',
      body: 'Sales · oldest pending since May 8. Review or delegate.',
      href: '/inbox',
      created_at: daysAgo(1),
    }),
    make({
      code: 'B10', severity: 'warning', source_kind: 'doc', source_id: '442002',
      title: 'Urgent document detected',
      body: '"OSHA Annual Reporting Reminder" matched auto-urgent rules.',
      href: '/inbox',
      created_at: daysAgo(1),
    }),
    make({
      code: 'C3', severity: 'action', source_kind: 'system', source_id: 'printer-zd621',
      title: 'Label printer disconnected',
      body: 'Zebra ZD621 stopped responding. Last reachable yesterday 4:12pm.',
      href: '/configurations/label-printers',
      created_at: daysAgo(1),
    }),
    make({
      code: 'E1', severity: 'warning', source_kind: 'doc', source_id: 'retention-batch',
      title: '12 documents approaching retention expiry',
      body: 'Tax Notices reach 7-year retention in 30 days. Review before purge.',
      href: '/configurations/audit-log',
      created_at: daysAgo(1),
    }),

    // ── This week ──────────────────────────────────────────────
    make({
      code: 'C1', severity: 'info', source_kind: 'system', source_id: 'run-001',
      title: '"Morning Run" released',
      body: '47 labels printed. Run is now in send history.',
      href: '/mail-log',
      created_at: daysAgo(2),
    }),
    make({
      code: 'C2', severity: 'info', source_kind: 'system', source_id: 'print-job-12',
      title: 'Print queue completed',
      body: '47 labels printed for the morning run. Ready for handoff.',
      href: '/mail-log',
      created_at: daysAgo(2),
    }),
    make({
      code: 'D2', severity: 'info', source_kind: 'rule', source_id: 'tr-ca-001',
      title: 'Trusted route auto-promoted',
      body: 'ABC Construction → Jobsite A reached 47 uses with no overrides.',
      href: '/configurations/trusted-routes',
      created_at: daysAgo(3),
    }),
    make({
      code: 'B7', severity: 'info', source_kind: 'folder', source_id: 'sales',
      title: '12 documents auto-routed into Sales this week',
      body: 'Trusted routes handled the routing without manual review.',
      href: '/inbox',
      created_at: daysAgo(3),
    }),
    make({
      code: 'A9', severity: 'warning', source_kind: 'admin', source_id: 'user-001',
      title: 'You have zero backup delegates',
      body: 'Minimum 1 backup delegate is required. Designate one to clear this warning.',
      href: '/configurations/backup-delegate',
      created_at: daysAgo(4),
    }),
    make({
      code: 'D1', severity: 'info', source_kind: 'doc', source_id: 'ai-batch',
      title: 'AI suggested routing for 5 documents',
      body: 'Sales folder is in Phase 2. Review and confirm each suggestion.',
      href: '/inbox',
      created_at: daysAgo(5),
    }),

    // ── Earlier ────────────────────────────────────────────────
    make({
      code: 'F1', severity: 'info', source_kind: 'system', source_id: 'tunable-autoroute',
      title: 'Tunable default changed',
      body: 'Auto-route confidence threshold lowered from 99% to 95% by Karen Ng.',
      href: '/configurations/tunable-defaults',
      created_at: daysAgo(8),
    }),
    make({
      code: 'A11', severity: 'warning', source_kind: 'admin', source_id: 'user-bs',
      title: 'SSO user deactivated: Bob Smith',
      body: 'Bob Smith no longer has SSO access. He admins 1 folder (Legacy Permits).',
      href: '/configurations/folder-assignments',
      created_at: daysAgo(10),
    }),
    make({
      code: 'F4', severity: 'info', source_kind: 'rule', source_id: 'tr-sales-007',
      title: 'Trusted route added to your folder',
      body: 'J. Smith (SA) added a TechSupply → Sales trusted route.',
      href: '/configurations/trusted-routes',
      created_at: daysAgo(10),
    }),
  ];
}

interface NotificationsContextValue {
  // All notifications visible to the current user given their role.
  notifications: Notification[];
  // Counts derived from `notifications`.
  unreadCount: number;
  actionUnreadCount: number;
  unseenCount: number;
  // Lifecycle.
  emit: (
    template: Pick<Notification, 'code' | 'severity' | 'title' | 'body' | 'href' | 'source_kind' | 'source_id'> &
      Partial<Pick<Notification, 'recipient_user_id' | 'type' | 'created_at' | 'actionLabel'>>,
  ) => void;
  markAllSeen: () => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  dismiss: (id: string) => void;
  // State-tied helper: clear all notifications matching a given code for
  // the current user (used by Backup Delegate add-from-zero to clear A9).
  clearByCode: (code: string) => void;
  // Email prefs placeholder. No send logic yet.
  emailPrefs: NotificationEmailPrefs;
  setEmailPref: (category: NotificationEmailCategory, enabled: boolean) => void;
}

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useUser();
  const [items, setItems] = useState<Notification[]>(() => seedNotifications());
  // Brief §22 — three categories, all default on. The legacy
  // action/warning/info booleans are gone.
  const [emailPrefs, setEmailPrefs] = useState<NotificationEmailPrefs>({
    inbox:       true,
    attention:   true,
    assignments: true,
  });

  // Per-render filter by recipient + role. Archived notifications never
  // surface (auto-cleared / dismissed).
  const notifications = useMemo(() => {
    return items
      .filter(n => n.recipient_user_id === user.id)
      .filter(n => n.archived_at === null)
      .filter(n => isVisibleForRole(n.code, user.role))
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  }, [items, user.id, user.role]);

  const unreadCount       = notifications.filter(n => n.read_at === null).length;
  const actionUnreadCount = notifications.filter(n => n.read_at === null && n.severity === 'action').length;
  const unseenCount       = notifications.filter(n => n.seen_at === null).length;

  const emit = useCallback<NotificationsContextValue['emit']>(template => {
    const now = new Date().toISOString();
    const id = 'live-' + template.code + '-' + Math.random().toString(36).slice(2, 9);
    setItems(prev => [
      {
        id,
        recipient_user_id: template.recipient_user_id ?? 'user-001',
        type: template.type ?? template.code + '_' + template.source_kind,
        seen_at: null,
        read_at: null,
        archived_at: null,
        created_at: template.created_at ?? now,
        ...template,
      },
      ...prev,
    ]);
  }, []);

  const markAllSeen = useCallback(() => {
    const now = new Date().toISOString();
    setItems(prev => prev.map(n => (n.seen_at === null ? { ...n, seen_at: now } : n)));
  }, []);

  const markRead = useCallback((id: string) => {
    const now = new Date().toISOString();
    setItems(prev => prev.map(n => (n.id === id ? { ...n, read_at: now, seen_at: n.seen_at ?? now } : n)));
  }, []);

  const markAllRead = useCallback(() => {
    const now = new Date().toISOString();
    setItems(prev => prev.map(n => ({ ...n, read_at: n.read_at ?? now, seen_at: n.seen_at ?? now })));
  }, []);

  const dismiss = useCallback((id: string) => {
    const now = new Date().toISOString();
    setItems(prev => prev.map(n => (n.id === id ? { ...n, archived_at: now } : n)));
  }, []);

  const clearByCode = useCallback((code: string) => {
    const now = new Date().toISOString();
    setItems(prev => prev.map(n =>
      n.code === code && n.archived_at === null && n.recipient_user_id === user.id
        ? { ...n, archived_at: now }
        : n,
    ));
  }, [user.id]);

  const setEmailPref = useCallback((category: NotificationEmailCategory, enabled: boolean) => {
    setEmailPrefs(prev => ({ ...prev, [category]: enabled }));
  }, []);

  const value: NotificationsContextValue = {
    notifications,
    unreadCount,
    actionUnreadCount,
    unseenCount,
    emit,
    markAllSeen,
    markRead,
    markAllRead,
    dismiss,
    clearByCode,
    emailPrefs,
    setEmailPref,
  };

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function useNotifications(): NotificationsContextValue {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error('useNotifications must be used within NotificationsProvider');
  return ctx;
}

// Date-bucket grouping used by the drawer + archive page.
export type DateBucket = 'today' | 'yesterday' | 'this-week' | 'earlier';
export const BUCKET_LABEL: Record<DateBucket, string> = {
  today:       'Today',
  yesterday:   'Yesterday',
  'this-week': 'This week',
  earlier:     'Earlier',
};

function bucketOf(iso: string): DateBucket {
  const t = Date.parse(iso);
  const day = 86_400_000;
  const startOfToday = new Date(NOW); startOfToday.setHours(0, 0, 0, 0);
  const startOfYday  = startOfToday.getTime() - day;
  const startOfWeek  = startOfToday.getTime() - 7 * day;
  if (t >= startOfToday.getTime()) return 'today';
  if (t >= startOfYday)            return 'yesterday';
  if (t >= startOfWeek)            return 'this-week';
  return 'earlier';
}

const SEVERITY_RANK: Record<NotificationSeverity, number> = { action: 0, warning: 1, info: 2 };

export function groupByBucket(list: Notification[]): Array<{ bucket: DateBucket; items: Notification[] }> {
  const buckets: Record<DateBucket, Notification[]> = { today: [], yesterday: [], 'this-week': [], earlier: [] };
  list.forEach(n => buckets[bucketOf(n.created_at)].push(n));
  (Object.keys(buckets) as DateBucket[]).forEach(k => {
    buckets[k].sort((a, b) => {
      const s = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
      return s !== 0 ? s : b.created_at.localeCompare(a.created_at);
    });
  });
  const order: DateBucket[] = ['today', 'yesterday', 'this-week', 'earlier'];
  return order.filter(b => buckets[b].length > 0).map(b => ({ bucket: b, items: buckets[b] }));
}

export function formatNotificationTime(iso: string): string {
  const diffMs = NOW.getTime() - Date.parse(iso);
  if (diffMs < 60_000) return 'Just now';
  const m = Math.floor(diffMs / 60_000);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(diffMs / 3_600_000);
  if (h < 24) return `${h} hr ago`;
  const d = Math.floor(diffMs / 86_400_000);
  if (d === 1) return 'Yesterday';
  if (d < 7)   return `${d} days ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// Default action labels per code. Each row's primary action falls back to
// a sensible verb when a custom one isn't provided.
const ACTION_LABEL_BY_CODE: Record<string, string> = {
  A2:  'Open inbox',
  A3:  'View delegate',
  A9:  'Designate backup',
  A10: 'Review',
  A11: 'Reassign folders',
  A12: 'Reassign folder',
  B1:  'Open inbox',
  B2:  'Open mail log',
  B3:  'Review return',
  B5:  'Open inbox',
  B6:  'View document',
  B7:  'Open inbox',
  B8:  'Review pending',
  B9:  'Resume',
  B10: 'Open inbox',
  C1:  'View run',
  C2:  'View labels',
  C3:  'Open printer settings',
  D1:  'Review suggestions',
  D2:  'View rule',
  E1:  'Review retention',
  F1:  'View change',
  F3:  'Open folder tree',
  F4:  'View change',
};

export function actionLabelFor(code: string): string {
  return ACTION_LABEL_BY_CODE[code] ?? 'Open';
}
