import type { Folder, Envelope, TrustedRoute, RoutingHistoryEntry } from '@/src/types';

// V2: One unified folder tree. parent_folder_id === null marks a root folder.
// In step 2 the workspace is depth-agnostic — it renders whatever folder's
// direct children, regardless of where in the tree it sits.
export const FOLDERS: Folder[] = [
  // ── Root folders ────────────────────────────────────────────────
  // All root folders were created by the SA (J. Smith / user-001). The
  // SA later reassigned primary admin to FAs in most cases — admin_user_id
  // can change, but created_by_user_id is the stable signal Folder
  // Assignments + Folder Tree's owned action menu key off.
  { id: 'sales',        name: 'Sales',        folder_type: 'Department', parent_folder_id: null, admin_user_id: 'user-001', created_by_user_id: 'user-001' },
  { id: 'enrollments',  name: 'Enrollments',  folder_type: 'Department', parent_folder_id: null, admin_user_id: 'user-kn',  created_by_user_id: 'user-001' },
  { id: 'payroll',      name: 'Payroll',      folder_type: 'Department', parent_folder_id: null, admin_user_id: 'user-sc',  created_by_user_id: 'user-001' },
  { id: 'billing',      name: 'Billing',      folder_type: 'Department', parent_folder_id: null, admin_user_id: 'user-dl',  created_by_user_id: 'user-001' },
  { id: 'claims',       name: 'Claims',       folder_type: 'Department', parent_folder_id: null, admin_user_id: 'user-jp',  created_by_user_id: 'user-001' },
  { id: 'benefits',     name: 'Benefits',     folder_type: 'Department', parent_folder_id: null, admin_user_id: 'user-lp',  created_by_user_id: 'user-001' },
  { id: 'banking',      name: 'Banking',      folder_type: 'Finance',    parent_folder_id: null, admin_user_id: 'user-dl',  created_by_user_id: 'user-001' },
  { id: 'garnishments', name: 'Garnishments', folder_type: 'Finance',    parent_folder_id: null, admin_user_id: 'user-sc',  created_by_user_id: 'user-001' },
  { id: 'jobsites',     name: 'Jobsites',     folder_type: 'Operations', parent_folder_id: null, admin_user_id: 'user-001', created_by_user_id: 'user-001' },
  { id: 'shipping',     name: 'Shipping',     folder_type: 'Operations', parent_folder_id: null, admin_user_id: 'user-rp',  created_by_user_id: 'user-001' },
  // Demo: Q3 Closings was archived mid-day. Stays in the data so the inline
  // finalize-error pattern (Brief V2 §7) has something to react to.
  { id: 'closings-q3', name: 'Q3 Closings',   folder_type: 'Department', parent_folder_id: null, created_by_user_id: 'user-001', is_archived: true },

  // ── Sales subfolders (depth 2) ──────────────────────────────────
  // Each recipient mailbox was created during that admin's onboarding by
  // that admin themselves — not by the SA above. Folder Tree's owned-menu
  // gate is "created_by_user_id === current user", so the SA sees these
  // as Notify-only rows (someone else's responsibility).
  { id: 'r-001', name: 'Mike Torres', folder_type: 'Internal Mailbox', parent_folder_id: 'sales', admin_user_id: 'user-mt', created_by_user_id: 'user-mt', recipient_type: 'personal' },
  { id: 'r-002', name: 'James Wu',    folder_type: 'Internal Mailbox', parent_folder_id: 'sales', admin_user_id: 'user-jw', created_by_user_id: 'user-jw', recipient_type: 'personal' },
  { id: 'r-003', name: 'Lisa Chen',   folder_type: 'Internal Mailbox', parent_folder_id: 'sales', admin_user_id: 'user-lc', created_by_user_id: 'user-lc', admin_status: 'inactive_admin', recipient_type: 'personal' },
  { id: 'r-004', name: 'Sarah Kim',   folder_type: 'Internal Mailbox', parent_folder_id: 'sales', admin_user_id: 'user-sk', created_by_user_id: 'user-sk', recipient_type: 'personal' },

  // ── Depth-3 demo branch under Jobsites ─────────────────────────
  // Jobsites (root) → CA (State) → Jobsite A (Jobsite) → Operations / Safety
  // CA was created by Karen Ng (SA) then reassigned admin to Jane Doe.
  // Jobsite A was created by Jane Doe (FA of CA). The two leaf dept folders
  // were created by Jane Doe before she handed Jobsite A off to J. Smith.
  { id: 'ca-state',    name: 'CA',         folder_type: 'State',      parent_folder_id: 'jobsites',  admin_user_id: 'user-jd',  created_by_user_id: 'user-kn' },
  { id: 'jobsite-a',   name: 'Jobsite A',  folder_type: 'Jobsite',    parent_folder_id: 'ca-state',  admin_user_id: 'user-001', created_by_user_id: 'user-jd' },
  { id: 'ops-dept',    name: 'Operations', folder_type: 'Department', parent_folder_id: 'jobsite-a', admin_user_id: 'user-001', created_by_user_id: 'user-jd' },
  { id: 'safety-dept', name: 'Safety',     folder_type: 'Department', parent_folder_id: 'jobsite-a', admin_user_id: 'user-sc',  created_by_user_id: 'user-jd' },
];

