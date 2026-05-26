// Brief V2 §22 — Notification System types. Front-end mock only; no
// backend events. Codes correspond to the Brief's canonical event list
// (A2, A3, A9, A10, B1, B3, B5, B8, B10, C3, E1, F3, etc.).

export type NotificationSeverity = 'info' | 'warning' | 'action';

export type NotificationSourceKind = 'folder' | 'doc' | 'rule' | 'admin' | 'system';

export interface Notification {
  id: string;
  recipient_user_id: string;
  // Stable enum-ish identifier for the trigger (e.g. 'A9_zero_backup_delegates').
  type: string;
  // Matches Brief §22 short code (e.g. 'A9', 'B5').
  code: string;
  severity: NotificationSeverity;
  title: string;
  body: string;
  // Deep-link target for the row's primary action.
  href: string;
  // Optional per-notification label override for the primary action button.
  // Used when a single code maps to multiple actions (e.g. F6 reminders
  // open the inbox, admin assignments, or backup-delegate page depending on
  // which badge triggered the reminder). Falls back to actionLabelFor(code).
  actionLabel?: string;
  created_at: string;     // ISO
  seen_at: string | null; // null until drawer opens
  read_at: string | null; // null until row click or "Mark all read"
  archived_at: string | null;
  source_kind: NotificationSourceKind;
  source_id: string;
}

// Brief V2 §22 — Email preference categories. Each category gates a
// fixed set of notification codes (see EMAIL_CATEGORY_BY_CODE). The
// front-end mock only persists the toggles; the actual digest delivery
// belongs to the backend.
export interface NotificationEmailPrefs {
  inbox: boolean;       // New work lands in my inbox       (B1, B2, B3, B5, B10)
  attention: boolean;   // Something needs my attention      (A9, A10, A11, A12, F3, F6, B8, E1, C3)
  assignments: boolean; // My role or assignments change     (A1, A2, A3, A4, A5, A6, A7, A8, A13, B11, B12)
}

export type NotificationEmailCategory = keyof NotificationEmailPrefs;
