// SSO directory + role assignments for Configurations §4.1.
// The mock current user is J. Smith (also a System Admin in this directory).

export interface SsoUser {
  id: string;
  name: string;
  email: string;
  title?: string;                   // Job title, surfaced in SSO pickers + directory.
  lastLoginIso: string;             // ISO string. UI renders as "2 min ago" / "Yesterday" / "Nov 5".
  // Brief V2 §17 — drives engagement-based inactivity alerts. Any meaningful
  // inbox action (route, return, process, inbox view) updates this. The UI
  // compares against the Tunable Defaults thresholds (7d / 14d / 30d).
  lastInboxActivityIso?: string;
  systemAdmin?: boolean;
  delegateView?: boolean;
  foldersAdminCount?: number;       // Number of folders this user admins.
  active?: boolean;                 // false → flagged as inactive in directory + can orphan folders.
}

const now = new Date('2026-05-14T12:00:00');
const minutesAgo  = (m: number) => new Date(now.getTime() - m * 60_000).toISOString();
const hoursAgo    = (h: number) => new Date(now.getTime() - h * 3_600_000).toISOString();
const daysAgo     = (d: number) => new Date(now.getTime() - d * 86_400_000).toISOString();

// Titles match the folder structure (Sales / Claims / Payroll / Benefits /
// Jobsites / Shipping) — a mid-size insurance + construction-services org
// with HR, payroll, claims, and field operations.
export const SSO_USERS: SsoUser[] = [
  { id: 'user-001', name: 'J. Smith',     email: 'j.smith@acme.com',    title: 'Mailroom Operations Lead', lastLoginIso: minutesAgo(2),   lastInboxActivityIso: minutesAgo(5),  systemAdmin: true, delegateView: true, foldersAdminCount: 3, active: true },
  { id: 'user-kn',  name: 'Karen Ng',     email: 'k.ng@acme.com',       title: 'HR Lead',                  lastLoginIso: daysAgo(1),      lastInboxActivityIso: daysAgo(1),     systemAdmin: true, foldersAdminCount: 1, active: true },
  { id: 'user-dl',  name: 'David Liu',    email: 'd.liu@acme.com',      title: 'AR Manager',               lastLoginIso: daysAgo(9),      lastInboxActivityIso: daysAgo(9),     systemAdmin: true, foldersAdminCount: 0, active: true },
  { id: 'user-ms',  name: 'Maria Santos', email: 'm.santos@acme.com',   title: 'Mailroom Clerk',           lastLoginIso: minutesAgo(20),  lastInboxActivityIso: minutesAgo(20), delegateView: true, active: true },
  { id: 'user-tp',  name: 'Tom Park',     email: 't.park@acme.com',     title: 'Mailroom Clerk',           lastLoginIso: daysAgo(1),      lastInboxActivityIso: daysAgo(1),     delegateView: true, foldersAdminCount: 1, active: true },
  { id: 'user-sc',  name: 'Sarah Chen',   email: 's.chen@acme.com',     title: 'Payroll Manager',          lastLoginIso: minutesAgo(5),   lastInboxActivityIso: minutesAgo(5),  foldersAdminCount: 3, active: true },
  // Mike Torres hasn't actioned his inbox in 9 days → triggers the engagement
  // alert demo for his parent admin (J. Smith on Sales).
  { id: 'user-mt',  name: 'Mike Torres',  email: 'm.torres@acme.com',   title: 'Sales Director',           lastLoginIso: daysAgo(9),      lastInboxActivityIso: daysAgo(9),     foldersAdminCount: 2, active: true },
  { id: 'user-jw',  name: 'James Wu',     email: 'j.wu@acme.com',       title: 'Sales Manager',            lastLoginIso: hoursAgo(3),     lastInboxActivityIso: hoursAgo(3),    foldersAdminCount: 1, active: true },
  { id: 'user-lc',  name: 'Lisa Chen',    email: 'l.chen@acme.com',     title: 'Senior Sales Rep',         lastLoginIso: daysAgo(35),     lastInboxActivityIso: daysAgo(35),    foldersAdminCount: 1, active: true },
  { id: 'user-sk',  name: 'Sarah Kim',    email: 's.kim@acme.com',      title: 'Sales Coordinator',        lastLoginIso: hoursAgo(8),     lastInboxActivityIso: hoursAgo(8),    foldersAdminCount: 1, active: true },
  { id: 'user-jd',  name: 'Jane Doe',     email: 'j.doe@acme.com',      title: 'Field Operations Lead',    lastLoginIso: daysAgo(2),      lastInboxActivityIso: daysAgo(2),     foldersAdminCount: 1, active: true },
  { id: 'user-bs',  name: 'Bob Smith',    email: 'b.smith@acme.com',    title: 'Site Permits Coordinator', lastLoginIso: daysAgo(95),     lastInboxActivityIso: daysAgo(95),    foldersAdminCount: 1, active: false },
  { id: 'user-rp',  name: 'Ray Patel',    email: 'r.patel@acme.com',    title: 'Logistics Manager',        lastLoginIso: daysAgo(3),      lastInboxActivityIso: daysAgo(3),     active: true },
  { id: 'user-lp',  name: 'Lisa Park',    email: 'l.park@acme.com',     title: 'Benefits Coordinator',     lastLoginIso: daysAgo(4),      lastInboxActivityIso: daysAgo(4),     foldersAdminCount: 1, active: true },
  { id: 'user-jp',  name: 'Jenny Park',   email: 'j.park@acme.com',     title: 'Claims Lead',              lastLoginIso: daysAgo(2),      lastInboxActivityIso: daysAgo(2),     foldersAdminCount: 1, active: true },
];

export interface OrphanedFolder {
  folderName: string;
  formerAdminName: string;
  inactiveDays: number;
}

export const ORPHANED_FOLDERS: OrphanedFolder[] = [
  { folderName: 'Legacy Permits', formerAdminName: 'Bob Smith', inactiveDays: 95 },
];

export function findUser(id: string): SsoUser | undefined {
  return SSO_USERS.find(u => u.id === id);
}

export function formatRelative(iso: string, now: Date = new Date('2026-05-14T12:00:00')): string {
  const t = new Date(iso).getTime();
  const diffMs = now.getTime() - t;
  if (diffMs < 60_000) return 'Just now';
  const m = Math.floor(diffMs / 60_000);
  if (m < 60) return m + ' min ago';
  const h = Math.floor(diffMs / 3_600_000);
  if (h < 24) return h + ' hr ago';
  const d = Math.floor(diffMs / 86_400_000);
  if (d === 1) return 'Yesterday';
  if (d < 30) return d + ' days ago';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
