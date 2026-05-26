// Brief V2 §4a — Backup delegation context. Each entry pairs a covered
// admin with the delegate who can act on their behalf during the start/end
// window. The active set drives the "Covering: [Name]" rows in the
// UserAccountMenu and the delegate-context banner.

export interface BackupDelegation {
  id: string;
  admin_user_id: string;       // The covered admin (the one out of office).
  delegate_user_id: string;    // The delegate (the one stepping in).
  startIso: string;            // yyyy-mm-dd
  endIso?: string;             // yyyy-mm-dd; undefined = no end date
}

// Aligned with the org's mock "today" used elsewhere in the demo.
const NOW = new Date('2026-05-19T10:00:00');
const isoMinus = (days: number) => new Date(NOW.getTime() - days * 86_400_000).toISOString().slice(0, 10);
const isoPlus  = (days: number) => new Date(NOW.getTime() + days * 86_400_000).toISOString().slice(0, 10);

export const BACKUP_DELEGATIONS: BackupDelegation[] = [
  // J. Smith (user-001) is currently covering Karen Ng. This gives the
  // demo user a "Covering: Karen Ng" row in the account menu so the
  // delegation flow is exercisable in a single-identity session.
  {
    id: 'bd-cover-001',
    admin_user_id:    'user-kn',
    delegate_user_id: 'user-001',
    startIso: isoMinus(2),
    endIso:   isoPlus(12),
  },
  // Karen Ng covers J. Smith — present so the demo user can see what it
  // looks like to be covered (this entry is what Configurations > Backup
  // Delegate would surface for J. Smith). Doesn't add a row to J. Smith's
  // own account menu.
  {
    id: 'bd-cover-002',
    admin_user_id:    'user-001',
    delegate_user_id: 'user-kn',
    startIso: isoMinus(10),
  },
];

function todayIso(now: Date = NOW): string {
  return now.toISOString().slice(0, 10);
}

export function isDelegationActive(d: BackupDelegation, now: Date = NOW): boolean {
  const t = todayIso(now);
  if (t < d.startIso) return false;
  if (d.endIso && t > d.endIso) return false;
  return true;
}

// Active delegations where the given user is the delegate (= admins this
// user can currently act on behalf of). Drives the account-menu rows.
export function activeCoveredByDelegate(delegateUserId: string): BackupDelegation[] {
  return BACKUP_DELEGATIONS.filter(d =>
    d.delegate_user_id === delegateUserId && isDelegationActive(d),
  );
}
