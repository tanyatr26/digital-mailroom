import type { Envelope, InboxGroup } from '@/src/types';
import { SALES_INBOX_ENVELOPES } from '@/src/mocks/deptHeadData';

// ── Envelopes for Incoming groups ────────────────────────────────

const GROUP1_ENVELOPES: Envelope[] = [
  { id: 'g1-env1', sender: 'BC Construction Supplies', received: 'Nov 12, 2025', documents: [
    { id: 'g1-d1', docId: '441910', title: 'BC Construction — Annual Service Agreement', pages: 4, suggestion: 'r-001', confidence: 0.92, routingHistory: [{ action: 'Scanned', user: 'J. Smith', timestamp: 'Nov 12, 2025 · 9:02am', note: null }, { action: 'Routed to Sales', user: 'J. Smith', timestamp: 'Nov 12, 2025 · 9:05am', note: null }] },
    { id: 'g1-d2', docId: '441911', title: 'BC Construction — Q4 Materials Invoice',      pages: 2, suggestion: 'r-004', confidence: 0.88, routingHistory: [{ action: 'Scanned', user: 'J. Smith', timestamp: 'Nov 12, 2025 · 9:02am', note: null }, { action: 'Routed to Sales', user: 'J. Smith', timestamp: 'Nov 12, 2025 · 9:05am', note: null }] },
    { id: 'g1-d3', docId: '441912', title: 'BC Construction — Site Access Permit',         pages: 1, suggestion: 'r-003', confidence: 0.75, routingHistory: [{ action: 'Scanned', user: 'J. Smith', timestamp: 'Nov 12, 2025 · 9:02am', note: null }, { action: 'Routed to Sales', user: 'J. Smith', timestamp: 'Nov 12, 2025 · 9:05am', note: null }] },
  ]},
  { id: 'g1-env2', sender: 'Pacific Dynamics Ltd', received: 'Nov 12, 2025', documents: [
    { id: 'g1-d4', docId: '441913', title: 'Pacific Dynamics — Partnership Proposal',      pages: 5, suggestion: 'r-002', confidence: 0.87, routingHistory: [{ action: 'Scanned', user: 'J. Smith', timestamp: 'Nov 12, 2025 · 9:02am', note: null }, { action: 'Routed to Sales', user: 'J. Smith', timestamp: 'Nov 12, 2025 · 9:05am', note: null }] },
    { id: 'g1-d5', docId: '441914', title: 'Pacific Dynamics — NDA Renewal',               pages: 2, suggestion: 'r-001', confidence: 0.95, routingHistory: [{ action: 'Scanned', user: 'J. Smith', timestamp: 'Nov 12, 2025 · 9:02am', note: null }, { action: 'Routed to Sales', user: 'J. Smith', timestamp: 'Nov 12, 2025 · 9:05am', note: null }] },
    { id: 'g1-d6', docId: '441915', title: 'Pacific Dynamics — Purchase Order #4421',      pages: 1, suggestion: 'r-004', confidence: 0.91, routingHistory: [{ action: 'Scanned', user: 'J. Smith', timestamp: 'Nov 12, 2025 · 9:02am', note: null }, { action: 'Routed to Sales', user: 'J. Smith', timestamp: 'Nov 12, 2025 · 9:05am', note: null }] },
  ]},
];

