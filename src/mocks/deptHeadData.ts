import type { Envelope } from '@/src/types';

// Folders the mock Folder_Admin user admins (in-order list, drives the
// folder switcher in the workspace header). Mirrors MOCK_USER.folders.
export const FOLDER_ADMIN_FOLDERS: string[] = ['sales', 'jobsite-a', 'ops-dept'];

// Envelopes currently sitting in Sales. Each doc.suggestion targets a Sales
// child folder (r-001…r-004). Used as the demo inbox payload when a user
// opens the Sales workspace.
export const SALES_INBOX_ENVELOPES: Envelope[] = [
  { id: 'si-env1', sender: 'Westfield Properties LLC', received: 'Nov 12, 2025', documents: [
    {
      id: 'si-d1', docId: '441892',
      title: 'Westfield — Sales Contract Lot 14B',
      pages: 6, suggestion: 'r-001', confidence: 0.88,
      urgent: true, urgency_reason: 'Signed contract — deadline tomorrow',
      labelStatus: 'ai_suggested',
      document_type_id: 'dt-sales-contract',
      inboxSource: { kind: 'via', folderName: 'Sales Department' },
      routingHistory: [
        { action: 'Scanned',         user: 'J. Smith', timestamp: 'Nov 11, 2025 · 7:55am', note: null },
        { action: 'Routed to Sales', user: 'J. Smith', timestamp: 'Nov 12, 2025 · 8:31am', note: null },
      ],
    },
  ]},
  { id: 'si-env2', sender: 'Apex Commercial Group', received: 'Nov 12, 2025', documents: [
    {
      id: 'si-d2', docId: '441901',
      title: 'Apex Commercial — Q4 Proposal',
      pages: 4, suggestion: 'r-001', confidence: 0.91,
      document_type_id: 'dt-proposal',
      inboxSource: { kind: 'via', folderName: 'Sales Department' },
      routingHistory: [
        { action: 'Scanned',         user: 'J. Smith', timestamp: 'Nov 12, 2025 · 8:22am', note: null },
        { action: 'Routed to Sales', user: 'J. Smith', timestamp: 'Nov 12, 2025 · 9:05am', note: null },
      ],
    },
    {
      id: 'si-d3', docId: '441902',
      title: 'Apex — Terms of Service Amendment',
      pages: 2, suggestion: 'r-002', confidence: 0.85,
      document_type_id: 'dt-amendment',
      inboxSource: { kind: 'personal' },
      routingHistory: [
        { action: 'Scanned',         user: 'J. Smith', timestamp: 'Nov 12, 2025 · 8:22am', note: null },
        { action: 'Routed to Sales', user: 'J. Smith', timestamp: 'Nov 12, 2025 · 9:05am', note: null },
      ],
    },
  ]},
  { id: 'si-env3', sender: 'Meridian Partners', received: 'Nov 12, 2025', documents: [
    {
      id: 'si-d4', docId: '441903',
      title: 'Meridian — Account Renewal 2026',
      pages: 3, suggestion: 'r-003', confidence: 0.79,
      document_type_id: 'dt-renewal',
      inboxSource: { kind: 'uploaded' },
      routingHistory: [
        { action: 'Scanned',         user: 'J. Smith', timestamp: 'Nov 12, 2025 · 9:14am', note: null },
        { action: 'Routed to Sales', user: 'J. Smith', timestamp: 'Nov 12, 2025 · 10:02am', note: null },
      ],
    },
  ]},
  { id: 'si-env4', sender: 'GreenLeaf Retail Corp', received: 'Nov 11, 2025', documents: [
    {
      id: 'si-d5', docId: '441895',
      title: 'GreenLeaf — Purchase Order #7823',
      pages: 2, suggestion: 'r-002', confidence: 0.94,
      document_type_id: 'dt-purchase-order',
      inboxSource: { kind: 'personal' },
      routingHistory: [
        { action: 'Scanned',         user: 'J. Smith', timestamp: 'Nov 11, 2025 · 8:33am', note: null },
        { action: 'Routed to Sales', user: 'J. Smith', timestamp: 'Nov 11, 2025 · 9:47am', note: null },
      ],
    },
  ]},
  // V2 §5 — The Lisa Chen inactive-admin auto-return scenario is intentionally
  // NOT included in the live Sales inbox envelopes (New / In Progress workspaces
  // never show returned items). It surfaces instead as a returnedDoc on the
  // Processed batch ig-004 — see inboxData.ts.
];

