// Mock document archive index. Each row is a document somewhere in the org
// tree (or in junk/discarded). The page filters on these in-memory.

// State enum drives the "Filter by state" dropdown on the Document Archive
// page. Every searchable doc carries exactly one state; results filter on
// the user's currently-checked set.
export type DocState = 'sent' | 'received' | 'printed' | 'junk' | 'discarded';

export interface SearchableDoc {
  docId: string;
  title: string;
  sender: string;
  documentTypeId: string;
  documentTypeName: string;
  urgent: boolean;
  scannedAtIso: string;
  lastActionIso: string;
  lastActionLabel: string;        // e.g. "Routed · Sarah Chen"
  folderPath: string;             // e.g. "Operations > CA > Jobsite A"
  currentFolderId: string;
  state: DocState;
  isReturned: boolean;
  isCompleted: boolean;
}

export const DOC_STATE_LABEL: Record<DocState, string> = {
  sent:      'Sent',
  received:  'Received',
  printed:   'Printed',
  junk:      'Junk',
  discarded: 'Discarded',
};

export const SEARCHABLE_DOCS: SearchableDoc[] = [
  {
    docId: '441892', title: 'Westfield Sales Contract Lot 14B', sender: 'Westfield Properties LLC',
    documentTypeId: 'dt-sales-contract', documentTypeName: 'Sales Contract',
    urgent: true, scannedAtIso: '2025-11-11T07:55:00', lastActionIso: '2025-11-12T08:31:00',
    lastActionLabel: 'Routed · Mike Torres',
    folderPath: 'Sales > Mike Torres', currentFolderId: 'r-001',
    state: 'sent',
    isReturned: false, isCompleted: false,
  },
  {
    docId: '441888', title: 'Quarterly Tax Notice — Final Demand', sender: 'State Dept of Revenue',
    documentTypeId: 'dt-tax-notice', documentTypeName: 'Tax Notice',
    urgent: true, scannedAtIso: '2025-11-11T07:51:00', lastActionIso: '2025-11-12T09:14:00',
    lastActionLabel: 'Routed · Sarah Chen',
    folderPath: 'Payroll', currentFolderId: 'payroll',
    state: 'sent',
    isReturned: false, isCompleted: false,
  },
  {
    docId: '441885', title: 'TechSupply Hardware Receipt #88291', sender: 'TechSupply Co.',
    documentTypeId: 'dt-receipt', documentTypeName: 'Receipt',
    urgent: false, scannedAtIso: '2025-11-12T08:06:00', lastActionIso: '2025-11-12T08:06:00',
    lastActionLabel: 'Auto-routed · TRUSTED',
    folderPath: 'Billing', currentFolderId: 'billing',
    state: 'printed',
    isReturned: false, isCompleted: true,
  },
  {
    docId: '441920', title: 'Site Safety Audit — Lot 9A', sender: 'ABC Construction Inc.',
    documentTypeId: 'dt-permit', documentTypeName: 'Permit',
    urgent: false, scannedAtIso: '2025-11-12T08:11:00', lastActionIso: '2025-11-12T09:02:00',
    lastActionLabel: 'Routed · Jane Doe',
    folderPath: 'Jobsites > CA > Jobsite A > Safety', currentFolderId: 'safety-dept',
    state: 'sent',
    isReturned: false, isCompleted: false,
  },
  {
    docId: '441921', title: 'OSHA Inspection Notice', sender: 'CalOSHA',
    documentTypeId: 'dt-tax-notice', documentTypeName: 'Tax Notice',
    urgent: true, scannedAtIso: '2025-11-11T09:21:00', lastActionIso: '2025-11-11T10:14:00',
    lastActionLabel: 'Routed · Jane Doe',
    folderPath: 'Jobsites > CA > Jobsite A > Safety', currentFolderId: 'safety-dept',
    state: 'sent',
    isReturned: false, isCompleted: false,
  },
  {
    docId: '441890', title: 'New Hire — Enrollment Forms', sender: 'Healthcare Benefits Admin',
    documentTypeId: 'dt-enrollment-form', documentTypeName: 'Enrollment Form',
    urgent: false, scannedAtIso: '2025-11-11T07:53:00', lastActionIso: '2025-11-11T10:05:00',
    lastActionLabel: 'Routed · Sarah Doe',
    folderPath: 'Enrollments > Karen Ng', currentFolderId: 'enrollments',
    state: 'printed',
    isReturned: false, isCompleted: true,
  },
  {
    docId: '441891', title: 'Plan Comparison Sheet', sender: 'Healthcare Benefits Admin',
    documentTypeId: 'dt-cover-letter', documentTypeName: 'Cover Letter',
    urgent: false, scannedAtIso: '2025-11-11T07:53:00', lastActionIso: '2025-11-11T09:22:00',
    lastActionLabel: 'Routed · J. Smith',
    folderPath: 'Enrollments', currentFolderId: 'enrollments',
    state: 'sent',
    isReturned: false, isCompleted: false,
  },
  {
    docId: '441895', title: 'GreenLeaf — Purchase Order #7823', sender: 'GreenLeaf Retail Corp',
    documentTypeId: 'dt-purchase-order', documentTypeName: 'Purchase Order',
    urgent: false, scannedAtIso: '2025-11-11T08:33:00', lastActionIso: '2025-11-11T09:47:00',
    lastActionLabel: 'Routed · James Wu',
    folderPath: 'Sales > James Wu', currentFolderId: 'r-002',
    state: 'sent',
    isReturned: false, isCompleted: false,
  },
  {
    docId: '441880', title: 'Health Plan Renewal — Group B', sender: 'Benefits Admin',
    documentTypeId: 'dt-renewal', documentTypeName: 'Renewal',
    urgent: false, scannedAtIso: '2025-11-11T08:00:00', lastActionIso: '2025-11-11T09:46:00',
    lastActionLabel: 'Completed · Lisa Park',
    folderPath: 'Benefits', currentFolderId: 'benefits',
    state: 'printed',
    isReturned: false, isCompleted: true,
  },
  // ── Received: SA's personal inbox docs. These appear in /inbox AND here
  // under the Received state. Lives in SA's own folder (sales root).
  {
    docId: '442001', title: 'Acme HR — Compliance Update Letter', sender: 'Acme HR Services',
    documentTypeId: 'dt-cover-letter', documentTypeName: 'Cover Letter',
    urgent: false, scannedAtIso: '2026-05-17T08:12:00', lastActionIso: '2026-05-17T08:12:00',
    lastActionLabel: 'Scanned · awaiting routing',
    folderPath: 'Sales', currentFolderId: 'sales',
    state: 'received',
    isReturned: false, isCompleted: false,
  },
  {
    docId: '442002', title: 'OSHA Annual Reporting Reminder', sender: 'CalOSHA',
    documentTypeId: 'dt-tax-notice', documentTypeName: 'Tax Notice',
    urgent: true, scannedAtIso: '2026-05-17T09:30:00', lastActionIso: '2026-05-17T09:30:00',
    lastActionLabel: 'Scanned · awaiting routing',
    folderPath: 'Jobsites > CA > Jobsite A', currentFolderId: 'jobsite-a',
    state: 'received',
    isReturned: false, isCompleted: false,
  },
  // ── Junk: marked as junk by the workroom or auto-classified
  {
    docId: '441801', title: 'Mailbox Move Promo — Lawn Service Mass Mailer', sender: 'GreenLawn Pros',
    documentTypeId: 'dt-cover-letter', documentTypeName: 'Cover Letter',
    urgent: false, scannedAtIso: '2026-05-15T11:14:00', lastActionIso: '2026-05-15T11:18:00',
    lastActionLabel: 'Sent to Junk · J. Smith',
    folderPath: 'Junk', currentFolderId: 'junk',
    state: 'junk',
    isReturned: false, isCompleted: false,
  },
  {
    docId: '441802', title: 'Vendor Solicitation — Cable Upgrade Brochure', sender: 'FiberNet Co.',
    documentTypeId: 'dt-cover-letter', documentTypeName: 'Cover Letter',
    urgent: false, scannedAtIso: '2026-05-16T13:42:00', lastActionIso: '2026-05-16T13:42:00',
    lastActionLabel: 'Sent to Junk · Maria Santos',
    folderPath: 'Junk', currentFolderId: 'junk',
    state: 'junk',
    isReturned: false, isCompleted: false,
  },
  // ── Discarded: soft-deleted from the workroom
  {
    docId: '441777', title: 'Duplicate Renewal Notice — superseded', sender: 'Healthcare Benefits Admin',
    documentTypeId: 'dt-renewal', documentTypeName: 'Renewal',
    urgent: false, scannedAtIso: '2026-05-14T15:05:00', lastActionIso: '2026-05-14T15:08:00',
    lastActionLabel: 'Discarded · Tom Park',
    folderPath: 'Discarded', currentFolderId: 'discarded',
    state: 'discarded',
    isReturned: false, isCompleted: false,
  },
  {
    docId: '441778', title: 'Test Scan — accidentally captured', sender: 'Mailroom intake',
    documentTypeId: 'dt-cover-letter', documentTypeName: 'Cover Letter',
    urgent: false, scannedAtIso: '2026-05-15T07:21:00', lastActionIso: '2026-05-15T07:23:00',
    lastActionLabel: 'Discarded · J. Smith',
    folderPath: 'Discarded', currentFolderId: 'discarded',
    state: 'discarded',
    isReturned: false, isCompleted: false,
  },
];