const GROUP2_ENVELOPES: Envelope[] = [
  { id: 'g2-env1', sender: 'Northfield Associates', received: 'Nov 12, 2025', documents: [
    { id: 'g2-d1', docId: '441916', title: 'Northfield — Letter of Intent',               pages: 3, suggestion: 'r-002', confidence: 0.83, routingHistory: [{ action: 'Scanned', user: 'J. Smith', timestamp: 'Nov 12, 2025 · 11:28am', note: null }, { action: 'Routed to Sales', user: 'J. Smith', timestamp: 'Nov 12, 2025 · 11:30am', note: null }] },
    { id: 'g2-d2', docId: '441917', title: 'Northfield — Q1 2026 Forecast',               pages: 2, suggestion: 'r-003', confidence: 0.78, routingHistory: [{ action: 'Scanned', user: 'J. Smith', timestamp: 'Nov 12, 2025 · 11:28am', note: null }, { action: 'Routed to Sales', user: 'J. Smith', timestamp: 'Nov 12, 2025 · 11:30am', note: null }] },
  ]},
  { id: 'g2-env2', sender: 'Summit Capital Group', received: 'Nov 12, 2025', documents: [
    { id: 'g2-d3', docId: '441918', title: 'Summit Capital — Investment Proposal',         pages: 6, suggestion: 'r-001', confidence: 0.90, urgent: true, urgency_reason: 'Response required by EOD', routingHistory: [{ action: 'Scanned', user: 'J. Smith', timestamp: 'Nov 12, 2025 · 11:28am', note: null }, { action: 'Routed to Sales', user: 'J. Smith', timestamp: 'Nov 12, 2025 · 11:30am', note: null }] },
    { id: 'g2-d4', docId: '441919', title: 'Summit Capital — Terms & Conditions',          pages: 2, suggestion: 'r-002', confidence: 0.85, routingHistory: [{ action: 'Scanned', user: 'J. Smith', timestamp: 'Nov 12, 2025 · 11:28am', note: null }, { action: 'Routed to Sales', user: 'J. Smith', timestamp: 'Nov 12, 2025 · 11:30am', note: null }] },
  ]},
];

// ── The 5 inbox groups ────────────────────────────────────────────

