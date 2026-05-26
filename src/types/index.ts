// V2: Folder replaces Department. admin_status drives the inactive-admin
// succession flow (Brief V2 §5): a folder marked `inactive_admin` is still
// visible in the tree but blocked as a routing target until reassigned.
// is_archived feeds the inline finalize-error pattern (Brief V2 §7) — when
// true, the worker workspace blocks finalize and reverts affected docs.
export type FolderAdminStatus = 'active' | 'inactive_admin';
// V2 §3 — Group is the default; Personal flags a recipient folder bound to
// one admin's inbox so source-tag pills can render a [Personal] badge.
export type RecipientType = 'group' | 'personal';
export interface Folder {
  id: string;
  name: string;
  folder_type: string;        // Free-form label chosen by creator (e.g. "Department", "Jobsite", "Internal Mailbox")
  admin_user_id?: string;
  // V2 — separate from the current admin. Folder Assignments + Folder Tree
  // owned-menu gating both key off who created the folder, so that an SA
  // who reassigned admin to someone else still owns / can manage the
  // folder. Stays fixed across admin reassignments.
  created_by_user_id?: string;
  parent_folder_id?: string | null;
  admin_status?: FolderAdminStatus;   // Defaults to 'active' when undefined
  is_archived?: boolean;
  recipient_type?: RecipientType;     // Defaults to 'group' when undefined
}

export interface RoutingHistoryEntry {
  action: string;
  user: string;
  timestamp: string;
  note?: string | null;
}

// V2 §3.0 — Source tag rendered top-right of doc cards in the Folder Admin
// inbox. `via` traces an upstream folder hop; `personal`/`uploaded` mark the
// admin's own routing surfaces. Returned docs are flagged via `isReturned`
// (their own state) and don't carry an inboxSource.
export type InboxSource =
  | { kind: 'via'; folderName: string }
  | { kind: 'personal' }
  | { kind: 'uploaded'; uploadedBy?: string };

export interface Document {
  id: string;
  docId?: string;
  routingHistory?: RoutingHistoryEntry[];
  returnReason?: string;
  title: string;
  pages: number;
  suggestion?: string;
  confidence: number;
  inboxSource?: InboxSource;
  urgent?: boolean;
  urgency_reason?: string;
  // Detection trigger surfaced behind the (i) icon on urgent cards. When
  // absent, the urgency_reason is used as a fallback.
  urgency_trigger?: string;
  manualRoute?: boolean;
  pageRange?: [number, number];
  dispatchedTo?: string;
  released?: boolean;
  isCopy?: boolean;
  autoRouted?: boolean;
  // Brief V2 §11 — AI auto-route state. Distinguishes AI-confidence
  // auto-routes from trusted-rule auto-routes so the doc card can swap
  // its badge ("Auto · 99%") and subtext ("Auto-routed by AI") while
  // sharing the rest of the dispatched-card layout.
  autoRoutedByAi?: boolean;
  trustedRouteId?: string;
  // V2: label_status canonical values are undefined | ai_suggested | printed.
  labelStatus?: 'printed' | 'ai_suggested';
  labelDate?: string;
  labelRecipient?: string;
  labelRoute?: string;
  document_type_id?: string;
  isReturned?: boolean;
  // V2 §8 — denormalized return metadata for the Returns card display.
  returnedBy?: string;
  returnedAt?: string;
  // Brief V2 §7 — worker workspace flags docs whose original destination was
  // archived between routing and finalize. Card surfaces a [FOLDER ARCHIVED] tag.
  folderArchivedFlag?: boolean;
  // Brief V2 §5 — docs auto-returned to the parent when a child folder admin
  // is marked inactive carry this tag (e.g. "Returned — Lisa Chen admin inactive").
  inactiveReturnLabel?: string;
}

export interface Envelope {
  id: string;
  sender: string;
  received: string;
  documents: Document[];
}

export interface TrustedRoute {
  id: string;
  pattern: {
    sender: string;
    document_type: string;
  };
  destination: string;
  markedBy: string;
  markedAt: string;
  isActive: boolean;
  usageCount: number;
}

export interface Toast {
  id: number;
  message: string;
  star?: boolean;
}

export interface LabelData {
  labelStatus: 'printed';
  labelDate: string;
  labelRecipient: string;
  labelRoute: string;
}

export type DragState =
  | { bulk: false; envelopeId: string; doc: Document }
  | { bulk: true; items: Array<{ envelopeId: string; doc: Document }> };

export interface BulkLabelUpdate {
  envelopeId: string;
  docId: string;
  labelStatus: 'printed';
  labelDate: string;
  labelRecipient: string;
  labelRoute: string;
}

export interface SplitGroup {
  start: number;
  end: number;
  folder: string;
}

export interface EnvelopeDoc {
  doc: Document;
  envelope: Envelope;
}