export function getChildFolders(parentId: string | null): Folder[] {
  return FOLDERS.filter(f => (f.parent_folder_id ?? null) === parentId);
}

export function getRootFolders(): Folder[] {
  return getChildFolders(null);
}

export function findFolder(id: string): Folder | undefined {
  return FOLDERS.find(f => f.id === id);
}

const scan = (timestamp: string, user = 'J. Smith'): RoutingHistoryEntry =>
  ({ action: 'Scanned', user, timestamp, note: null });

export const INITIAL_ENVELOPES: Envelope[] = [
  { id: 'env1', sender: 'ABC Construction Inc.', received: 'Nov 12, 2025', documents: [
    { id: 'd1-1', docId: '441882', title: 'ABC Construction — Q3 Invoices',           pages: 3, suggestion: 'jobsites',    confidence: 0.94,
      routingHistory: [scan('Nov 12, 2025 · 8:04am')] },
    { id: 'd1-2', docId: '441883', title: 'Site Permit Renewal — Project Phoenix',     pages: 2, suggestion: 'jobsites',    confidence: 0.88,
      routingHistory: [scan('Nov 12, 2025 · 8:04am')] },
    { id: 'd1-3', docId: '441884', title: 'Cover Letter',                              pages: 1, suggestion: 'jobsites',    confidence: 0.62,
      routingHistory: [scan('Nov 12, 2025 · 8:04am')] },
  ]},
  { id: 'env2', sender: 'TechSupply Co.', received: 'Nov 12, 2025', documents: [
    { id: 'd2-1', docId: '441885', title: 'TechSupply — Hardware Receipt #88291',      pages: 2, suggestion: 'billing',     confidence: 0.96,
      routingHistory: [
        scan('Nov 12, 2025 · 8:06am'),
        { action: 'Routed to Billing', user: 'J. Smith', timestamp: 'Nov 12, 2025 · 8:06am', note: null },
      ]},
    { id: 'd2-2', docId: '441886', title: 'TechSupply — Software License Agreement',   pages: 4, suggestion: 'billing',     confidence: 0.92,
      routingHistory: [scan('Nov 12, 2025 · 8:06am')] },
  ]},
  { id: 'env3', sender: 'Global Marketing Group', received: 'Nov 12, 2025', documents: [
    { id: 'd3-1', docId: '441887', title: 'Promotional Brochure',                      pages: 1, suggestion: 'junk',        confidence: 0.89,
      routingHistory: [scan('Nov 12, 2025 · 8:09am')] },
  ]},
  { id: 'env4', sender: 'State Dept of Revenue', received: 'Nov 11, 2025', documents: [
    { id: 'd4-1', docId: '441888', title: 'Quarterly Tax Notice — Final Demand',       pages: 3, suggestion: 'payroll',     confidence: 0.97, urgent: true, urgency_reason: 'Final demand notice', labelStatus: 'ai_suggested',
      routingHistory: [scan('Nov 11, 2025 · 7:51am')] },
    { id: 'd4-2', docId: '441889', title: 'Withholding Form Update',                   pages: 2, suggestion: 'payroll',     confidence: 0.91,
      routingHistory: [scan('Nov 11, 2025 · 7:51am')] },
  ]},
  { id: 'env5', sender: 'Healthcare Benefits Admin', received: 'Nov 11, 2025', documents: [
    { id: 'd5-1', docId: '441890', title: 'New Hire — Enrollment Forms',               pages: 5, suggestion: 'enrollments', confidence: 0.95,
      routingHistory: [
        scan('Nov 11, 2025 · 7:53am'),
        { action: 'Routed to Enrollments', user: 'J. Smith',  timestamp: 'Nov 11, 2025 · 9:22am', note: null },
        { action: 'Routed to Karen Ng',    user: 'Sarah Doe', timestamp: 'Nov 11, 2025 · 10:05am', note: null },
      ]},
    { id: 'd5-2', docId: '441891', title: 'Plan Comparison Sheet',                     pages: 2, suggestion: 'enrollments', confidence: 0.43,
      routingHistory: [
        scan('Nov 11, 2025 · 7:53am'),
        { action: 'Routed to Enrollments', user: 'J. Smith', timestamp: 'Nov 11, 2025 · 9:22am', note: null },
      ]},
  ]},
  { id: 'env6', sender: 'Westfield Properties LLC', received: 'Nov 11, 2025', documents: [
    { id: 'd6-1', docId: '441892', title: 'Westfield — Sales Contract Lot 14B',        pages: 6, suggestion: 'sales',       confidence: 0.68, labelStatus: 'ai_suggested',
      routingHistory: [
        scan('Nov 11, 2025 · 7:55am'),
        { action: 'Routed to Sales', user: 'J. Smith', timestamp: 'Nov 12, 2025 · 8:31am', note: null },
      ]},
  ]},
  // Brief V2 §21 — AI suggestion points at an archived folder (Q3 Closings)
  // so the doc lands in the Ungrouped bucket immediately. No dispatchedTo;
  // worker must drag it to a live folder before finalize.
  { id: 'env7', sender: 'Closings Service Co.', received: 'May 15, 2026', documents: [
    { id: 'd7-1', docId: '441895', title: 'Q3 Closings Package — Lot 14B', pages: 4, suggestion: 'closings-q3', confidence: 0.94,
      routingHistory: [scan('May 15, 2026 · 9:11am')] },
  ]},
  // Brief V2 §11 — AI auto-route demo. Three docs Auto-routed at ≥99%
  // confidence into Payroll + Sales for the Afternoon Run workspace.
  // Each appears as a dispatched/strikethrough card with the green
  // "Auto · 99%" badge and "Auto-routed by AI" subtext.
  { id: 'env8', sender: 'State Dept of Revenue', received: 'Nov 12, 2025', documents: [
    { id: 'd8-1', docId: '441896', title: 'Payroll Tax Filing — Q3 Confirmation', pages: 2, suggestion: 'payroll', confidence: 0.99,
      dispatchedTo: 'payroll', autoRouted: true, autoRoutedByAi: true,
      routingHistory: [
        scan('Nov 12, 2025 · 2:15pm'),
        { action: 'Auto-routed to Payroll by AI', user: 'AI', timestamp: 'Nov 12, 2025 · 2:15pm', note: 'Confidence 99%' },
      ]},
  ]},
  // Brief V2 §11 — Ungrouped seed. Two docs the AI couldn't confidently
  // route: one cold-start with no suggestion at all, one low-confidence
  // (<50%) against a valid folder. Both land in Ungrouped on render.
  { id: 'env10', sender: 'Independent Logistics Co.', received: 'Nov 12, 2025', documents: [
    { id: 'd10-1', docId: '441899', title: 'Shipping Notice — Unknown Recipient', pages: 1, confidence: 0.18,
      routingHistory: [scan('Nov 12, 2025 · 2:15pm')] },
    { id: 'd10-2', docId: '441900', title: 'Generic Correspondence — Address Verification', pages: 2, suggestion: 'enrollments', confidence: 0.42,
      routingHistory: [scan('Nov 12, 2025 · 2:15pm')] },
  ]},
  { id: 'env9', sender: 'Westfield Properties LLC', received: 'Nov 12, 2025', documents: [
    { id: 'd9-1', docId: '441897', title: 'Westfield Sales Closing Notice — Lot 27', pages: 3, suggestion: 'sales', confidence: 0.99,
      dispatchedTo: 'sales', autoRouted: true, autoRoutedByAi: true,
      routingHistory: [
        scan('Nov 12, 2025 · 2:15pm'),
        { action: 'Auto-routed to Sales by AI', user: 'AI', timestamp: 'Nov 12, 2025 · 2:15pm', note: 'Confidence 99%' },
      ]},
    { id: 'd9-2', docId: '441898', title: 'Westfield Title Transfer — Lot 27', pages: 5, suggestion: 'sales', confidence: 0.99,
      dispatchedTo: 'sales', autoRouted: true, autoRoutedByAi: true,
      routingHistory: [
        scan('Nov 12, 2025 · 2:15pm'),
        { action: 'Auto-routed to Sales by AI', user: 'AI', timestamp: 'Nov 12, 2025 · 2:15pm', note: 'Confidence 99%' },
      ]},
  ]},
];

export const INITIAL_TRUSTED_ROUTES: TrustedRoute[] = [
  {
    id: 'tr-001',
    pattern: { sender: 'TechSupply Co.', document_type: 'Receipt' },
    destination: 'billing',
    markedBy: 'Admin',
    markedAt: 'Nov 10, 2025',
    isActive: true,
    usageCount: 2,
  },
];
