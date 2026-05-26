// V2 — Delegate View splits into two distinct roles so the type system can
// tell apart a System Admin's mailroom takeover from a Folder Admin's folder
// takeover. Each role's gates, nav, and default route are independent.
export type Role =
  | 'System_Admin'
  | 'Delegate_View_Mailroom'
  | 'Delegate_View_Folder'
  | 'Folder_Admin';

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  // Folder IDs the user admins. A folder admin with a leaf folder is the recipient
  // at that leaf — V2 collapses the old Recipient role into this relationship.
  folders?: string[];
  // Brief V2 §4 — Mailroom Worker is a tag, not a separate role. The SA
  // always carries it; the BD inherits it on promotion. Capability gates
  // for Mail Log / dispatch surfaces read this flag (OR System_Admin).
  // setRole / setUser in UserContext normalize this invariant.
  is_mailroom_worker?: boolean;
}

export const MOCK_USER: CurrentUser = {
  id: 'user-001',
  name: 'J. Smith',
  email: 'j.smith@company.com',
  role: 'Delegate_View_Mailroom',
  // Folders this user admins. Includes interior (sales, jobsite-a) and leaf
  // (ops-dept) examples so the Folder Admin demo can show both modes.
  folders: ['sales', 'jobsite-a', 'ops-dept'],
  // J. Smith is the demo's Mailroom Worker. Stays true across role swaps
  // so she retains Mail Log access regardless of which role the chip
  // selects (SA + DV-Mailroom force it on; FA / DV-Folder preserve it).
  is_mailroom_worker: true,
};

// Brief V2 §4 — single source of truth for the Mail Log / dispatch
// workspace capability gate. Use this everywhere instead of duplicating
// the role check, so the BD-promoted-to-SA flow transfers the capability
// without each gate needing to relearn the rule.
export function canAccessMailroom(user: CurrentUser): boolean {
  return user.role === 'System_Admin' || !!user.is_mailroom_worker;
}

export const ROLE_LABELS: Record<Role, string> = {
  System_Admin:           'System Admin',
  Delegate_View_Mailroom: 'Delegate View — Mailroom',
  Delegate_View_Folder:   'Delegate View — Folder',
  Folder_Admin:           'Folder Admin',
};

export const DEFAULT_ROUTES: Record<Role, string> = {
  System_Admin:           '/mail-log',
  Delegate_View_Mailroom: '/mail-log',
  Delegate_View_Folder:   '/inbox',
  Folder_Admin:           '/inbox',
};
