'use client';
import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/src/context/UserContext';
import { useNotifications } from '@/src/context/NotificationsContext';
import { DEFAULT_ROUTES } from '@/src/mocks/currentUser';
import InboxQueueScreen from '@/src/components/inbox/InboxQueueScreen';
import FolderWorkspace from '@/src/components/FolderWorkspace';
import { INBOX_GROUPS } from '@/src/mocks/inboxData';
import type { Document, Envelope, InboxGroup, InboxGroupStatus } from '@/src/types';

// V2 §7 — Save Progress lives at the inbox-page layer so the saved snapshot
// survives navigation between the inbox table and the dispatch workspace.
// Persisted to sessionStorage so the demo can be refreshed without losing
// state, and cleared when the tab closes.
const SAVED_SESSIONS_KEY = 'folder-admin-inbox-saved';
// Group IDs whose returned items have all been resolved (re-routed or
// returned upstream) in-session. Clears the ↩ N returned badge on the row.
const RESOLVED_RETURNS_KEY = 'folder-admin-inbox-resolved-returns';
interface SavedSession { envelopes: Envelope[]; savedAtIso: string }

function loadSavedSessions(): Record<string, SavedSession> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.sessionStorage.getItem(SAVED_SESSIONS_KEY);
    return raw ? JSON.parse(raw) as Record<string, SavedSession> : {};
  } catch { return {}; }
}
function persistSavedSessions(map: Record<string, SavedSession>) {
  if (typeof window === 'undefined') return;
  try { window.sessionStorage.setItem(SAVED_SESSIONS_KEY, JSON.stringify(map)); } catch {}
}
function loadResolvedReturns(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.sessionStorage.getItem(RESOLVED_RETURNS_KEY);
    return raw ? JSON.parse(raw) as string[] : [];
  } catch { return []; }
}
function persistResolvedReturns(ids: string[]) {
  if (typeof window === 'undefined') return;
  try { window.sessionStorage.setItem(RESOLVED_RETURNS_KEY, JSON.stringify(ids)); } catch {}
}

// V2 §10 — A Processed batch that has returned docs gets opened in the
// dispatch workspace with those returns pre-loaded as envelopes (marked
// isReturned). The workspace then renders them in the pinned Returns section.
function synthesizeReturnedEnvelopes(group: InboxGroup): Envelope[] | undefined {
  if (!group.returnedDocs || group.returnedDocs.length === 0) return undefined;
  const docs: Document[] = group.returnedDocs.map((r, i) => ({
    id: `ret-${group.id}-${i}`,
    docId: r.docId,
    title: r.title,
    pages: r.pages,
    confidence: 0,
    isReturned: true,
    returnReason: r.returnReason,
    returnedBy: r.returnedBy,
    returnedAt: r.returnedAt,
  }));
  return [{ id: `ret-env-${group.id}`, sender: 'Returns', received: group.dispatchedAt ?? group.arrivedAt, documents: docs }];
}