// V2: Partial_Failure was removed — finalize-time failures are now caught
// inline in the worker workspace (Brief V2 §7).
// V2 §8 — 'Queued' replaces 'Pending' for runs not yet picked up. The other
// two states (In_Progress, Released) are unchanged.
export type MailRunStatus =
  | 'Queued'
  | 'In_Progress'
  | 'Released';

// V2 §6 — Dispatched batch modal record shapes. `currentLocation` is the live
// position in the tree (e.g. ['CA Ops', 'Jobsite A', 'Safety']); an empty
// array means the doc has been fully processed and renders as "Completed".
// `pages` is used to synthesize the preview when a row is clicked.
export interface DispatchRecord {
  docId: string;
  title: string;
  destination: string;
  // Optional folder id for live admin lookup in the Released-run detail
  // modal. Older records that only carry the display name still work; the
  // modal falls back to looking up by name.
  destinationFolderId?: string;
  status: 'Dispatched';
  timestamp: string;
  pages?: number;
  currentLocation?: string[];
  // Mail Log Released-run detail surface — render-only fields. None of these
  // affect routing logic; they enrich the post-release detail modal.
  labelStatus?: 'printed' | 'skipped' | 'not_applicable';
  lastActivity?: string;
  finalRecipient?: { name: string; email?: string; role?: string; downloadedAt?: string };
  returnedBy?: { name: string };
  returnReason?: string;
}

// V2 §7 — Folder Admin inbox batch lifecycle. 'New' replaces 'Incoming';
// 'Processed' replaces 'Dispatched'. In_Progress is unchanged.
// V2 §10 — Returned documents no longer generate a separate row; instead,
// the original Processed batch row gets an inline "↩ N returned" badge,
// mirroring the Mail Log pattern.
export type InboxGroupStatus = 'New' | 'In_Progress' | 'Processed';

export interface InboxDispatchRecord {
  docId: string;
  title: string;
  recipient: string;
  status: 'Dispatched' | 'Returned';
  timestamp: string;
  pages?: number;
  currentLocation?: string[];
}

export interface InboxGroup {
  id: string;
  name: string;
  arrivedAt: string;
  arrivedAtIso: string;
  docCount: number;
  status: InboxGroupStatus;
  actionedBy: string;
  dispatchedAt?: string;
  envelopes?: Envelope[];
  dispatchHistory?: InboxDispatchRecord[];
  // V2 §10 — Docs returned upstream from a downstream admin after this batch
  // was processed. Surfaces as an inline "↩ N returned" badge on the row and
  // as the pinned Returns section in the dispatch workspace.
  returnedDocs?: ReturnedDoc[];
}

// V2 §8 — A doc returned from a released run all the way back to root level.
// Surfaces as a per-row badge in the Mail Log and as a Returns section at the
// top of the dispatch workspace when the run is reopened.
export interface ReturnedDoc {
  docId: string;
  title: string;
  sender: string;
  pages: number;
  returnReason: string;
  returnedBy: string;
  returnedAt: string;        // Display-formatted timestamp
}

export interface MailRun {
  id: string;
  name: string;
  status: MailRunStatus;
  docCount: number;
  createdAt: string;
  createdAtIso: string;
  releasedAt?: string;
  actionedBy: string;
  dispatchHistory?: DispatchRecord[];
  returnedDocs?: ReturnedDoc[];
}

// V2 Brief §4 + Config Ref §9 — FolderDelegation. One active delegate per
// folder admin at a time. Inherits route / return / forward / process powers.
// Cannot create folders, edit trusted routes, invite users, or sub-delegate.
export type DelegationEndReason = 'active' | 'auto-expired' | 'revoked';
export interface FolderDelegation {
  id: string;
  folder_id: string;
  folder_name: string;
  original_admin_user_id: string;
  delegate_user_id: string;
  delegate_name: string;
  delegate_email: string;
  startedAtIso: string;
  startedDisplay: string;       // "Nov 8, 2025"
  endsAtIso?: string;
  endsDisplay?: string;         // "Nov 25, 2025"
  endReason: DelegationEndReason;
  revokedByName?: string;
}

// V2 Brief §17 — DocumentType. Example PDFs are the primary AI classification
// mechanism: when the AI sees a new document, it compares it against the
// uploaded examples to determine its type and apply the appropriate routing
// logic. More examples = higher AI confidence for that type.
export interface ExampleDocument {
  id: string;
  filename: string;
  uploadedAt: string;     // Display-formatted date (e.g. "Oct 12, 2025")
  sizeKb?: number;
}

export interface DocumentType {
  type_id: string;          // Immutable after creation
  display_name: string;
  retention_days: number;
  regulated: boolean;
  auto_urgent: boolean;
  example_documents: ExampleDocument[];
  // V2 §17 — Optional routing hint. When the AI lacks high-confidence
  // learned routes for this doc type, the configured folder is used as
  // the suggested destination. Learned trusted routes always take priority.
  routing_hint_folder_id?: string;
}
