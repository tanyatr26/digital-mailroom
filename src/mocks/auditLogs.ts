// Mock audit-log entries for Configurations §4.9 (Read Audit Log) and
// §4.10 (Admin Audit Trail). These are read-only fixtures — every action
// the user takes in the live app would normally append to these.

export type AccessMethod = 'folder_browse' | 'cross_folder_search' | 'direct_link';

export interface ReadAuditEntry {
  id: string;
  timestampIso: string;
  userId: string;
  userName: string;
  docId: string;
  docTitle: string;
  folderName: string;
  accessMethod: AccessMethod;
  durationSeconds: number;
}

export type AdminAuditAction =
  | 'folder_created'
  | 'folder_archived'
  | 'admin_assigned'
  | 'admin_reassigned'
  | 'delegate_assigned'
  | 'trusted_route_created'
  | 'trusted_route_revoked'
  | 'document_type_changed'
  | 'tunable_default_changed'
  | 'folder_admin_reminded'
  // Brief V2 §4 — SA departure flow promotes the SA's Backup Delegate
  // to System Admin. Logged here with before/after capturing the
  // previous SA, the promoted BD, and the promotion timestamp.
  | 'sa_promoted_from_bd';

export interface AdminAuditEntry {
  id: string;
  timestampIso: string;
  userId: string;
  userName: string;
  action: AdminAuditAction;
  targetSummary: string;            // Short human label of what was acted on.
  beforeState?: Record<string, unknown>;
  afterState?: Record<string, unknown>;
}

const t = (mins: number) => new Date(Date.parse('2026-05-14T12:00:00') - mins * 60_000).toISOString();

export const READ_AUDIT_ENTRIES: ReadAuditEntry[] = [
  { id: 'ra-001', timestampIso: t(13),    userId: 'user-001', userName: 'J. Smith',    docId: '441892', docTitle: 'Westfield Sales Contract', folderName: 'Closings',          accessMethod: 'folder_browse',        durationSeconds: 138 },
  { id: 'ra-002', timestampIso: t(29),    userId: 'user-sc',  userName: 'Sarah Chen',  docId: '441890', docTitle: 'New Hire Enrollment Forms', folderName: 'Karen Ng',          accessMethod: 'direct_link',          durationSeconds: 45 },
  { id: 'ra-003', timestampIso: t(45),    userId: 'user-001', userName: 'J. Smith',    docId: '441888', docTitle: 'Quarterly Tax Notice',      folderName: 'Payroll',           accessMethod: 'cross_folder_search',  durationSeconds: 62 },
  { id: 'ra-004', timestampIso: t(62),    userId: 'user-kn',  userName: 'Karen Ng',    docId: '441891', docTitle: 'Plan Comparison Sheet',     folderName: 'Enrollments',       accessMethod: 'folder_browse',        durationSeconds: 32 },
  { id: 'ra-005', timestampIso: t(78),    userId: 'user-mt',  userName: 'Mike Torres', docId: '441902', docTitle: 'Apex Q4 Proposal',          folderName: 'Mike Torres',       accessMethod: 'folder_browse',        durationSeconds: 192 },
  { id: 'ra-006', timestampIso: t(125),   userId: 'user-jw',  userName: 'James Wu',    docId: '441895', docTitle: 'GreenLeaf PO #7823',        folderName: 'James Wu',          accessMethod: 'folder_browse',        durationSeconds: 28 },
  { id: 'ra-007', timestampIso: t(180),   userId: 'user-001', userName: 'J. Smith',    docId: '441920', docTitle: 'Site Safety Audit Lot 9A',  folderName: 'Safety',            accessMethod: 'cross_folder_search',  durationSeconds: 84 },
  { id: 'ra-008', timestampIso: t(220),   userId: 'user-lc',  userName: 'Lisa Chen',   docId: '441903', docTitle: 'Meridian Account Renewal',  folderName: 'Lisa Chen',         accessMethod: 'direct_link',          durationSeconds: 56 },
  { id: 'ra-009', timestampIso: t(310),   userId: 'user-sc',  userName: 'Sarah Chen',  docId: '441908', docTitle: 'Monthly KPI Report',         folderName: 'Reports',           accessMethod: 'folder_browse',        durationSeconds: 412 },
  { id: 'ra-010', timestampIso: t(420),   userId: 'user-001', userName: 'J. Smith',    docId: '441921', docTitle: 'OSHA Inspection Notice',     folderName: 'Safety',            accessMethod: 'cross_folder_search',  durationSeconds: 95 },
  { id: 'ra-011', timestampIso: t(560),   userId: 'user-tp',  userName: 'Tom Park',    docId: '441885', docTitle: 'TechSupply Receipt #88291',  folderName: 'Billing',           accessMethod: 'folder_browse',        durationSeconds: 18 },
  { id: 'ra-012', timestampIso: t(780),   userId: 'user-ms',  userName: 'Maria Santos',docId: '441887', docTitle: 'Promotional Brochure',       folderName: 'Junk',              accessMethod: 'folder_browse',        durationSeconds: 7  },
];

export const ADMIN_AUDIT_ENTRIES: AdminAuditEntry[] = [
  { id: 'aa-001', timestampIso: t(18),  userId: 'user-001', userName: 'J. Smith',    action: 'folder_archived',        targetSummary: 'Reports Q2',
    beforeState: { id: 'reports-q2', name: 'Reports Q2', archived: false },
    afterState:  { id: 'reports-q2', name: 'Reports Q2', archived: true, archivedAt: '2026-05-14T11:42:00Z' } },
  { id: 'aa-002', timestampIso: t(106), userId: 'user-kn',  userName: 'Karen Ng',    action: 'trusted_route_created',  targetSummary: 'ABC Construction → Jobsite A',
    afterState:  { pattern: { sender: 'ABC Construction', document_type: 'Invoice' }, destination: 'Jobsite A' } },
  { id: 'aa-003', timestampIso: t(135), userId: 'user-001', userName: 'J. Smith',    action: 'admin_assigned',         targetSummary: 'David Liu promoted to System Admin',
    afterState:  { userId: 'user-dl', role: 'System_Admin' } },
  { id: 'aa-004', timestampIso: t(265), userId: 'user-sc',  userName: 'Sarah Chen',  action: 'delegate_assigned',      targetSummary: 'Karen Ng covers CA Operations',
    afterState:  { folder: 'ca-state', delegateUserId: 'user-kn', endsAt: '2026-05-25T00:00:00Z' } },
  { id: 'aa-005', timestampIso: t(380), userId: 'user-001', userName: 'J. Smith',    action: 'document_type_changed',  targetSummary: 'Tax Notice — retention 5y → 7y',
    beforeState: { type_id: 'dt-tax-notice', retention_days: 1825 },
    afterState:  { type_id: 'dt-tax-notice', retention_days: 2555 } },
  { id: 'aa-007', timestampIso: t(1500),userId: 'user-kn',  userName: 'Karen Ng',    action: 'trusted_route_revoked',  targetSummary: 'TechSupply → Billing (revoked)',
    beforeState: { pattern: { sender: 'TechSupply Co.', document_type: 'Receipt' }, destination: 'Billing', active: true },
    afterState:  { active: false } },
  { id: 'aa-008', timestampIso: t(2880),userId: 'user-001', userName: 'J. Smith',    action: 'folder_created',         targetSummary: 'Jobsite B created under CA',
    afterState:  { id: 'jobsite-b', name: 'Jobsite B', folder_type: 'Jobsite', parent_folder_id: 'ca-state' } },
];