export default function InboxPage() {
  const { user } = useUser();
  const { emit: emitNotification } = useNotifications();
  const router = useRouter();
  // Hold the full group object so locally-uploaded batches (which never
  // appear in INBOX_GROUPS) can still be opened in the dispatch workspace.
  const [openGroup, setOpenGroup] = useState<InboxGroup | null>(null);
  const [savedSessions, setSavedSessions] = useState<Record<string, SavedSession>>({});
  const [resolvedReturnIds, setResolvedReturnIds] = useState<Set<string>>(() => new Set());

  // Hydrate after mount so SSR isn't tripped by sessionStorage access.
  // Strip any stale saved sessions that point at a Processed-with-returns
  // group — Save Progress no longer applies to those, but a snapshot from
  // before that rule could still be in sessionStorage and would otherwise
  // both flip the row to In_Progress and pre-load the wrong envelopes.
  useEffect(() => {
    const raw = loadSavedSessions();
    const cleaned: Record<string, SavedSession> = {};
    let mutated = false;
    Object.entries(raw).forEach(([id, snap]) => {
      const group = INBOX_GROUPS.find(g => g.id === id);
      const isProcessedWithReturns = group?.status === 'Processed' && (group.returnedDocs?.length ?? 0) > 0;
      if (isProcessedWithReturns) { mutated = true; return; }
      cleaned[id] = snap;
    });
    if (mutated) persistSavedSessions(cleaned);
    setSavedSessions(cleaned);
    setResolvedReturnIds(new Set(loadResolvedReturns()));
  }, []);

  // System Admin gets the same inbox surface as Folder Admin so they can
  // exercise the dispatch workspace without role-switching. The Folder-scope
  // Delegate View also lands here — they cover a Folder Admin. The
  // Mailroom-scope Delegate View bounces to the mail log instead.
  const canUseInbox =
    user.role === 'Folder_Admin' ||
    user.role === 'System_Admin' ||
    user.role === 'Delegate_View_Folder';
  useEffect(() => {
    if (!canUseInbox) {
      router.replace(DEFAULT_ROUTES[user.role]);
    }
  }, [canUseInbox, user.role, router]);

  // Role change while workspace is open → close it
  useEffect(() => {
    if (!canUseInbox) setOpenGroup(null);
  }, [canUseInbox]);

  const returnedEnvelopes = useMemo(
    () => (openGroup ? synthesizeReturnedEnvelopes(openGroup) : undefined),
    [openGroup],
  );

  if (!canUseInbox) return null;

  const handleSaveProgress = (groupId: string, envelopes: Envelope[]) => {
    const next = { ...savedSessions, [groupId]: { envelopes, savedAtIso: new Date().toISOString() } };
    setSavedSessions(next);
    persistSavedSessions(next);
    // §22 B9 — Saved-progress batch is 24h+ old. We seed the notification
    // as already-aged so the demo doesn't need a real timer; it appears
    // immediately in the Yesterday bucket as a stale-batch reminder.
    const groupName = INBOX_GROUPS.find(g => g.id === groupId)?.name ?? 'Batch';
    const yesterday = new Date(Date.now() - 24 * 3_600_000).toISOString();
    emitNotification({
      code:        'B9',
      severity:    'info',
      title:       'Saved batch waiting on you',
      body:        `"${groupName}" has been in saved-progress for over 24 hours. Resume to finish routing.`,
      href:        '/inbox',
      source_kind: 'folder',
      source_id:   groupId,
      created_at:  yesterday,
    });
  };

  const handleAllReturnsResolved = (groupId: string) => {
    setResolvedReturnIds(prev => {
      if (prev.has(groupId)) return prev;
      const next = new Set(prev);
      next.add(groupId);
      persistResolvedReturns([...next]);
      return next;
    });
  };

  if (openGroup) {
    // A Processed batch carrying returned items is ALWAYS opened in returns
    // context — never the saved snapshot. A stale saved session from before
    // Save Progress was disabled for Processed batches must not bring back
    // the original docs.
    const isReturnsContext =
      openGroup.status === 'Processed' && (openGroup.returnedDocs?.length ?? 0) > 0;
    const saved = isReturnsContext ? undefined : savedSessions[openGroup.id];
    // Returns context: synthesized returned-doc envelopes only.
    // New / In_Progress: the saved snapshot if present, else the group's
    // own envelopes.
    const initialEnvelopes = isReturnsContext
      ? returnedEnvelopes
      : (saved?.envelopes ?? openGroup.envelopes);
    return (
      <FolderWorkspace
        // Force a fresh mount per opened batch so envelopes state always
        // re-initialises from the new initialEnvelopes (previously the
        // workspace held stale state when switching between groups).
        key={openGroup.id}
        folderId={user.folders?.[0]}
        initialEnvelopes={initialEnvelopes}
        batchName={isReturnsContext ? openGroup.name : undefined}
        savedAtIso={saved?.savedAtIso}
        // Save Progress is meaningless in a Processed-batch returns context —
        // the batch itself is already done. Only wire the callback for
        // New / In_Progress batches.
        onSaveProgress={isReturnsContext ? undefined : env => handleSaveProgress(openGroup.id, env)}
        onAllReturnsResolved={isReturnsContext ? () => handleAllReturnsResolved(openGroup.id) : undefined}
        onBack={() => setOpenGroup(null)}
      />
    );
  }

  // Batches with a saved snapshot flip to In_Progress regardless of mock status.
  const statusOverrides: Record<string, InboxGroupStatus> = {};
  Object.keys(savedSessions).forEach(id => { statusOverrides[id] = 'In_Progress'; });

  return <InboxQueueScreen onOpenGroup={setOpenGroup} statusOverrides={statusOverrides} resolvedReturnGroupIds={resolvedReturnIds} />;
}