// Demo envelopes for the Jobsite A workspace (depth-3 demo). Documents target
// the two child Department folders: ops-dept and safety-dept.
export const JOBSITE_A_INBOX_ENVELOPES: Envelope[] = [
  { id: 'ja-env1', sender: 'ABC Construction Inc.', received: 'Nov 12, 2025', documents: [
    {
      id: 'ja-d1', docId: '441920',
      title: 'Site Safety Audit — Lot 9A',
      pages: 4, suggestion: 'safety-dept', confidence: 0.93,
      document_type_id: 'dt-permit',
      inboxSource: { kind: 'via', folderName: 'CA' },
      routingHistory: [
        { action: 'Scanned',          user: 'J. Smith', timestamp: 'Nov 12, 2025 · 8:11am', note: null },
        { action: 'Routed to Jobsites', user: 'J. Smith', timestamp: 'Nov 12, 2025 · 8:14am', note: null },
        { action: 'Routed to CA',       user: 'J. Smith', timestamp: 'Nov 12, 2025 · 8:18am', note: null },
        { action: 'Routed to Jobsite A',user: 'Jane Doe', timestamp: 'Nov 12, 2025 · 9:02am', note: null },
      ],
    },
  ]},
  { id: 'ja-env2', sender: 'CalOSHA', received: 'Nov 11, 2025', documents: [
    {
      id: 'ja-d2', docId: '441921',
      title: 'OSHA Inspection Notice',
      pages: 2, suggestion: 'safety-dept', confidence: 0.97,
      urgent: true, urgency_reason: 'Response required within 7 days',
      document_type_id: 'dt-tax-notice',
      inboxSource: { kind: 'via', folderName: 'CA' },
      routingHistory: [
        { action: 'Scanned',           user: 'J. Smith', timestamp: 'Nov 11, 2025 · 9:21am', note: null },
        { action: 'Routed to Jobsites', user: 'J. Smith', timestamp: 'Nov 11, 2025 · 9:24am', note: null },
        { action: 'Routed to CA',       user: 'J. Smith', timestamp: 'Nov 11, 2025 · 9:30am', note: null },
        { action: 'Routed to Jobsite A',user: 'Jane Doe', timestamp: 'Nov 11, 2025 · 10:14am', note: null },
      ],
    },
  ]},
];

// Demo envelopes for the Operations Dept (depth-4 leaf) workspace. Documents
// have no suggestion — leaf admins terminate via Process as Download or Return.
export const OPS_DEPT_INBOX_ENVELOPES: Envelope[] = [
  { id: 'od-env1', sender: 'Acme Equipment Rentals', received: 'Nov 12, 2025', documents: [
    {
      id: 'od-d1', docId: '441930',
      title: 'Equipment Lease Schedule — Q4',
      pages: 3, confidence: 0,
      document_type_id: 'dt-purchase-order',
      inboxSource: { kind: 'via', folderName: 'Jobsite A' },
      routingHistory: [
        { action: 'Scanned',             user: 'J. Smith', timestamp: 'Nov 12, 2025 · 8:32am', note: null },
        { action: 'Routed to Jobsites',  user: 'J. Smith', timestamp: 'Nov 12, 2025 · 8:35am', note: null },
        { action: 'Routed to CA',        user: 'J. Smith', timestamp: 'Nov 12, 2025 · 8:40am', note: null },
        { action: 'Routed to Jobsite A', user: 'Jane Doe', timestamp: 'Nov 12, 2025 · 9:11am', note: null },
        { action: 'Routed to Operations',user: 'J. Smith', timestamp: 'Nov 12, 2025 · 9:48am', note: null },
      ],
    },
  ]},
];

// Map folder_id → mock envelopes for that folder's inbox. Falls back to empty.
export function getInboxEnvelopesFor(folderId: string): Envelope[] {
  if (folderId === 'sales')      return SALES_INBOX_ENVELOPES;
  if (folderId === 'jobsite-a')  return JOBSITE_A_INBOX_ENVELOPES;
  if (folderId === 'ops-dept')   return OPS_DEPT_INBOX_ENVELOPES;
  return [];
}