export const INBOX_GROUPS: InboxGroup[] = [
  {
    id: 'ig-001',
    name: 'Afternoon Batch — Nov 12, 2025',
    arrivedAt: 'Nov 12, 2025 · 11:30am',
    arrivedAtIso: '2025-11-12T11:30',
    docCount: 4,
    status: 'New',
    actionedBy: 'J. Smith',
    envelopes: GROUP2_ENVELOPES,
  },
  {
    id: 'ig-002',
    name: 'Morning Batch — Nov 12, 2025',
    arrivedAt: 'Nov 12, 2025 · 9:05am',
    arrivedAtIso: '2025-11-12T09:05',
    docCount: 6,
    status: 'New',
    actionedBy: 'J. Smith',
    envelopes: GROUP1_ENVELOPES,
  },
  {
    id: 'ig-003',
    name: 'Early Run — Nov 12, 2025',
    arrivedAt: 'Nov 12, 2025 · 8:31am',
    arrivedAtIso: '2025-11-12T08:31',
    docCount: SALES_INBOX_ENVELOPES.reduce((s, e) => s + e.documents.length, 0),
    status: 'In_Progress',
    actionedBy: 'Mike Torres',
    envelopes: SALES_INBOX_ENVELOPES,
  },
  {
    id: 'ig-004',
    name: 'Morning Batch — Nov 11, 2025',
    arrivedAt: 'Nov 11, 2025 · 8:47am',
    arrivedAtIso: '2025-11-11T08:47',
    docCount: 7,
    status: 'Processed',
    actionedBy: 'Mike Torres',
    dispatchedAt: 'Nov 11, 2025 · 10:22am',
    dispatchHistory: [
      { docId: '441870', title: 'Riverdale Corp — Sales Agreement 2026',  recipient: 'Mike Torres', status: 'Dispatched', timestamp: 'Nov 11, 2025 · 10:18am', pages: 6, currentLocation: ['Sales', 'Mike Torres'] },
      { docId: '441871', title: 'Riverdale Corp — Addendum B',            recipient: 'Mike Torres', status: 'Dispatched', timestamp: 'Nov 11, 2025 · 10:18am', pages: 2, currentLocation: [] },
      { docId: '441872', title: 'Clearwater Ltd — Purchase Order #3301',  recipient: 'James Wu',    status: 'Dispatched', timestamp: 'Nov 11, 2025 · 10:19am', pages: 3, currentLocation: ['Sales', 'James Wu'] },
      { docId: '441873', title: 'Clearwater Ltd — Shipping Terms',        recipient: 'James Wu',    status: 'Dispatched', timestamp: 'Nov 11, 2025 · 10:19am', pages: 1, currentLocation: [] },
      { docId: '441874', title: 'Harmon Group — NDA 2025',                recipient: 'Lisa Chen',   status: 'Dispatched', timestamp: 'Nov 11, 2025 · 10:21am', pages: 4, currentLocation: ['Sales', 'Lisa Chen'] },
      { docId: '441875', title: 'Harmon Group — Cover Letter',            recipient: 'Lisa Chen',   status: 'Dispatched', timestamp: 'Nov 11, 2025 · 10:21am', pages: 1, currentLocation: ['Sales', 'Lisa Chen'] },
      { docId: '441876', title: 'Promotional Mailer — Harmon Q4',         recipient: 'Sarah Kim',   status: 'Dispatched', timestamp: 'Nov 11, 2025 · 10:22am', pages: 1, currentLocation: [] },
    ],
    // V2 §10 — Three docs from this Processed batch were returned upstream.
    // Two are explicit returns from downstream admins; the third is an
    // auto-return triggered when Lisa Chen's child-folder admin was marked
    // inactive (V2 §5 — surfacing this scenario here keeps it out of live
    // New / In Progress workspaces, where returned items don't belong).
    // Renders an inline "↩ 3 returned" badge on the inbox row; clicking
    // opens the workspace with these in the pinned Returns section.
    returnedDocs: [
      { docId: '441874', title: 'Harmon Group — NDA 2025',          sender: 'Harmon Group',   pages: 4, returnReason: 'Wrong counterparty — NDA is for Riverdale, not Harmon.', returnedBy: 'Lisa Chen', returnedAt: 'May 17, 2026 · 3:42pm' },
      { docId: '441872', title: 'Clearwater Ltd — Purchase Order #3301', sender: 'Clearwater Ltd', pages: 3, returnReason: 'Belongs to Procurement, not Sales — please reroute.', returnedBy: 'James Wu',  returnedAt: 'May 17, 2026 · 2:11pm' },
      { docId: '441907', title: 'Meridian — Renewal Addendum (was for Lisa Chen)', sender: 'Meridian Partners', pages: 2, returnReason: 'Lisa Chen admin inactive — auto-returned when folder admin was marked inactive.', returnedBy: 'System', returnedAt: 'May 14, 2026 · 8:00am' },
    ],
  },
  {
    id: 'ig-005',
    name: 'Morning Batch — Nov 10, 2025',
    arrivedAt: 'Nov 10, 2025 · 9:15am',
    arrivedAtIso: '2025-11-10T09:15',
    docCount: 5,
    status: 'Processed',
    actionedBy: 'Mike Torres',
    dispatchedAt: 'Nov 10, 2025 · 11:05am',
    dispatchHistory: [
      { docId: '441860', title: 'Vantage Realty — Listing Agreement',     recipient: 'Mike Torres', status: 'Dispatched', timestamp: 'Nov 10, 2025 · 11:01am', pages: 5, currentLocation: [] },
      { docId: '441861', title: 'Vantage Realty — Commission Schedule',   recipient: 'Mike Torres', status: 'Dispatched', timestamp: 'Nov 10, 2025 · 11:01am', pages: 2, currentLocation: ['Sales', 'Mike Torres'] },
      { docId: '441862', title: 'Sunrise Brands — Vendor Agreement',      recipient: 'James Wu',    status: 'Dispatched', timestamp: 'Nov 10, 2025 · 11:03am', pages: 4, currentLocation: [] },
      { docId: '441863', title: 'Sunrise Brands — Product Catalogue',     recipient: 'Sarah Kim',   status: 'Dispatched', timestamp: 'Nov 10, 2025 · 11:04am', pages: 3, currentLocation: ['Sales', 'Sarah Kim'] },
      { docId: '441864', title: 'Cover Letter — Sunrise Brands',          recipient: 'Sarah Kim',   status: 'Dispatched', timestamp: 'Nov 10, 2025 · 11:05am', pages: 1, currentLocation: ['Sales', 'Sarah Kim'] },
    ],
  },
];
