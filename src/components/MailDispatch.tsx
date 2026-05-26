'use client';
import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, ChevronLeft, ChevronDown, ChevronRight, Search, X, Star, Check, Printer, Eye, Undo2, Inbox, Zap, Plus, Trash2, Copy } from 'lucide-react';
import type { Folder, Document, Envelope, TrustedRoute, Toast, DragState, BulkLabelUpdate, SplitGroup, EnvelopeDoc, RecipientType, RoutingHistoryEntry, MailRun } from '@/src/types';
import { FOLDERS, INITIAL_ENVELOPES, INITIAL_TRUSTED_ROUTES, getRootFolders } from '@/src/mocks/data';
import { useUser } from '@/src/context/UserContext';
import { applyTrustedRoutes, computeInitialCounts, formatLabelDate, deriveDocType } from '@/src/lib/utils';
import BucketTile from '@/src/components/shared/BucketTile';
import FolderFilterDropdown from '@/src/components/shared/FolderFilterDropdown';
import ToastContainer from '@/src/components/shared/ToastContainer';
import DepartmentBucketCard from '@/src/components/DepartmentBucketCard';
import ReturnedDocCard from '@/src/components/ReturnedDocCard';
import FlatSearchList from '@/src/components/FlatSearchList';
import DocumentPreviewModal from '@/src/components/modals/DocumentPreviewModal';
import AddFolderModal from '@/src/components/modals/AddFolderModal';
import FinalizeModal from '@/src/components/modals/FinalizeModal';
import ConfirmModal from '@/src/components/modals/ConfirmModal';
import FolderContextMenu from '@/src/components/modals/FolderContextMenu';
import AssignDelegateModal from '@/src/components/modals/AssignDelegateModal';
import { findUser, type SsoUser } from '@/src/mocks/users';
import PrintQueueModal from '@/src/components/modals/PrintQueueModal';
import PrintConfirmationModal from '@/src/components/modals/PrintConfirmationModal';
import TrustedRouteModal from '@/src/components/modals/TrustedRouteModal';
import UndoAutoRouteModal from '@/src/components/modals/UndoAutoRouteModal';
import UploadDocumentModal from '@/src/components/modals/UploadDocumentModal';

const INITIAL_STATE = applyTrustedRoutes(INITIAL_ENVELOPES, INITIAL_TRUSTED_ROUTES);
const SECTION_COLLAPSED_KEY = 'worker-dispatch-section-collapsed';
type SectionKey = 'group' | 'individual';

// Run-aware props — when set, the header reflects the specific run from the
// Mail Log and the back button returns to that table instead of navigating.
// Defaults preserve the standalone workspace at "/" for demos.
interface MailDispatchProps {
  run?: MailRun;
  onBackToMailLog?: () => void;
  // V2 §11 — Save Progress button in the right-panel header. When wired by
  // the Mail Log page, snapshots routing for resume later.
  onSaveProgress?: (envelopes: Envelope[]) => void;
}

export default function MailDispatch({ run, onBackToMailLog, onSaveProgress }: MailDispatchProps = {}) {
  const router = useRouter();
  const { user } = useUser();
  const canAddFolder = user.role === 'System_Admin';
  // V2 §8 — When the workspace opens for a Released run with returned docs,
  // seed the envelopes with just those returns. The normal batch flow is
  // gone (already dispatched/released); the workspace is for re-routing or
  // discarding the docs that bounced back.
  const [envelopes, setEnvelopes] = useState<Envelope[]>(() => {
    if (run?.returnedDocs && run.returnedDocs.length > 0) {
      const docs: Document[] = run.returnedDocs.map((r, i) => ({
        id: `ret-${run.id}-${i}`,
        docId: r.docId,
        title: r.title,
        pages: r.pages,
        confidence: 0,
        isReturned: true,
        returnReason: r.returnReason,
        returnedBy: r.returnedBy,
        returnedAt: r.returnedAt,
      }));
      return [{ id: `ret-env-${run.id}`, sender: 'Returns', received: run.releasedAt ?? '', documents: docs }];
    }
    return INITIAL_STATE;
  });
  const [counts, setCounts] = useState<Record<string, number>>(() => run?.returnedDocs?.length ? {} : computeInitialCounts(INITIAL_STATE));
  // MailDispatch is the Worker / System Admin root-routing surface — only root folders are dispatch targets here.
  const [folders, setFolders] = useState<Folder[]>(() => getRootFolders());
  const [draggedDoc, setDraggedDoc] = useState<DragState | null>(null);
  const [hoveredBucket, setHoveredBucket] = useState<string | null>(null);
  const [pulsing, setPulsing] = useState<string | null>(null);
  const [previewDoc, setPreviewDoc] = useState<{ envelopeId: string; docId: string } | null>(null);
  const [showAddFolder, setShowAddFolder] = useState(false);
  const [showFinalize, setShowFinalize] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ envelopeId: string; doc: Document } | null>(null);
  const [contextMenu, setContextMenu] = useState<{ folderId: string; name: string; x: number; y: number } | null>(null);
  const [deletingFolder, setDeletingFolder] = useState<{ id: string; name: string } | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDocIds, setSelectedDocIds] = useState<Set<string>>(() => new Set());
  // Active bucket filters in the workspace toolbar — empty = show all.
  const [bucketFilters, setBucketFilters] = useState<Set<string>>(() => new Set());
  // Workspace floating-action-bar state — when the worker hits the
  // Delete bulk action, gate it behind a confirmation modal.
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  // Right-click-and-drag → copy. The native HTML5 drag system fires only on
  // the LEFT mouse button, so we track this gesture manually with mouse
  // events. `rightDrag` holds the picked-up doc; `rightDragPos` tracks the
  // cursor so the ghost follows it. Drop hit-testing uses a `data-drop-bucket`
  // attribute set on each BucketTile.
  const [rightDrag, setRightDrag] = useState<{ envelopeId: string; doc: Document } | null>(null);
  const [rightDragPos, setRightDragPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  // Search-bulk-select feeds the PrintQueueModal with a custom item set.
  const [bulkLabelItems, setBulkLabelItems] = useState<EnvelopeDoc[] | null>(null);
  // In-workspace Upload Document. Reuses the same modal used elsewhere;
  // uploaded docs land directly in this workspace's envelopes.
  const [showUploadInWorkspace, setShowUploadInWorkspace] = useState(false);
  // Drives the Print Queue Modal. Opens from the status bar's
  // "Review & print" button and as a finalize gate when the queue isn't empty.
  const [showPrintQueue, setShowPrintQueue] = useState(false);
  // True when the print queue was opened as the finalize-gate step. Once the
  // queue drains (everything printed or marked "no label needed") the worker
  // is auto-forwarded to the FinalizeModal so the labels-printed count is
  // always shown without requiring a second Finalize click.
  const [pendingFinalize, setPendingFinalize] = useState(false);
  // After Print N labels fires, hold the just-printed items here and render
  // the PrintConfirmationModal so the worker can verify the output and
  // optionally reprint any that came out wrong before the flow continues.
  const [printConfirmation, setPrintConfirmation] = useState<EnvelopeDoc[] | null>(null);
  // Extra print-queue entries — used when the worker needs multiple physical
  // labels for the same document (different recipients, or even a routing
  // copy to a different folder). Each extra is a synthesized line item that
  // points back to a real source doc. They live here so the status-bar queue
  // count and queue contents stay in sync. When `destination` differs from
  // the source doc's dispatchedTo, the Print step also materializes a copy
  // doc in that destination folder.
  const [printQueueExtras, setPrintQueueExtras] = useState<Array<{ entryId: string; envelopeId: string; sourceDocId: string; recipient: string; destination?: string }>>([]);
  const [knownRecipients, setKnownRecipients] = useState<Set<string>>(() => new Set());
  const [trustedRoutes, setTrustedRoutes] = useState<TrustedRoute[]>([...INITIAL_TRUSTED_ROUTES]);
  const [trustModal, setTrustModal] = useState<{ envelopeId: string; docId: string } | null>(null);
  const [undoAutoRoute, setUndoAutoRoute] = useState<{ envelopeId: string; docId: string } | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const [folderSearch, setFolderSearch] = useState('');
  // Right-panel accordion state — Group / Individual sections keyed by
  // recipient_type. Both open by default; collapsed-set persisted per session.
  const [collapsedSections, setCollapsedSections] = useState<Set<SectionKey>>(() => new Set());
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const stored = window.sessionStorage.getItem(SECTION_COLLAPSED_KEY);
      if (stored) setCollapsedSections(new Set(JSON.parse(stored) as SectionKey[]));
    } catch { /* ignore */ }
  }, []);
  const toggleSection = (key: SectionKey) => {
    setCollapsedSections(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      if (typeof window !== 'undefined') {
        try { window.sessionStorage.setItem(SECTION_COLLAPSED_KEY, JSON.stringify([...next])); } catch {}
      }
      return next;
    });
  };

  // V2 §3 — Unified "Edit recipient" flow. Collapses Rename + Edit type +
  // Reassign admin into one modal opened from the right-click menu.
  const [editingFolder, setEditingFolder] = useState<Folder | null>(null);
  const [editAutoFocusAdmin, setEditAutoFocusAdmin] = useState(false);
  // Inline panel anchored to the "⭐ N auto-routed" badge. Lists each
  // auto-routed doc with a per-row Undo affordance.
  const [showAutoRoutedPanel, setShowAutoRoutedPanel] = useState(false);
  // Urgent-release recall toast — 15-second window after Release Now to undo.
  // Receiver-side state is mocked: recall always succeeds in this demo since
  // the receiver workflow isn't concurrent.
  const [urgentRecall, setUrgentRecall] = useState<{ envelopeId: string; docId: string; docTitle: string; startedAt: number } | null>(null);
  // V2 §11 — Inline "Saved · {time}" confirmation that auto-clears.
  const [saveConfirmedAt, setSaveConfirmedAt] = useState<string | null>(null);
  // V2 §5 — Delegates assigned on inactive_admin folders. Active delegate
  // keeps the bucket in ADMIN INACTIVE state but adds a "Delegate active"
  // secondary badge. Keyed by folder id.
  const [delegates, setDelegates] = useState<Map<string, { delegateName: string; delegateUserId: string; endsAtIso?: string }>>(() => new Map());
  const [delegateTarget, setDelegateTarget] = useState<Folder | null>(null);
  // Drill-into-folder filter view: hides the right panel and lists only docs
  // the current user routed into that folder (see / preview / undo).
  const [drilledFolderId, setDrilledFolderId] = useState<string | null>(null);

  // ── Derived folder name map (replaces mutable DEPT_NAME object) ──
  const folderNameMap = useMemo<Record<string, string>>(() => {
    // 'ungrouped' is a virtual bucket for AI-uncertain docs (low confidence,
    // missing/archived suggestion) — same shape as 'junk' (special, not a
    // real folder). 'junk' stays for explicit-junk routing.
    const m: Record<string, string> = { junk: 'Junk', ungrouped: 'Ungrouped' };
    folders.forEach(f => { m[f.id] = f.name; });
    return m;
  }, [folders]);

  // ── Derived stats ─────────────────────────────────────────────
  const dispatchPages: Record<string, number> = {};
  envelopes.forEach(env => env.documents.forEach(d => {
    if (d.dispatchedTo) dispatchPages[d.dispatchedTo] = (dispatchPages[d.dispatchedTo] || 0) + d.pages;
  }));
  const dispatchSummary = [...folders, { id: 'junk', name: 'Junk' }]
    .filter(f => (dispatchPages[f.id] || 0) > 0)
    .map(f => ({ ...f, pages: dispatchPages[f.id] }));
  const totalRemaining = envelopes.reduce((s, e) => s + e.documents.filter(d => !d.dispatchedTo).length, 0);
  const totalPagesRemaining = envelopes.reduce((s, e) => s + e.documents.filter(d => !d.dispatchedTo).reduce((x, d) => x + d.pages, 0), 0);
  const dispatchedTotal = Object.values(dispatchPages).reduce((a, b) => a + b, 0);
  const progress = (dispatchedTotal + totalPagesRemaining) > 0 ? (dispatchedTotal / (dispatchedTotal + totalPagesRemaining)) * 100 : 0;

  const currentPreviewDoc = previewDoc
    ? envelopes.find(e => e.id === previewDoc.envelopeId)?.documents.find(d => d.id === previewDoc.docId) ?? null
    : null;

  const pendingAILabels: EnvelopeDoc[] = [];
  let labelsPrintedCount = 0;
  envelopes.forEach(env => env.documents.forEach(d => {
    if (d.labelStatus === 'ai_suggested') pendingAILabels.push({ doc: d, envelope: env });
    if (d.labelStatus === 'printed') labelsPrintedCount++;
  }));

  // Flat list of print-queue entries — each real queued doc followed by any
  // duplicate entries created from it. Synthesized dups carry the source's
  // metadata but a unique id (entryId) and their own labelRecipient so the
  // modal treats them as independent rows.
  const printQueueEntries: EnvelopeDoc[] = (() => {
    const out: EnvelopeDoc[] = [];
    pendingAILabels.forEach(src => {
      out.push(src);
      printQueueExtras
        .filter(e => e.envelopeId === src.envelope.id && e.sourceDocId === src.doc.id)
        .forEach(e => {
          out.push({
            envelope: src.envelope,
            doc: {
              ...src.doc,
              id: e.entryId,
              labelRecipient: e.recipient || undefined,
              // Per-dup destination override drives the "to <folder>" line on
              // the label preview AND, on print, creates a real copy in that
              // folder when it differs from the source's destination.
              dispatchedTo: e.destination ?? src.doc.dispatchedTo,
            },
          });
        });
    });
    // Defensive: surface any orphan extras (source no longer in queue) so
    // the worker can still resolve them.
    printQueueExtras.forEach(e => {
      if (out.some(x => x.doc.id === e.entryId)) return;
      const env = envelopes.find(env2 => env2.id === e.envelopeId);
      const sourceDoc = env?.documents.find(d => d.id === e.sourceDocId);
      if (env && sourceDoc) {
        out.push({
          envelope: env,
          doc: {
            ...sourceDoc,
            id: e.entryId,
            labelRecipient: e.recipient || undefined,
            dispatchedTo: e.destination ?? sourceDoc.dispatchedTo,
          },
        });
      }
    });
    return out;
  })();
  const printQueueTotal = pendingAILabels.length + printQueueExtras.length;

  const handleDuplicatePrintEntry = (envelopeId: string, idFromModal: string) => {
    // Resolve the underlying source doc — `idFromModal` may itself be an
    // extra entryId (the worker hit Duplicate on a dup row).
    const fromExtra = printQueueExtras.find(e => e.entryId === idFromModal);
    const sourceDocId = fromExtra?.sourceDocId ?? idFromModal;
    const entryId = sourceDocId + '__dup__' + Date.now().toString(36) + '__' + Math.floor(Math.random() * 1000).toString(36);
    setPrintQueueExtras(prev => [...prev, { entryId, envelopeId, sourceDocId, recipient: '' }]);
  };
  // Dup-row destination override. Empty string clears the override so the
  // dup falls back to the source's destination.
  const handleEntryDestinationChange = (entryId: string, folderId: string) => {
    setPrintQueueExtras(prev => prev.map(e => e.entryId === entryId ? { ...e, destination: folderId || undefined } : e));
  };

  const autoRoutedDocs: EnvelopeDoc[] = [];
  envelopes.forEach(env => env.documents.forEach(doc => { if (doc.autoRouted) autoRoutedDocs.push({ doc, envelope: env }); }));
  const autoRoutedCount = autoRoutedDocs.length;

  const activeTrustTarget = trustModal ? (() => {
    const env = envelopes.find(e => e.id === trustModal.envelopeId);
    const doc = env?.documents.find(d => d.id === trustModal.docId);
    return env && doc ? { env, doc } : null;
  })() : null;

  const activeUndoTarget = undoAutoRoute ? (() => {
    const env = envelopes.find(e => e.id === undoAutoRoute.envelopeId);
    const doc = env?.documents.find(d => d.id === undoAutoRoute.docId);
    return env && doc ? { env, doc } : null;
  })() : null;

  const searchQuery = searchTerm.trim().toLowerCase();
  const isSearching = searchQuery.length > 0;
  const flatMatches: EnvelopeDoc[] = [];
  if (isSearching) envelopes.forEach(env => env.documents.forEach(doc => {
    if (!doc.dispatchedTo && (env.sender.toLowerCase().includes(searchQuery) || doc.title.toLowerCase().includes(searchQuery)))
      flatMatches.push({ doc, envelope: env });
  }));

  // V2 §8 — Returns are pulled into their own section above the AI batch
  // groups; they don't pollute the "junk" bucket grouping below.
  const returnsList: EnvelopeDoc[] = [];
  envelopes.forEach(env => env.documents.forEach(doc => {
    if (doc.isReturned && !doc.dispatchedTo) returnsList.push({ doc, envelope: env });
  }));
  // Brief V2 §11/§21 — classify each doc into a bucket. Already-dispatched
  // docs go to their destination bucket. Undispatched docs go to:
  //   • 'ungrouped' if no suggestion, suggestion folder missing/archived,
  //     or AI confidence below 50%
  //   • 'junk' if AI flagged it as junk
  //   • the suggested folder id otherwise
  const UNGROUPED_CONFIDENCE_THRESHOLD = 0.5;
  const bucketGroups: Record<string, EnvelopeDoc[]> = {};
  envelopes.forEach(env => env.documents.forEach(doc => {
    if (doc.isReturned && !doc.dispatchedTo) return; // surface returns separately
    let key: string;
    if (doc.dispatchedTo) {
      key = doc.dispatchedTo;
    } else {
      const sugg = doc.suggestion;
      if (!sugg) {
        key = 'ungrouped';
      } else if (sugg === 'junk') {
        key = 'junk';
      } else {
        const target = folders.find(f => f.id === sugg);
        if (!target || target.is_archived || (doc.confidence ?? 0) < UNGROUPED_CONFIDENCE_THRESHOLD) {
          key = 'ungrouped';
        } else {
          key = sugg;
        }
      }
    }
    if (!bucketGroups[key]) bucketGroups[key] = [];
    bucketGroups[key].push({ doc, envelope: env });
  }));
  // Ungrouped first (worker triage priority), then live folders only, then
  // junk. Archived folders never render as a destination bucket.
  const orderedBuckets = ['ungrouped', ...folders.filter(f => !f.is_archived).map(f => f.id), 'junk']
    .map(id => ({ folderId: id, items: bucketGroups[id] || [] }))
    .filter(b => b.items.length > 0);
  const ungroupedCount = (bucketGroups['ungrouped'] ?? []).length;
  // Apply the toolbar's bucket-filter chips. Empty filter = show all.
  const visibleBuckets = bucketFilters.size > 0
    ? orderedBuckets.filter(b => bucketFilters.has(b.folderId))
    : orderedBuckets;
  const undispatchedInView: EnvelopeDoc[] = visibleBuckets.flatMap(b => b.items.filter(({ doc }) => !doc.dispatchedTo));
  const workspaceSelectAllMode = selectedDocIds.size === 0;
  const handleWorkspaceSelectAllToggle = () => {
    setSelectedDocIds(
      workspaceSelectAllMode
        ? new Set(undispatchedInView.map(({ doc }) => doc.id))
        : new Set(),
    );
  };
  const toggleBucketFilter = (folderId: string) => {
    setBucketFilters(prev => {
      const next = new Set(prev);
      if (next.has(folderId)) next.delete(folderId); else next.add(folderId);
      return next;
    });
  };
  // Bulk add the current selection to the print queue. Flips each selected
  // doc to labelStatus = 'ai_suggested' so the status bar count and the
  // Print Queue Modal pick them up. Clears selection on success.
  const handleBulkPrintLabels = () => {
    if (selectedDocIds.size === 0) return;
    setEnvelopes(prev => prev.map(env => ({
      ...env,
      documents: env.documents.map(d => selectedDocIds.has(d.id) ? { ...d, labelStatus: 'ai_suggested' } : d),
    })));
    const n = selectedDocIds.size;
    addToast(n + ' label' + (n !== 1 ? 's' : '') + ' added to print queue.');
    setSelectedDocIds(new Set());
  };
  // Bulk soft-delete confirmation: drop selected docs from envelopes and
  // refund any pages they had queued from a destination count.
  const handleBulkDeleteConfirm = () => {
    const ids = new Set(selectedDocIds);
    if (ids.size === 0) { setConfirmBulkDelete(false); return; }
    const refundByDest: Record<string, number> = {};
    envelopes.forEach(env => env.documents.forEach(d => {
      if (ids.has(d.id) && d.dispatchedTo) {
        refundByDest[d.dispatchedTo] = (refundByDest[d.dispatchedTo] || 0) + d.pages;
      }
    }));
    setEnvelopes(prev => prev.map(env => ({
      ...env,
      documents: env.documents.filter(d => !ids.has(d.id)),
    })));
    if (Object.keys(refundByDest).length > 0) {
      setCounts(prev => {
        const next = { ...prev };
        Object.entries(refundByDest).forEach(([dest, pages]) => {
          next[dest] = Math.max(0, (next[dest] || 0) - pages);
        });
        return next;
      });
    }
    const n = ids.size;
    addToast(n + ' document' + (n !== 1 ? 's' : '') + ' deleted.');
    setSelectedDocIds(new Set());
    setConfirmBulkDelete(false);
  };

  // ── Drag handlers ─────────────────────────────────────────────
  const handleDragStart = (envId: string, doc: Document, fromSel: boolean) => {
    if (fromSel && selectedDocIds.size > 0 && selectedDocIds.has(doc.id)) {
      const items: Array<{ envelopeId: string; doc: Document }> = [];
      envelopes.forEach(env => env.documents.forEach(d => {
        if (selectedDocIds.has(d.id) && !d.dispatchedTo) items.push({ envelopeId: env.id, doc: d });
      }));
      setDraggedDoc({ bulk: true, items });
    } else {
      setDraggedDoc({ bulk: false, envelopeId: envId, doc });
    }
  };
  // ⋮ → Duplicate. Creates an unrouted copy directly below the source. The
  // copy gets a sub-ID like #441892-COPY1 (and -COPY2, -COPY3 for further
  // duplicates) so the worker can route each instance independently.
  const handleDuplicateDoc = (envelopeId: string, doc: Document) => {
    const stamp = Date.now();
    const baseId = (doc.docId ?? '').split('-COPY')[0] || doc.docId || doc.id;
    const env = envelopes.find(e => e.id === envelopeId);
    let nextNum = 1;
    env?.documents.forEach(d => {
      const m = d.docId?.match(/^(.+)-COPY(\d+)$/);
      if (m && m[1] === baseId) nextNum = Math.max(nextNum, parseInt(m[2], 10) + 1);
    });
    const newDocId = `${baseId}-COPY${nextNum}`;
    setEnvelopes(prev => prev.map(env2 => {
      if (env2.id !== envelopeId) return env2;
      const idx = env2.documents.findIndex(d => d.id === doc.id);
      if (idx === -1) return env2;
      const copy: Document = {
        ...doc,
        id: doc.id + '-dup-' + stamp,
        docId: newDocId,
        dispatchedTo: undefined,
        autoRouted: undefined,
        trustedRouteId: undefined,
        isCopy: true,
        labelStatus: undefined,
        labelDate: undefined,
        labelRecipient: undefined,
        labelRoute: undefined,
        released: undefined,
        routingHistory: [
          { action: `Duplicated from #${baseId}`, user: 'You', timestamp: formatLabelDate(), note: null },
        ],
      };
      const next = [...env2.documents];
      next.splice(idx + 1, 0, copy);
      return { ...env2, documents: next };
    }));
    addToast(`Duplicate created — #${newDocId}`);
  };

  // Right-click-and-drag (copy) — start the gesture from a doc card's
  // onMouseDown when button === 2. Suppresses the browser context menu.
  const handleRightDragStart = (envelopeId: string, doc: Document, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (doc.dispatchedTo) return; // dispatched docs aren't copy-source candidates
    setRightDrag({ envelopeId, doc });
    setRightDragPos({ x: e.clientX, y: e.clientY });
  };
  // Drop a right-drag onto a bucket: inserts a copy of the doc with
  // isCopy: true and dispatchedTo set to the target folder.
  const handleRightDragDrop = (envelopeId: string, doc: Document, bucketId: string) => {
    const stamp = Date.now();
    setEnvelopes(prev => prev.map(env => {
      if (env.id !== envelopeId) return env;
      const idx = env.documents.findIndex(d => d.id === doc.id);
      if (idx === -1) return env;
      const copy: Document = {
        ...doc,
        id: doc.id + '-c-' + stamp,
        dispatchedTo: bucketId,
        isCopy: true,
      };
      const next = [...env.documents];
      next.splice(idx + 1, 0, copy);
      return { ...env, documents: next };
    }));
    setCounts(prev => ({ ...prev, [bucketId]: (prev[bucketId] || 0) + doc.pages }));
    addToast('Copy queued to ' + (folderNameMap[bucketId] || bucketId) + '.');
  };
  // Global mouse listeners while the right-drag is active: update the
  // ghost position, suppress contextmenu, and resolve the drop target on
  // mouseup. Cleanup tears all listeners down when the gesture ends.
  useEffect(() => {
    if (!rightDrag) return;
    const onMove = (ev: MouseEvent) => setRightDragPos({ x: ev.clientX, y: ev.clientY });
    const onUp = (ev: MouseEvent) => {
      if (ev.button !== 2) return;
      ev.preventDefault();
      const el = document.elementFromPoint(ev.clientX, ev.clientY) as HTMLElement | null;
      const bucketEl = el?.closest('[data-drop-bucket]') as HTMLElement | null;
      const bucketId = bucketEl?.getAttribute('data-drop-bucket') ?? null;
      if (bucketId) handleRightDragDrop(rightDrag.envelopeId, rightDrag.doc, bucketId);
      setRightDrag(null);
    };
    const onContext = (ev: Event) => ev.preventDefault();
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    document.addEventListener('contextmenu', onContext);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.removeEventListener('contextmenu', onContext);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!rightDrag]);

  // Pick up an entire batch as a bulk drag — same payload shape as
  // multi-select bulk drag, so handleDrop applies all items in one go.
  const handleBatchDragStart = (_folderId: string, batchItems: EnvelopeDoc[]) => {
    const items = batchItems
      .filter(it => !it.doc.dispatchedTo)
      .map(it => ({ envelopeId: it.envelope.id, doc: it.doc }));
    if (items.length === 0) return;
    setDraggedDoc({ bulk: true, items });
  };
  const handleDragEnd = () => { setDraggedDoc(null); setHoveredBucket(null); };
  const handleDragOver = (e: React.DragEvent, bId: string) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setHoveredBucket(bId); };
  const handleDragLeave = () => setHoveredBucket(null);
  const handleDrop = (e: React.DragEvent, bucketId: string) => {
    e.preventDefault();
    if (!draggedDoc) return;
    // Drag is always a move — there's no forward-as-copy at the SA/Worker level
    // (dispatches go to root folders only).
    if (draggedDoc.bulk) {
      const items = draggedDoc.items;
      const tp = items.reduce((s, it) => s + it.doc.pages, 0);
      setCounts(prev => ({ ...prev, [bucketId]: (prev[bucketId] || 0) + tp }));
      setEnvelopes(prev => prev.map(env => {
        const mi = items.filter(it => it.envelopeId === env.id);
        if (!mi.length) return env;
        const tids = new Set(mi.map(it => it.doc.id));
        return { ...env, documents: env.documents.map(d => tids.has(d.id) ? { ...d, dispatchedTo: bucketId } : d) };
      }));
      setSelectedDocIds(new Set());
    } else {
      const { envelopeId, doc } = draggedDoc;
      setCounts(prev => ({ ...prev, [bucketId]: (prev[bucketId] || 0) + doc.pages }));
      setEnvelopes(prev => prev.map(env => {
        if (env.id !== envelopeId) return env;
        return { ...env, documents: env.documents.map(d => d.id === doc.id ? { ...d, dispatchedTo: bucketId } : d) };
      }));
    }
    setPulsing(bucketId);
    setTimeout(() => setPulsing(null), 700);
    setDraggedDoc(null);
    setHoveredBucket(null);
  };

  // ── Document actions ──────────────────────────────────────────
  const handlePreview = (envId: string, docId: string) => {
    // If the preview was triggered from a duplicate print-queue entry (whose
    // doc.id is a synthesized entryId), resolve back to the real source doc
    // so the preview modal can find content to render.
    const extra = printQueueExtras.find(e => e.entryId === docId);
    setPreviewDoc({ envelopeId: envId, docId: extra?.sourceDocId ?? docId });
  };
  const handleClosePreview = () => setPreviewDoc(null);

  const handleApplySplit = (envelopeId: string, docId: string, groups: SplitGroup[]) => {
    setEnvelopes(prev => prev.map(env => {
      if (env.id !== envelopeId) return env;
      const idx = env.documents.findIndex(d => d.id === docId);
      if (idx === -1) return env;
      const orig = env.documents[idx];
      const stamp = Date.now();
      // Bug 4 fix: generate docId for each split segment
      const newDocs: Document[] = groups.map((g, i) => ({
        id: docId + '-s' + (i + 1) + '-' + stamp,
        docId: orig.docId ? orig.docId + '-' + (i + 1) : String(stamp + i),
        title: orig.title,
        pages: g.end - g.start + 1,
        pageRange: [g.start, g.end] as [number, number],
        suggestion: g.folder,
        confidence: 1.0,
        manualRoute: true,
      }));
      const upd = [...env.documents];
      upd.splice(idx, 1, ...newDocs);
      return { ...env, documents: upd };
    }));
  };

  const handleAutoDispatch = (folderId: string) => {
    let added = 0;
    envelopes.forEach(env => env.documents.forEach(d => { if (!d.dispatchedTo && d.suggestion === folderId) added += d.pages; }));
    if (!added) return;
    setCounts(prev => ({ ...prev, [folderId]: (prev[folderId] || 0) + added }));
    setEnvelopes(prev => prev.map(env => ({
      ...env, documents: env.documents.map(d => (!d.dispatchedTo && d.suggestion === folderId) ? { ...d, dispatchedTo: folderId } : d),
    })));
    setPulsing(folderId);
    setTimeout(() => setPulsing(null), 700);
  };

  const handleReleaseNow = (envelopeId: string, doc: Document) => {
    if (!doc || !doc.suggestion || doc.dispatchedTo) return;
    setEnvelopes(prev => prev.map(env => env.id !== envelopeId ? env : { ...env, documents: env.documents.map(d => d.id === doc.id ? { ...d, dispatchedTo: doc.suggestion, released: true } : d) }));
    setCounts(prev => ({ ...prev, [doc.suggestion!]: (prev[doc.suggestion!] || 0) + doc.pages }));
    // 15-second undo window — recall pulls the doc back from the destination.
    setUrgentRecall({ envelopeId, docId: doc.id, docTitle: doc.title, startedAt: Date.now() });
  };
  // Recall handler — pulls the released doc back to the dispatch workspace as
  // unrouted, keeps the urgent badge, and appends a "Recalled" routing entry.
  const handleUndoRelease = () => {
    if (!urgentRecall) return;
    const { envelopeId, docId } = urgentRecall;
    let recalledTitle: string | undefined;
    let destination: string | undefined;
    setEnvelopes(prev => prev.map(env => {
      if (env.id !== envelopeId) return env;
      return {
        ...env,
        documents: env.documents.map(d => {
          if (d.id !== docId) return d;
          if (!d.released || !d.dispatchedTo) return d;
          recalledTitle = d.title;
          destination = d.dispatchedTo;
          const entry: RoutingHistoryEntry = {
            action: 'Recalled',
            user: user.name,
            timestamp: new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }),
            note: null,
          };
          return {
            ...d,
            dispatchedTo: undefined,
            released: undefined,
            routingHistory: [...(d.routingHistory ?? []), entry],
          };
        }),
      };
    }));
    if (destination) {
      // Pull pages back from the destination count. envelopes state still
      // holds the doc with its pre-recall values at this point.
      const env = envelopes.find(e => e.id === envelopeId);
      const doc = env?.documents.find(d => d.id === docId);
      if (doc) setCounts(prev => ({ ...prev, [destination!]: Math.max(0, (prev[destination!] || 0) - doc.pages) }));
    }
    setUrgentRecall(null);
    if (recalledTitle) addToast(`Recalled — ${recalledTitle}`);
  };

  const handleRemoveInstance = (envelopeId: string, doc: Document) => {
    if (doc.isCopy) {
      setEnvelopes(prev => prev.map(env => env.id !== envelopeId ? env : { ...env, documents: env.documents.filter(d => d.id !== doc.id) }));
      setCounts(prev => ({ ...prev, [doc.dispatchedTo!]: Math.max(0, (prev[doc.dispatchedTo!] || 0) - doc.pages) }));
    } else {
      setEnvelopes(prev => prev.map(env => env.id !== envelopeId ? env : { ...env, documents: env.documents.map(d => d.id === doc.id ? { ...d, dispatchedTo: undefined } : d) }));
      setCounts(prev => ({ ...prev, [doc.dispatchedTo!]: Math.max(0, (prev[doc.dispatchedTo!] || 0) - doc.pages) }));
    }
  };

  // Drill-into-folder handlers (defined after handleRemoveInstance so the
  // undo path can call it without TS used-before-defined warnings).
  const handleEnterDrill = (id: string) => setDrilledFolderId(id);
  const handleExitDrill  = () => setDrilledFolderId(null);
  const handleUndoDispatch = (envelopeId: string, doc: Document) => {
    handleRemoveInstance(envelopeId, doc);
    addToast('Doc #' + (doc.docId || doc.id) + ' returned to the staging list.');
  };

  const handleDeleteDoc = (envelopeId: string, doc: Document) => setDeleteTarget({ envelopeId, doc });
  // V2 §8 — Discard a returned document. One-step confirmation prompt.
  const handleDiscardReturn = (envelopeId: string, doc: Document) => {
    if (typeof window === 'undefined') return;
    const ok = window.confirm(`Discard returned document "${doc.title}"? This soft-deletes it from the workspace.`);
    if (!ok) return;
    setEnvelopes(prev => prev.map(env => env.id !== envelopeId ? env : { ...env, documents: env.documents.filter(d => d.id !== doc.id) }));
    addToast(`Discarded — ${doc.title}`);
  };

  // Bug 3 fix: subtract counts when deleting a dispatched doc
  const handleConfirmDeleteDoc = () => {
    if (!deleteTarget) return;
    const { envelopeId, doc } = deleteTarget;
    if (doc.dispatchedTo) setCounts(prev => ({ ...prev, [doc.dispatchedTo!]: Math.max(0, (prev[doc.dispatchedTo!] || 0) - doc.pages) }));
    setEnvelopes(prev => prev.map(env => env.id !== envelopeId ? env : { ...env, documents: env.documents.filter(d => d.id !== doc.id) }));
    setDeleteTarget(null);
  };

  const handleRenameDoc = (envelopeId: string, docId: string, newTitle: string) =>
    setEnvelopes(prev => prev.map(env => env.id !== envelopeId ? env : { ...env, documents: env.documents.map(d => d.id !== docId ? d : { ...d, title: newTitle }) }));

  // ── Upload Document (in-workspace) ───────────────────────────
  // Uploaded docs land directly in the current workspace as a new envelope
  // prepended to the doc list. Mirrors the Folder Admin upload flow.
  const handleUploadInWorkspaceAdd = ({ name, docCount, fileNames }: { name: string; docCount: number; fileNames: string[] }) => {
    const now = new Date();
    const human = now.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }).replace(',', ' ·');
    const stamp = now.getTime();
    const documents: Document[] = fileNames.map((fname, i) => {
      const cleanTitle = fname.replace(/\.[^/.]+$/, '').replace(/[-_]+/g, ' ').trim() || `Untitled ${i + 1}`;
      const docNum = 500000 + (stamp % 90000) + i;
      return {
        id: `doc-local-${stamp}-${i}`,
        docId: String(docNum),
        title: cleanTitle,
        pages: 1 + Math.floor(Math.random() * 5),
        confidence: 0,
        inboxSource: { kind: 'uploaded' },
        routingHistory: [
          { action: 'Uploaded', user: user.name ?? 'You', timestamp: human, note: null },
        ],
      };
    });
    const newEnvelope: Envelope = {
      id: `env-upload-${stamp}`,
      sender: user.name ?? 'Upload',
      received: human,
      documents,
    };
    setEnvelopes(prev => [newEnvelope, ...prev]);
    setShowUploadInWorkspace(false);
    addToast(`"${name}" added · ${docCount} document${docCount !== 1 ? 's' : ''} in workspace.`);
  };

  // ── Search / selection ────────────────────────────────────────
  const handleSearchChange = (val: string) => { setSearchTerm(val); if (!val.trim()) setSelectedDocIds(new Set()); };
  const handleToggleSelect = (docId: string) => setSelectedDocIds(prev => { const n = new Set(prev); n.has(docId) ? n.delete(docId) : n.add(docId); return n; });
  const handleSelectAllMatches = () => setSelectedDocIds(new Set(flatMatches.map(m => m.doc.id)));
  const handleClearSelection = () => setSelectedDocIds(new Set());

  // ── Print queue ───────────────────────────────────────────────
  // Toggling a doc's print-queue membership uses labelStatus = 'ai_suggested'
  // as the canonical "in queue" marker. AI-flagged docs already carry this
  // value; manual add via the ⋮ menu writes the same status so both sources
  // funnel through the same review surface.
  const handleTogglePrintQueue = (envelopeId: string, doc: Document) => {
    const isInQueue = doc.labelStatus === 'ai_suggested';
    setEnvelopes(prev => prev.map(env =>
      env.id !== envelopeId
        ? env
        : { ...env, documents: env.documents.map(d =>
            d.id !== doc.id ? d : { ...d, labelStatus: isInQueue ? undefined : 'ai_suggested' },
          ) },
    ));
    addToast(isInQueue
      ? 'Removed from print queue.'
      : 'Added to print queue. Review and print before finalizing.');
  };
  const handlePrintQueueConfirm = (updates: BulkLabelUpdate[]) => {
    // Split updates into real-doc updates and extra-entry updates.
    const extraIdSet = new Set(printQueueExtras.map(e => e.entryId));
    const sourceUpdates = updates.filter(u => !extraIdSet.has(u.docId));
    const extraUpdates  = updates.filter(u => extraIdSet.has(u.docId));

    // Compute the dup-as-routing-copy materializations BEFORE the env update.
    // A dup with a destination different from its source becomes a real copy
    // doc in the new folder (isCopy:true, dispatchedTo:newFolder, printed).
    type CopyDispatch = { envelopeId: string; insertAfterDocId: string; newDoc: Document; destination: string };
    const copyDispatches: CopyDispatch[] = [];
    extraUpdates.forEach(u => {
      const extra = printQueueExtras.find(e => e.entryId === u.docId);
      if (!extra) return;
      const env = envelopes.find(e => e.id === extra.envelopeId);
      const sourceDoc = env?.documents.find(d => d.id === extra.sourceDocId);
      if (!env || !sourceDoc) return;
      const targetDest = extra.destination;
      if (!targetDest || targetDest === sourceDoc.dispatchedTo) return;
      copyDispatches.push({
        envelopeId: env.id,
        insertAfterDocId: sourceDoc.id,
        destination: targetDest,
        newDoc: {
          ...sourceDoc,
          id: extra.sourceDocId + '-c-' + Date.now().toString(36) + '-' + copyDispatches.length,
          isCopy: true,
          dispatchedTo: targetDest,
          labelStatus: 'printed',
          labelDate: u.labelDate,
          labelRecipient: u.labelRecipient,
          labelRoute: targetDest,
        },
      });
    });

    // Apply source updates to envelopes so the real docs flip to 'printed',
    // and splice in any dup-routing copies right after their source doc.
    setEnvelopes(prev => prev.map(env => {
      const my = sourceUpdates.filter(u => u.envelopeId === env.id);
      const myCopies = copyDispatches.filter(c => c.envelopeId === env.id);
      if (!my.length && !myCopies.length) return env;
      const docs: Document[] = [];
      env.documents.forEach(d => {
        const u = my.find(x => x.docId === d.id);
        docs.push(u ? { ...d, labelStatus: u.labelStatus, labelDate: u.labelDate, labelRecipient: u.labelRecipient, labelRoute: u.labelRoute } : d);
        myCopies.filter(c => c.insertAfterDocId === d.id).forEach(c => docs.push(c.newDoc));
      });
      return { ...env, documents: docs };
    }));
    if (copyDispatches.length > 0) {
      setCounts(prev => {
        const next = { ...prev };
        copyDispatches.forEach(c => { next[c.destination] = (next[c.destination] || 0) + c.newDoc.pages; });
        return next;
      });
    }
    setKnownRecipients(prev => { const n = new Set(prev); updates.forEach(u => { if (u.labelRecipient) n.add(u.labelRecipient); }); return n; });
    setShowPrintQueue(false);

    // Stage the just-printed items in the post-print confirmation modal.
    // Build entries for sources from the live envelope state and for extras
    // from the printQueueExtras list (synthesized EnvelopeDoc with the
    // recipient that was set on that dup entry).
    const justPrinted: EnvelopeDoc[] = [];
    sourceUpdates.forEach(u => {
      const env = envelopes.find(e => e.id === u.envelopeId);
      const doc = env?.documents.find(d => d.id === u.docId);
      if (env && doc) {
        justPrinted.push({
          envelope: env,
          doc: { ...doc, labelStatus: 'printed', labelDate: u.labelDate, labelRecipient: u.labelRecipient, labelRoute: u.labelRoute },
        });
      }
    });
    extraUpdates.forEach(u => {
      const extra = printQueueExtras.find(e => e.entryId === u.docId);
      if (!extra) return;
      const env = envelopes.find(e => e.id === extra.envelopeId);
      const sourceDoc = env?.documents.find(d => d.id === extra.sourceDocId);
      if (env && sourceDoc) {
        justPrinted.push({
          envelope: env,
          doc: { ...sourceDoc, id: u.docId, labelStatus: 'printed', labelDate: u.labelDate, labelRecipient: u.labelRecipient, labelRoute: u.labelRoute },
        });
      }
    });
    // Consume the printed extras — they've been printed; remove from queue.
    if (extraUpdates.length > 0) {
      const printedIds = new Set(extraUpdates.map(u => u.docId));
      setPrintQueueExtras(prev => prev.filter(e => !printedIds.has(e.entryId)));
    }
    if (justPrinted.length > 0) setPrintConfirmation(justPrinted);
  };
  // "Looks good" on the confirmation — clear the staged items and, if the
  // worker was in the finalize-gate flow AND the queue is now drained,
  // open the FinalizeModal so the labels-printed count is shown.
  const handlePrintConfirmationContinue = () => {
    setPrintConfirmation(null);
    if (pendingFinalize) {
      const queueDrained =
        !envelopes.some(env => env.documents.some(d => d.labelStatus === 'ai_suggested'))
        && printQueueExtras.length === 0;
      if (queueDrained) setShowFinalize(true);
      setPendingFinalize(false);
    }
  };
  // "Reprint N" on the confirmation — flip the picked items back to
  // 'ai_suggested' (queued) and reopen the print queue with the full
  // current queue so the worker can re-run the print. Keeps the
  // finalize-gate flag intact so the flow can complete after the
  // reprint is reviewed.
  const handlePrintConfirmationReprint = (picks: EnvelopeDoc[]) => {
    // A pick whose doc.id contains '__dup__' is a duplicate-entry reprint —
    // recreate the extra entry (with its recipient) instead of touching
    // envelopes. Everything else flips the real doc back to 'ai_suggested'.
    const sourceIds = new Set<string>();
    const restoredExtras: Array<{ entryId: string; envelopeId: string; sourceDocId: string; recipient: string; destination?: string }> = [];
    picks.forEach(p => {
      if (p.doc.id.includes('__dup__')) {
        const sourceDocId = p.doc.id.split('__dup__')[0];
        const entryId = sourceDocId + '__dup__' + Date.now().toString(36) + '__' + Math.floor(Math.random() * 1000).toString(36);
        // Resolve the source doc's current destination so we only persist a
        // `destination` override on the restored extra when the dup was
        // actually re-routed. Reprinting an unrouted dup shouldn't spuriously
        // mark it as routed.
        const env = envelopes.find(e => e.id === p.envelope.id);
        const sourceDoc = env?.documents.find(d => d.id === sourceDocId);
        const overrideDest = sourceDoc && p.doc.dispatchedTo && p.doc.dispatchedTo !== sourceDoc.dispatchedTo
          ? p.doc.dispatchedTo
          : undefined;
        restoredExtras.push({
          entryId,
          envelopeId: p.envelope.id,
          sourceDocId,
          recipient: p.doc.labelRecipient ?? '',
          destination: overrideDest,
        });
      } else {
        sourceIds.add(p.doc.id);
      }
    });
    if (sourceIds.size > 0) {
      setEnvelopes(prev => prev.map(env => ({
        ...env,
        documents: env.documents.map(d => sourceIds.has(d.id) ? { ...d, labelStatus: 'ai_suggested' } : d),
      })));
    }
    if (restoredExtras.length > 0) setPrintQueueExtras(prev => [...prev, ...restoredExtras]);
    setPrintConfirmation(null);
    setShowPrintQueue(true);
    addToast(picks.length + ' label' + (picks.length !== 1 ? 's' : '') + ' back in print queue for reprint.');
  };
  // "No label needed" from the queue modal: clears queued status and logs a
  // routing-history entry with the worker-supplied reason. If this empties
  // the queue while the modal is open as a finalize gate, close it and
  // jump to FinalizeModal.
  const handlePrintQueueSkip = (envelopeId: string, docId: string, reason: string) => {
    // If the skipped row is a duplicate entry, drop it from the extras list
    // — no envelope mutation needed.
    const isExtra = printQueueExtras.some(e => e.entryId === docId);
    if (isExtra) {
      setPrintQueueExtras(prev => prev.filter(e => e.entryId !== docId));
    } else {
      setEnvelopes(prev => prev.map(env =>
        env.id !== envelopeId
          ? env
          : { ...env, documents: env.documents.map(d => {
              if (d.id !== docId) return d;
              const entry: RoutingHistoryEntry = {
                action: 'Label skipped',
                user: 'You',
                timestamp: formatLabelDate(),
                note: reason,
              };
              return { ...d, labelStatus: undefined, routingHistory: [...(d.routingHistory ?? []), entry] };
            }) },
      ));
    }
    const remainingSources = pendingAILabels.filter(it => it.doc.id !== docId);
    const remainingExtras = printQueueExtras.filter(e => e.entryId !== docId);
    if (remainingSources.length === 0 && remainingExtras.length === 0 && showPrintQueue) {
      setShowPrintQueue(false);
      if (pendingFinalize) {
        setShowFinalize(true);
        setPendingFinalize(false);
      }
    }
  };
  // Close the print-queue modal without auto-progressing. Cancelling out
  // of the finalize gate also clears the pending flag.
  const handlePrintQueueClose = () => {
    setShowPrintQueue(false);
    setPendingFinalize(false);
  };
  const handleBulkPrintFromSelection = () => {
    const items: EnvelopeDoc[] = [];
    envelopes.forEach(env => env.documents.forEach(d => { if (selectedDocIds.has(d.id)) items.push({ doc: d, envelope: env }); }));
    if (items.length) setBulkLabelItems(items);
  };

  // ── Finalize ──────────────────────────────────────────────────
  // Brief V2 §11/§21 — finalize is gated on the Ungrouped bucket being
  // empty. Archived destinations are caught up-front via the bucket
  // classifier (docs land in Ungrouped), so no late-stage rerouting flow
  // is needed here — the inline banner + Finalize-blocked state surface
  // the work that's left.
  const [finalizeBlockedByUngrouped, setFinalizeBlockedByUngrouped] = useState(false);
  const handleFinalizeClick = () => {
    if (ungroupedCount > 0) {
      setFinalizeBlockedByUngrouped(true);
      return;
    }
    setFinalizeBlockedByUngrouped(false);
    // Print Queue gate: any docs OR duplicate entries in queue must be
    // printed or marked "no label needed" before finalize can proceed.
    // Flag so the queue modal auto-progresses to FinalizeModal when drained.
    if (pendingAILabels.length > 0 || printQueueExtras.length > 0) {
      setPendingFinalize(true);
      setShowPrintQueue(true);
      return;
    }
    setShowFinalize(true);
  };
  // Clear the inline blocker once the worker drains Ungrouped.
  useEffect(() => {
    if (ungroupedCount === 0 && finalizeBlockedByUngrouped) setFinalizeBlockedByUngrouped(false);
  }, [ungroupedCount, finalizeBlockedByUngrouped]);

  // ── Toasts ────────────────────────────────────────────────────
  const addToast = (message: string, star = false) => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, star }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4500);
  };
  const dismissToast = (id: number) => setToasts(prev => prev.filter(t => t.id !== id));

  // ── Trusted routes ────────────────────────────────────────────
  // Click on an inactive star → mark modal. Click on an active star →
  // revoke confirmation. The card ⭐ is the single source of truth for
  // both flows; the Trusted Routes Configurations panel mirrors them.
  const handleTrustStar = (envelopeId: string, doc: Document) => setTrustModal({ envelopeId, docId: doc.id });
  const handleConfirmTrust = ({ selectedFolder, docType }: { selectedFolder: string; docType: string }) => {
    if (!activeTrustTarget) return;
    const { env, doc } = activeTrustTarget;
    const newRoute: TrustedRoute = {
      id: 'tr-' + Date.now(),
      pattern: { sender: env.sender, document_type: docType },
      destination: selectedFolder,
      markedBy: 'Admin',
      markedAt: formatLabelDate(),
      isActive: true,
      usageCount: 0,
    };
    setTrustedRoutes(prev => [...prev, newRoute]);
    // If the source doc isn't already routed to the chosen destination,
    // immediately route it there as part of the same action.
    if (doc.dispatchedTo !== selectedFolder) {
      setEnvelopes(prev => prev.map(envX => envX.id !== env.id ? envX : ({
        ...envX,
        documents: envX.documents.map(d => d.id === doc.id ? { ...d, dispatchedTo: selectedFolder, autoRouted: true, trustedRouteId: newRoute.id } : d),
      })));
      if (!doc.dispatchedTo) {
        setCounts(prev => ({ ...prev, [selectedFolder]: (prev[selectedFolder] || 0) + doc.pages }));
      } else if (doc.dispatchedTo !== selectedFolder) {
        const old = doc.dispatchedTo;
        setCounts(prev => ({
          ...prev,
          [old]: Math.max(0, (prev[old] || 0) - doc.pages),
          [selectedFolder]: (prev[selectedFolder] || 0) + doc.pages,
        }));
      }
    }
    addToast('Trusted route created', true);
    setTrustModal(null);
  };
  // Revoke flow — the card's filled star opens a small ConfirmModal with
  // the pattern + destination spelled out, then flips isActive on the
  // matching route. The source doc keeps its routing; only future matches
  // are affected.
  const [revokeTrustTarget, setRevokeTrustTarget] = useState<{ envelopeId: string; docId: string } | null>(null);
  const handleRevokeTrustStar = (envelopeId: string, doc: Document) => {
    setRevokeTrustTarget({ envelopeId, docId: doc.id });
  };
  const activeRevokeContext = revokeTrustTarget ? (() => {
    const env = envelopes.find(e => e.id === revokeTrustTarget.envelopeId);
    const doc = env?.documents.find(d => d.id === revokeTrustTarget.docId);
    if (!env || !doc) return null;
    const docType = deriveDocType(doc.title, doc.suggestion);
    const route = trustedRoutes.find(r =>
      r.isActive &&
      env.sender.toLowerCase().includes(r.pattern.sender.toLowerCase()) &&
      docType.toLowerCase().includes(r.pattern.document_type.toLowerCase()),
    );
    return route ? { env, doc, docType, route } : null;
  })() : null;
  const handleConfirmRevoke = () => {
    if (!activeRevokeContext) { setRevokeTrustTarget(null); return; }
    const { route } = activeRevokeContext;
    setTrustedRoutes(prev => prev.map(r => r.id === route.id ? { ...r, isActive: false } : r));
    addToast('Trusted route revoked');
    setRevokeTrustTarget(null);
  };
  const handleUndoAutoRoute = (envelopeId: string, doc: Document) => setUndoAutoRoute({ envelopeId, docId: doc.id });
  const handleUndoJustThis = (envelopeId: string, doc: Document) => {
    const wasDest = doc.dispatchedTo!;
    setEnvelopes(prev => prev.map(env => env.id !== envelopeId ? env : { ...env, documents: env.documents.map(d => d.id === doc.id ? { ...d, dispatchedTo: undefined, autoRouted: undefined, trustedRouteId: undefined } : d) }));
    setCounts(prev => ({ ...prev, [wasDest]: Math.max(0, (prev[wasDest] || 0) - doc.pages) }));
    setUndoAutoRoute(null);
  };
  const handleUndoAndRevoke = (envelopeId: string, doc: Document) => {
    const wasDest = doc.dispatchedTo!, routeId = doc.trustedRouteId;
    setEnvelopes(prev => prev.map(env => env.id !== envelopeId ? env : { ...env, documents: env.documents.map(d => d.id === doc.id ? { ...d, dispatchedTo: undefined, autoRouted: undefined, trustedRouteId: undefined } : d) }));
    setCounts(prev => ({ ...prev, [wasDest]: Math.max(0, (prev[wasDest] || 0) - doc.pages) }));
    if (routeId) {
      setTrustedRoutes(prev => prev.map(r => r.id === routeId ? { ...r, isActive: false } : r));
      addToast('Trusted route revoked. Future matches will surface in the workspace for confirmation.');
    }
    setUndoAutoRoute(null);
  };

  // ── Folder management ─────────────────────────────────────────
  const handleFolderContextMenu = (e: React.MouseEvent, folderId: string) => {
    e.preventDefault();
    const folder = folders.find(f => f.id === folderId);
    if (!folder) return;
    setContextMenu({ folderId, name: folder.name, x: e.clientX, y: e.clientY });
  };
  // Open the unified Edit recipient modal. Inactive-admin folders push focus
  // to the admin picker so the user is funneled to the most urgent change.
  const handleOpenEdit = () => {
    if (!contextMenu) return;
    const folder = folders.find(f => f.id === contextMenu.folderId);
    if (!folder) return;
    setEditingFolder(folder);
    setEditAutoFocusAdmin(folder.admin_status === 'inactive_admin');
    setContextMenu(null);
  };
  const handleConfirmEdit = ({ name, folder_type, recipient_type, initialAdminUserId }: { name: string; folder_type: string; recipient_type: RecipientType; initialAdminUserId?: string }) => {
    if (!editingFolder) return;
    const oldFolder = editingFolder;
    const id = oldFolder.id;
    const adminChanged = initialAdminUserId !== oldFolder.admin_user_id;
    const renamed     = name !== oldFolder.name;
    const recipientTypeChanged = recipient_type !== (oldFolder.recipient_type ?? 'group');

    setFolders(prev => prev.map(f => f.id === id ? {
      ...f,
      name,
      folder_type,
      recipient_type,
      admin_user_id: initialAdminUserId,
      // Reassign clears inactive_admin; otherwise leave status alone.
      admin_status: adminChanged ? ('active' as const) : f.admin_status,
    } : f));

    // Brief V2 §11 — deactivate trusted routes on admin change.
    if (adminChanged) setTrustedRoutes(prev => prev.map(r => r.destination === id ? { ...r, isActive: false } : r));

    const newAdmin = initialAdminUserId ? findUser(initialAdminUserId) : undefined;
    const parts: string[] = [];
    if (renamed)              parts.push(`renamed to "${name}"`);
    if (recipientTypeChanged) parts.push(`recipient type set to ${recipient_type === 'personal' ? 'Individual' : 'Group'}`);
    if (adminChanged && newAdmin) parts.push(`reassigned to ${newAdmin.name}`);
    if (parts.length > 0) {
      const trail = adminChanged ? ' Trusted routes deactivated. Logged to Admin Audit Trail.' : '';
      addToast(`${oldFolder.name} updated · ${parts.join(', ')}.${trail}`);
    }
    setEditingFolder(null);
    setEditAutoFocusAdmin(false);
  };
  // Assign delegate — only surfaced on inactive_admin folders. Mocked in
  // local state for the demo; backend would write a FolderDelegation row.
  const handleOpenDelegate = () => {
    if (!contextMenu) return;
    const folder = folders.find(f => f.id === contextMenu.folderId);
    if (!folder || folder.admin_status !== 'inactive_admin') return;
    setDelegateTarget(folder);
    setContextMenu(null);
  };
  const handleConfirmDelegate = ({ delegate, endsAtIso }: { delegate: SsoUser; endsAtIso?: string }) => {
    if (!delegateTarget) return;
    const target = delegateTarget;
    setDelegates(prev => {
      const next = new Map(prev);
      next.set(target.id, { delegateName: delegate.name, delegateUserId: delegate.id, endsAtIso });
      return next;
    });
    const tail = endsAtIso ? ` until ${endsAtIso}` : '';
    addToast(`Delegate assigned · ${delegate.name} now routes for "${target.name}"${tail}. Logged to Change History.`);
    setDelegateTarget(null);
  };
  const handleDeleteFolderClick = () => { setDeletingFolder({ id: contextMenu!.folderId, name: contextMenu!.name }); setContextMenu(null); };
  const handleConfirmDeleteFolder = () => {
    const id = deletingFolder!.id;
    const name = deletingFolder!.name;
    // Brief V2 §11/§21 — when the destination is removed mid-session, the
    // docs routed there fall back to Ungrouped via the bucket classifier
    // (their dispatchedTo is cleared; their suggestion now points at a
    // non-existent folder, so the classifier keys them to 'ungrouped').
    // Count and surface a passive toast naming the folder + doc count.
    let movedCount = 0;
    envelopes.forEach(env => env.documents.forEach(d => {
      if (d.dispatchedTo === id) movedCount += 1;
    }));
    setEnvelopes(prev => prev.map(env => ({ ...env, documents: env.documents.map(d => d.dispatchedTo === id ? { ...d, dispatchedTo: undefined } : d) })));
    setCounts(prev => { const u = { ...prev }; delete u[id]; return u; });
    setFolders(prev => prev.filter(f => f.id !== id));
    setDeletingFolder(null);
    if (movedCount > 0) {
      addToast(`${name} was archived. ${movedCount} doc${movedCount !== 1 ? 's' : ''} moved to Ungrouped.`);
    }
  };
  const handleAddFolder = ({ name, folder_type, recipient_type, initialAdminUserId }: { name: string; folder_type: string; recipient_type: RecipientType; initialAdminUserId?: string }) => {
    const id = 'folder-' + Date.now();
    setFolders(prev => [...prev, { id, name, folder_type, parent_folder_id: null, admin_user_id: initialAdminUserId, admin_status: 'active', recipient_type }]);
    setCounts(prev => ({ ...prev, [id]: 0 }));
    setShowAddFolder(false);
    addToast(`Recipient "${name}" created.`);
  };

  // ── Reset ─────────────────────────────────────────────────────
  const handleReset = () => {
    const p = applyTrustedRoutes(INITIAL_ENVELOPES, INITIAL_TRUSTED_ROUTES);
    setEnvelopes(p);
    setCounts(computeInitialCounts(p));
    setFolders(getRootFolders());
    setDraggedDoc(null); setHoveredBucket(null); setPreviewDoc(null);
    setShowAddFolder(false); setShowFinalize(false); setDeleteTarget(null);
    setContextMenu(null); setEditingFolder(null); setEditAutoFocusAdmin(false); setDeletingFolder(null);
    setSearchTerm(''); setSelectedDocIds(new Set());
    setBulkLabelItems(null); setShowPrintQueue(false); setPendingFinalize(false); setPrintConfirmation(null); setPrintQueueExtras([]);
    setKnownRecipients(new Set());
    setTrustedRoutes([...INITIAL_TRUSTED_ROUTES]);
    setTrustModal(null); setUndoAutoRoute(null); setToasts([]);
  };

  const dragBulkCount = draggedDoc?.bulk ? draggedDoc.items.length : 0;
  const draggedDocId = draggedDoc && !draggedDoc.bulk ? draggedDoc.doc.id : null;
  const allRecipientsList = [...knownRecipients];

  // ── Drill-into-folder filter view ────────────────────────────────────
  if (drilledFolderId) {
    const drilledFolder = folders.find(f => f.id === drilledFolderId);
    const drilledName = drilledFolder?.name ?? (drilledFolderId === 'junk' ? 'Junk' : drilledFolderId);
    const drilledAdmin = drilledFolder?.admin_user_id ? findUser(drilledFolder.admin_user_id) : undefined;
    const drilledDocs: EnvelopeDoc[] = [];
    envelopes.forEach(env => env.documents.forEach(doc => {
      if (doc.dispatchedTo === drilledFolderId) drilledDocs.push({ doc, envelope: env });
    }));
    const totalPages = drilledDocs.reduce((s, { doc }) => s + doc.pages, 0);
    return (
      <div className="flex flex-col h-screen bg-slate-100" style={{ fontFamily: '-apple-system,BlinkMacSystemFont,"SF Pro Text","Segoe UI",Roboto,sans-serif' }}>
        <div className="bg-white border-b border-gray-200 flex-shrink-0">
          <div className="px-6 py-2 border-b border-gray-100">
            <button onClick={handleExitDrill}
              className="flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-800 transition-colors">
              <ChevronLeft className="w-3.5 h-3.5" /> Back to Mail Batch
            </button>
          </div>
          <div className="px-6 py-3 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-sm">
              <Inbox className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg font-semibold text-gray-900 truncate">{drilledName}</h1>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                {drilledDocs.length} doc{drilledDocs.length !== 1 ? 's' : ''} routed here{totalPages > 0 ? ` · ${totalPages} pg` : ''}
                {drilledAdmin ? (
                  <> · Admin: <span className="text-gray-700">{drilledAdmin.name}</span>
                    {drilledAdmin.title && <span className="text-gray-500"> — {drilledAdmin.title}</span>}
                  </>
                ) : null}
              </p>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 max-w-4xl w-full mx-auto space-y-2">
          {drilledDocs.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-200 px-6 py-12 text-center">
              <Check className="w-10 h-10 text-emerald-400 mx-auto mb-3 opacity-50" />
              <p className="text-sm font-medium text-gray-700">Nothing routed here yet</p>
              <p className="text-xs text-gray-400 mt-1">Drop documents on this folder from the main view to see them here.</p>
            </div>
          ) : drilledDocs.map(({ doc, envelope }) => (
            <div key={doc.id} className="bg-white border border-gray-200 rounded-2xl px-4 py-3 flex items-center gap-3 hover:shadow-sm transition-all">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{doc.title}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  <span className="font-mono">#{doc.docId || doc.id.slice(0, 6)}</span>
                  <span className="text-gray-300 mx-1.5">·</span>
                  {doc.pages} pg
                  <span className="text-gray-300 mx-1.5">·</span>
                  from <span className="text-gray-700">{envelope.sender}</span>
                </p>
              </div>
              <button onClick={() => handlePreview(envelope.id, doc.id)}
                className="px-3 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded-md transition-colors inline-flex items-center gap-1.5">
                <Eye className="w-3.5 h-3.5" /> Preview
              </button>
              <button onClick={() => handleUndoDispatch(envelope.id, doc)}
                className="px-3 py-1.5 text-xs font-medium text-gray-700 border border-gray-200 hover:bg-gray-100 rounded-md transition-colors inline-flex items-center gap-1.5">
                <Undo2 className="w-3.5 h-3.5" /> Undo
              </button>
            </div>
          ))}
        </div>

        {currentPreviewDoc && <DocumentPreviewModal doc={currentPreviewDoc} envelopeId={previewDoc!.envelopeId} folderNameMap={folderNameMap} onClose={handleClosePreview} onApplySplit={handleApplySplit} />}
        <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────
  return (
    <div className="flex h-screen bg-slate-100" style={{ fontFamily: '-apple-system,BlinkMacSystemFont,"SF Pro Text","Segoe UI",Roboto,sans-serif' }}>
      {/* ── Left panel ── */}
      <div className="flex flex-col" style={{ width: '75%' }}>
        {/* Header */}
        <div className="bg-white border-b border-gray-200 flex-shrink-0">
          <div className="px-6 py-2 flex items-center justify-between border-b border-gray-100">
            <button onClick={() => { if (onBackToMailLog) onBackToMailLog(); else router.push('/mail-log'); }}
              className="flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-800 transition-colors flex-shrink-0">
              <ChevronLeft className="w-3.5 h-3.5" /> Back to Mail Log
            </button>
            <button onClick={handleReset} className="text-xs font-medium text-gray-500 hover:text-gray-800 transition-colors">Reset demo</button>
          </div>
          <div className="px-6 py-3 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-sm">
              <Mail className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg font-semibold text-gray-900">{run?.name ?? 'Mail Batch — Nov 12, 2025'}</h1>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${totalRemaining === 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                  {totalRemaining === 0 ? 'Ready to finalize' : 'In Progress'}
                </span>
                {autoRoutedCount > 0 && (
                  <div className="relative z-40">
                    <button onClick={() => setShowAutoRoutedPanel(p => !p)}
                      title="Review and undo auto-routed documents"
                      className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors">
                      {autoRoutedCount} auto-routed
                    </button>
                    {showAutoRoutedPanel && (
                      <>
                        <div className="fixed inset-0 z-30" onClick={() => setShowAutoRoutedPanel(false)} />
                        <div className="absolute left-0 top-full mt-2 z-40 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden" style={{ width: 360 }}>
                          <div className="px-3 py-2 border-b border-gray-100 bg-gray-50 flex items-center gap-1.5">
                            <Star className="w-3 h-3 flex-shrink-0" style={{ fill: '#93c5fd', color: '#3b82f6' }} />
                            <p className="text-[11px] uppercase tracking-wide font-semibold text-gray-500">Auto-routed · {autoRoutedDocs.length}</p>
                          </div>
                          <ul className="divide-y divide-gray-100 max-h-72 overflow-y-auto">
                            {autoRoutedDocs.map(({ doc, envelope }) => (
                              <li key={doc.id} className="px-3 py-2 flex items-center gap-3">
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-gray-900 truncate">{doc.title}</p>
                                  <p className="text-[11px] text-gray-500 truncate">
                                    routed to → <span className="font-medium text-gray-700">{folderNameMap[doc.dispatchedTo!] || doc.dispatchedTo}</span>
                                  </p>
                                </div>
                                <button onClick={() => handleUndoAutoRoute(envelope.id, doc)}
                                  className="flex-shrink-0 inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-blue-700 hover:bg-blue-50 border border-blue-200 rounded-md transition-colors">
                                  <Undo2 className="w-3 h-3" /> Undo
                                </button>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                <span className="font-medium">Tip:</span>{' '}
                Drag documents or batch headers to folders · Right-click + drag a doc to send a copy · Star to mark as a trusted route · Double-click a title to rename
              </p>
            </div>
            <button onClick={() => setShowUploadInWorkspace(true)}
              title="Upload documents into this workspace"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 border border-blue-600 rounded-lg shadow-sm transition-colors flex-shrink-0">
              <Plus className="w-3.5 h-3.5" /> Upload Document
            </button>
          </div>
          {/* Toolbar — Select all + folder filter dropdown + business-name
              search. The chip row was consolidated into a single multi-select
              dropdown; Select all stays on the left driving the existing
              bulk-select state. The search input lives at the right edge of
              the same row and stays mounted during search so the input
              doesn't disappear mid-type. */}
          {(orderedBuckets.length > 0 || isSearching) && (
            <div className="px-6 py-2 border-t border-gray-100 bg-gray-50 flex items-center gap-3 flex-wrap">
              {!isSearching && undispatchedInView.length > 0 && (
                <>
                  <button onClick={handleWorkspaceSelectAllToggle}
                    className="inline-flex items-center gap-2 text-[11px] font-medium text-gray-700 hover:text-gray-900 transition-colors flex-shrink-0">
                    <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all ${workspaceSelectAllMode ? 'bg-white border-gray-400' : 'bg-blue-500 border-blue-500'}`}>
                      {!workspaceSelectAllMode && <Check className="w-2.5 h-2.5 text-white" />}
                    </div>
                    {workspaceSelectAllMode ? 'Select all' : 'Deselect all'}
                  </button>
                  <div className="w-px h-4 bg-gray-300 flex-shrink-0" />
                </>
              )}
              {!isSearching && (
                <FolderFilterDropdown
                  options={orderedBuckets.map(b => ({
                    id: b.folderId,
                    name: folderNameMap[b.folderId] || b.folderId,
                    count: b.items.length,
                  }))}
                  selected={bucketFilters}
                  onChange={setBucketFilters}
                />
              )}
              <div className="flex-1 min-w-0 relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
                <input value={searchTerm} onChange={e => handleSearchChange(e.target.value)}
                  placeholder="Search document keywords, document titles, business names…"
                  className="w-full pl-7 pr-7 py-1.5 text-xs text-gray-900 placeholder:text-gray-400 border border-gray-200 rounded-lg bg-white focus:border-blue-400 focus:outline-none transition-all" />
                {searchTerm && <button onClick={() => handleSearchChange('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"><X className="w-3 h-3" /></button>}
              </div>
            </div>
          )}
        </div>

        {/* Main content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {finalizeBlockedByUngrouped && (
            <div className="bg-red-50 border border-red-300 rounded-xl px-4 py-3 flex items-start gap-3 shadow-sm">
              <div className="w-8 h-8 rounded-lg bg-white border border-red-300 flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-red-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              </div>
              <div className="flex-1 min-w-0 text-xs">
                <p className="font-semibold text-red-900">
                  Couldn&apos;t finalize: {ungroupedCount} doc{ungroupedCount !== 1 ? 's' : ''} need a destination. Route from the Ungrouped group to continue.
                </p>
              </div>
            </div>
          )}
          {printQueueTotal > 0 && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 flex items-center gap-3">
              <Printer className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
              <p className="text-xs text-slate-700 flex-1 min-w-0">
                <span className="font-semibold">{printQueueTotal}</span> in print queue
              </p>
              <button onClick={() => setShowPrintQueue(true)}
                className="flex items-center gap-1.5 px-3 py-1 bg-blue-600 text-white border border-blue-600 rounded-md text-xs font-semibold shadow-sm hover:bg-blue-700 transition-colors flex-shrink-0">
                Review &amp; print
              </button>
            </div>
          )}
          {isSearching && (
            <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-xs shadow-sm">
              {flatMatches.length > 0 ? (
                <>
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0" />
                  <span className="text-gray-600"><span className="font-semibold text-gray-900">{flatMatches.length}</span> doc{flatMatches.length !== 1 ? 's' : ''} match <span className="text-blue-600 font-medium">&quot;{searchTerm.trim()}&quot;</span></span>
                  <button onClick={handleSelectAllMatches} className="ml-1 px-2 py-0.5 bg-blue-50 text-blue-600 font-medium rounded-md hover:bg-blue-100 transition-colors flex-shrink-0">Select all {flatMatches.length}</button>
                  {selectedDocIds.size > 0 && (
                    <>
                      <span className="text-gray-300 flex-shrink-0">·</span>
                      <span className="font-semibold text-blue-700 flex-shrink-0">{selectedDocIds.size} selected</span>
                      <button onClick={handleBulkPrintFromSelection} className="flex items-center gap-1 px-2 py-0.5 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 transition-colors flex-shrink-0"><Printer className="w-3 h-3" /> Print labels</button>
                      <button onClick={handleClearSelection} className="ml-auto flex items-center gap-1 text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0"><X className="w-3 h-3" /> Clear</button>
                    </>
                  )}
                </>
              ) : (
                <>
                  <Search className="w-3 h-3 text-gray-300 flex-shrink-0" />
                  <span className="text-gray-400">No matches for <span className="font-medium text-gray-600">&quot;{searchTerm.trim()}&quot;</span></span>
                </>
              )}
            </div>
          )}
          {!isSearching && returnsList.length > 0 && (
            <div>
              <p className="text-[11px] uppercase tracking-[0.08em] font-semibold text-amber-700 mb-2">
                ↩ Returned · {returnsList.length} doc{returnsList.length !== 1 ? 's' : ''}
              </p>
              <div className="space-y-2">
                {returnsList.map(({ doc, envelope }) => (
                  <ReturnedDocCard key={doc.id}
                    doc={doc} envelopeId={envelope.id} senderName={envelope.sender}
                    isDragging={draggedDocId === doc.id}
                    onDragStart={handleDragStart} onDragEnd={handleDragEnd}
                    onPreview={handlePreview}
                    onSecondaryAction={(envId, d) => handleDiscardReturn(envId, d)}
                    secondaryKind="discard" />
                ))}
              </div>
            </div>
          )}
          {isSearching
            ? <FlatSearchList items={flatMatches} searchTerm={searchTerm.trim()} selectedDocIds={selectedDocIds} folderNameMap={folderNameMap}
                onToggleSelect={handleToggleSelect} onSelectAll={handleSelectAllMatches} onClear={handleClearSelection}
                onDragStart={handleDragStart} onDragEnd={handleDragEnd} draggedDocId={draggedDocId}
                onPreview={handlePreview} onReleaseNow={handleReleaseNow} onDeleteDoc={handleDeleteDoc} onPrintLabel={handleTogglePrintQueue}
                onDuplicate={handleDuplicateDoc}
                trustedRoutes={trustedRoutes} onTrustStar={handleTrustStar} onRevokeTrustStar={handleRevokeTrustStar} onRename={handleRenameDoc} />
            : visibleBuckets.map(({ folderId, items }) => (
                <DepartmentBucketCard key={folderId} folderId={folderId} items={items} folderNameMap={folderNameMap}
                  onDragStart={handleDragStart} onRightDragStart={handleRightDragStart} onBatchDragStart={handleBatchDragStart} onDragEnd={handleDragEnd} draggedDocId={draggedDocId}
                  onPreview={handlePreview} onAutoDispatch={handleAutoDispatch} onReleaseNow={handleReleaseNow}
                  onRemoveInstance={handleRemoveInstance} onDeleteDoc={handleDeleteDoc} onPrintLabel={handleTogglePrintQueue}
                  onDuplicate={handleDuplicateDoc}
                  trustedRoutes={trustedRoutes} onTrustStar={handleTrustStar} onRevokeTrustStar={handleRevokeTrustStar}
                  onUndoAutoRoute={handleUndoAutoRoute} onRename={handleRenameDoc}
                  isUngrouped={folderId === 'ungrouped'}
                  selectedDocIds={selectedDocIds} selectionMode={selectedDocIds.size > 0} onToggleSelect={handleToggleSelect} />
              ))
          }
          {!isSearching && orderedBuckets.length === 0 && (
            <div className="bg-white rounded-2xl border border-gray-200 px-6 py-12 text-center">
              <Check className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
              <p className="text-sm font-medium text-gray-700">All mail has been routed</p>
            </div>
          )}
          <div className="text-center pt-2 pb-6"><p className="text-xs text-gray-400">— End of today&apos;s mail —</p></div>
        </div>

        {/* Finalize bar */}
        {totalRemaining === 0 && dispatchedTotal > 0 && (
          <div className="px-6 py-4 border-t border-emerald-100 bg-gradient-to-r from-emerald-50 to-green-50 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0"><Check className="w-5 h-5 text-emerald-600" /></div>
              <div>
                <p className="text-sm font-semibold text-gray-900">All mail dispatched</p>
                <p className="text-xs text-gray-500">{dispatchedTotal} pages · {dispatchSummary.length} folder{dispatchSummary.length !== 1 ? 's' : ''}{labelsPrintedCount > 0 ? ' · ' + labelsPrintedCount + ' label' + (labelsPrintedCount !== 1 ? 's' : '') + ' printed' : ''}</p>
              </div>
            </div>
            <button onClick={handleFinalizeClick} className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 transition-colors shadow-md">Finalize Dispatch</button>
          </div>
        )}
      </div>

      {/* ── Right panel ── */}
      <div className="bg-white border-l border-gray-200 flex flex-col" style={{ width: '25%' }}>
        {selectedDocIds.size > 0 && !isSearching && (
          <div className="px-3 py-2 bg-blue-50 border-b border-blue-200 flex items-center gap-2 flex-shrink-0">
            <span className="text-xs font-semibold text-blue-700 flex-1">{selectedDocIds.size} selected</span>
            <button onClick={handleClearSelection}
              className="flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium text-blue-700 hover:bg-blue-100 rounded-md transition-colors">
              <X className="w-3 h-3" /> Clear
            </button>
          </div>
        )}
        <div className="px-4 pt-3 pb-2 border-b border-gray-200 flex-shrink-0 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-gray-900">Dispatch to</h2>
            {onSaveProgress && (
              <div className="flex items-center gap-2">
                {saveConfirmedAt && (
                  <span className="text-[11px] text-emerald-700 font-medium">
                    Saved · {saveConfirmedAt}
                  </span>
                )}
                <button
                  onClick={() => {
                    onSaveProgress(envelopes);
                    const stamp = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
                    setSaveConfirmedAt(stamp);
                    window.setTimeout(() => setSaveConfirmedAt(null), 4000);
                  }}
                  title="Snapshot current routing and mark this run as In Progress in the Mail Log"
                  className="px-2.5 py-1 text-[11px] font-medium text-gray-700 bg-white hover:bg-gray-50 border border-gray-300 rounded-md transition-colors"
                >
                  Save progress
                </button>
              </div>
            )}
          </div>
          <p className="text-xs text-gray-500">Drag scans · right-click to manage</p>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
            <input value={folderSearch} onChange={e => setFolderSearch(e.target.value)}
              placeholder="Search folders…"
              className="w-full pl-7 pr-7 py-1 text-xs text-gray-900 placeholder:text-gray-400 border border-gray-200 rounded-md bg-gray-50 focus:bg-white focus:border-blue-400 focus:outline-none transition-all" />
            {folderSearch && <button onClick={() => setFolderSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><X className="w-3 h-3" /></button>}
          </div>
        </div>
        <div className="flex-1 p-3 overflow-y-auto bg-gradient-to-b from-slate-50 to-slate-100">
          {(() => {
            const visibleFolders = folders
              .filter(f => !f.is_archived)
              .filter(f => !folderSearch.trim() || f.name.toLowerCase().includes(folderSearch.trim().toLowerCase()));
            const renderBucket = (folder: Folder) => (
              <BucketTile key={folder.id} id={folder.id} name={folder.name}
                count={counts[folder.id] || 0} isFolder={true}
                hovered={hoveredBucket === folder.id && !!draggedDoc} pulsing={pulsing === folder.id} bulkCount={dragBulkCount}
                onClick={draggedDoc ? undefined : () => handleEnterDrill(folder.id)}
                onDragOver={e => handleDragOver(e, folder.id)} onDragLeave={handleDragLeave} onDrop={e => handleDrop(e, folder.id)}
                onContextMenu={handleFolderContextMenu} />
            );
            // Sort A→Z within each section; default recipient_type is 'group'.
            const sorted = [...visibleFolders].sort((a, b) => a.name.localeCompare(b.name));
            const groupItems      = sorted.filter(f => (f.recipient_type ?? 'group') === 'group');
            const individualItems = sorted.filter(f => f.recipient_type === 'personal');
            return (
              <div className="space-y-3">
                {groupItems.length > 0      && <FolderSection sectionKey="group"      label="Group"      items={groupItems}      collapsed={collapsedSections.has('group')}      onToggle={toggleSection} renderBucket={renderBucket} />}
                {individualItems.length > 0 && <FolderSection sectionKey="individual" label="Individual" items={individualItems} collapsed={collapsedSections.has('individual')} onToggle={toggleSection} renderBucket={renderBucket} />}
              </div>
            );
          })()}
          <div className="grid grid-cols-2 gap-1 mt-2">
            <BucketTile id="junk" name="Junk" count={counts.junk || 0} isFolder={false}
              hovered={hoveredBucket === 'junk' && !!draggedDoc} pulsing={pulsing === 'junk'} bulkCount={dragBulkCount}
              onClick={draggedDoc ? undefined : () => handleEnterDrill('junk')}
              onDragOver={e => handleDragOver(e, 'junk')} onDragLeave={handleDragLeave} onDrop={e => handleDrop(e, 'junk')} />
          </div>
        </div>
        <div className="px-4 py-3 bg-white border-t border-gray-200 flex-shrink-0">
          {canAddFolder && (
            <button onClick={() => setShowAddFolder(true)} className="w-full flex items-center justify-center gap-1.5 px-3 py-2 mb-3 text-xs font-medium text-blue-600 hover:bg-blue-50 border border-dashed border-blue-300 rounded-lg transition-colors">+ Add Recipient</button>
          )}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs"><span className="text-gray-500">Dispatched today</span><span className="font-semibold text-gray-900">{dispatchedTotal} pg</span></div>
            <div className="flex justify-between text-xs"><span className="text-gray-500">Remaining</span><span className="font-semibold text-gray-900">{totalPagesRemaining} pg</span></div>
            {labelsPrintedCount > 0 && <div className="flex justify-between text-xs"><span className="text-gray-500 flex items-center gap-1"><Printer className="w-3 h-3" /> Labels</span><span className="font-semibold text-gray-900">{labelsPrintedCount}</span></div>}
            {autoRoutedCount > 0 && <div className="flex justify-between text-xs"><span className="text-gray-500 flex items-center gap-1"><Star className="w-3 h-3" style={{ fill: '#93c5fd', color: '#3b82f6' }} /> Auto-routed</span><span className="font-semibold text-gray-900">{autoRoutedCount}</span></div>}
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mt-2">
              <div className="h-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-500" style={{ width: progress + '%' }} />
            </div>
          </div>
        </div>
      </div>

      {/* Urgent-release undo toast — 15s window, bottom-left, separate from
          the standard ToastContainer (which lives bottom-right). */}
      {urgentRecall && <UrgentRecallToast
        docTitle={urgentRecall.docTitle}
        startedAt={urgentRecall.startedAt}
        onUndo={handleUndoRelease}
        onExpire={() => setUrgentRecall(null)}
      />}

      {/* ── Modals ── */}
      {showAddFolder && <AddFolderModal onSubmit={handleAddFolder} onClose={() => setShowAddFolder(false)} />}
      {/* Right-click-drag ghost: fixed-position floating chip that follows
          the cursor while the gesture is active. */}
      {rightDrag && (
        <div className="fixed pointer-events-none z-50 flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-md shadow-2xl"
          style={{ left: rightDragPos.x + 12, top: rightDragPos.y + 12 }}>
          <Copy className="w-3.5 h-3.5" /> Copy: {rightDrag.doc.title}
        </div>
      )}
      {/* Floating bulk-action bar — appears when 1+ docs are selected.
          Text-button styling: each action is a flat colored text button
          with a thin vertical divider in between, all inside one pill. */}
      {selectedDocIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-1 bg-white border border-gray-200 rounded-full shadow-xl px-4 py-1.5">
          <span className="text-xs font-semibold text-gray-700 pr-2">{selectedDocIds.size} selected</span>
          <div className="w-px h-4 bg-gray-200" />
          <button onClick={handleBulkPrintLabels}
            className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors">
            <Printer className="w-3.5 h-3.5" /> Print labels ({selectedDocIds.size})
          </button>
          <div className="w-px h-4 bg-gray-200" />
          <button onClick={() => setConfirmBulkDelete(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors">
            <Trash2 className="w-3.5 h-3.5" /> Delete ({selectedDocIds.size})
          </button>
          <div className="w-px h-4 bg-gray-200" />
          <button onClick={handleClearSelection}
            className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors">
            <X className="w-3.5 h-3.5" /> Clear
          </button>
        </div>
      )}
      {confirmBulkDelete && (
        <ConfirmModal
          title={`Delete ${selectedDocIds.size} document${selectedDocIds.size !== 1 ? 's' : ''}?`}
          body="These documents will be soft-deleted and removed from active circulation. Originals are preserved in the archive. This cannot be undone from this view."
          confirmLabel={`Delete ${selectedDocIds.size}`}
          danger
          onConfirm={handleBulkDeleteConfirm}
          onClose={() => setConfirmBulkDelete(false)}
        />
      )}
      {showUploadInWorkspace && (
        <UploadDocumentModal
          onAdd={handleUploadInWorkspaceAdd}
          onClose={() => setShowUploadInWorkspace(false)}
        />
      )}
      {showFinalize && <FinalizeModal summary={dispatchSummary} total={dispatchedTotal} labelsPrinted={labelsPrintedCount} onClose={() => setShowFinalize(false)} />}
      {deleteTarget && <ConfirmModal title="Delete scan permanently?" body={'Scan #' + deleteTarget.doc.docId + ' will be soft-deleted. Original preserved in archive.'} confirmLabel="Delete scan" danger onConfirm={handleConfirmDeleteDoc} onClose={() => setDeleteTarget(null)} />}
      {contextMenu && (() => {
        const target = folders.find(f => f.id === contextMenu.folderId);
        const isInactive = target?.admin_status === 'inactive_admin';
        return (
          <FolderContextMenu x={contextMenu.x} y={contextMenu.y} name={contextMenu.name}
            editEmphasized={isInactive}
            // Brief §3 — Edit / Assign delegate / Archive are structural
            // actions. Delegate View (Mailroom scope) can route, return,
            // forward, and process — never restructure. Gate all three
            // to the owner role for this workroom: System Admin.
            onEdit={user.role === 'System_Admin' ? handleOpenEdit : undefined}
            onAssignDelegate={user.role === 'System_Admin' && isInactive ? handleOpenDelegate : undefined}
            onArchive={user.role === 'System_Admin' ? handleDeleteFolderClick : undefined}
            onClose={() => setContextMenu(null)} />
        );
      })()}
      {editingFolder && (
        <AddFolderModal
          initialFolder={editingFolder}
          autoFocusAdmin={editAutoFocusAdmin}
          onSubmit={handleConfirmEdit}
          onClose={() => { setEditingFolder(null); setEditAutoFocusAdmin(false); }}
        />
      )}
      {delegateTarget && (() => {
        const adminUser = delegateTarget.admin_user_id ? findUser(delegateTarget.admin_user_id) : undefined;
        return (
          <AssignDelegateModal
            folderName={delegateTarget.name}
            adminName={adminUser?.name ?? 'this folder admin'}
            excludeUserId={delegateTarget.admin_user_id}
            onConfirm={handleConfirmDelegate}
            onClose={() => setDelegateTarget(null)}
          />
        );
      })()}
      {deletingFolder && <ConfirmModal title={`Delete "${deletingFolder.name}"?`} body={(counts[deletingFolder.id] || 0) > 0 ? (counts[deletingFolder.id] + ' page' + (counts[deletingFolder.id] !== 1 ? 's' : '') + ' queued will return to workspace.') : 'The folder is empty.'} confirmLabel="Delete folder" danger onConfirm={handleConfirmDeleteFolder} onClose={() => setDeletingFolder(null)} />}
      {showPrintQueue && (
        <PrintQueueModal
          items={printQueueEntries}
          allRecipients={allRecipientsList}
          folderNameMap={folderNameMap}
          destinationOptions={folders.map(f => ({ id: f.id, name: f.name }))}
          onConfirm={handlePrintQueueConfirm}
          onSkip={handlePrintQueueSkip}
          onPreviewDoc={handlePreview}
          onDuplicate={handleDuplicatePrintEntry}
          onChangeEntryDestination={handleEntryDestinationChange}
          defaultRecipientForFolder={folderId => {
            const folder = folders.find(f => f.id === folderId);
            if (!folder?.admin_user_id) return undefined;
            return findUser(folder.admin_user_id)?.name;
          }}
          onClose={handlePrintQueueClose}
        />
      )}
      {bulkLabelItems && (
        <PrintQueueModal
          items={bulkLabelItems}
          allRecipients={allRecipientsList}
          folderNameMap={folderNameMap}
          onConfirm={updates => { handlePrintQueueConfirm(updates); setBulkLabelItems(null); }}
          onSkip={(envelopeId, docId, reason) => { handlePrintQueueSkip(envelopeId, docId, reason); setBulkLabelItems(prev => prev?.filter(it => it.doc.id !== docId) ?? null); }}
          onPreviewDoc={handlePreview}
          defaultRecipientForFolder={folderId => {
            const folder = folders.find(f => f.id === folderId);
            if (!folder?.admin_user_id) return undefined;
            return findUser(folder.admin_user_id)?.name;
          }}
          onClose={() => setBulkLabelItems(null)}
        />
      )}
      {printConfirmation && (
        <PrintConfirmationModal
          items={printConfirmation}
          folderNameMap={folderNameMap}
          onReprint={handlePrintConfirmationReprint}
          onConfirm={handlePrintConfirmationContinue}
          onClose={handlePrintConfirmationContinue}
        />
      )}
      {activeTrustTarget && <TrustedRouteModal doc={activeTrustTarget.doc} envelope={activeTrustTarget.env} folders={folders} counts={counts} folderNameMap={folderNameMap} onConfirm={handleConfirmTrust} onClose={() => setTrustModal(null)} />}
      {activeRevokeContext && (
        <ConfirmModal
          title="Revoke trusted route?"
          body={`This rule auto-routes matching documents from ${activeRevokeContext.env.sender} of type ${activeRevokeContext.docType} to ${folderNameMap[activeRevokeContext.route.destination] || activeRevokeContext.route.destination}. Future matching documents will require manual routing.`}
          confirmLabel="Revoke route"
          danger
          onConfirm={handleConfirmRevoke}
          onClose={() => setRevokeTrustTarget(null)}
        />
      )}
      {activeUndoTarget && <UndoAutoRouteModal doc={activeUndoTarget.doc} envelope={activeUndoTarget.env} onJustThis={handleUndoJustThis} onUndoAndRevoke={handleUndoAndRevoke} onClose={() => setUndoAutoRoute(null)} />}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      {/* Rendered last so it draws on top of any other open modal (e.g. label modal) */}
      {currentPreviewDoc && <DocumentPreviewModal doc={currentPreviewDoc} envelopeId={previewDoc!.envelopeId} folderNameMap={folderNameMap} onClose={handleClosePreview} onApplySplit={handleApplySplit} />}
    </div>
  );
}

// Right-panel accordion section — recipient_type grouping. Header chevron +
// label + count; entire header is clickable. Section is hidden by the caller
// when it has zero items.
function FolderSection({ sectionKey, label, items, collapsed, onToggle, renderBucket }: {
  sectionKey: SectionKey;
  label: string;
  items: Folder[];
  collapsed: boolean;
  onToggle: (k: SectionKey) => void;
  renderBucket: (f: Folder) => React.ReactNode;
}) {
  return (
    <div>
      <button onClick={() => onToggle(sectionKey)}
        className="w-full flex items-center gap-1.5 px-1 mb-1 text-[10px] uppercase tracking-wide font-semibold text-gray-400 hover:text-gray-600 transition-colors">
        {collapsed
          ? <ChevronRight className="w-3 h-3 flex-shrink-0" />
          : <ChevronDown className="w-3 h-3 flex-shrink-0" />}
        <span className="flex-1 truncate text-left">{label}</span>
        <span className="text-gray-500">{items.length}</span>
      </button>
      {!collapsed && <div className="grid grid-cols-2 gap-1">{items.map(renderBucket)}</div>}
    </div>
  );
}

// 15-second undo affordance after Release Now. Renders bottom-left so it
// doesn't collide with the standard ToastContainer (bottom-right). Auto-
// dismisses when the timer hits zero; the recall callback is one-shot.
function UrgentRecallToast({ docTitle, startedAt, onUndo, onExpire }: {
  docTitle: string;
  startedAt: number;
  onUndo: () => void;
  onExpire: () => void;
}) {
  const TOTAL = 15;
  const [secondsLeft, setSecondsLeft] = useState(TOTAL);
  useEffect(() => {
    const tick = () => {
      const elapsed = Math.floor((Date.now() - startedAt) / 1000);
      const remaining = Math.max(0, TOTAL - elapsed);
      setSecondsLeft(remaining);
      if (remaining <= 0) onExpire();
    };
    tick();
    const interval = window.setInterval(tick, 250);
    return () => window.clearInterval(interval);
  }, [startedAt, onExpire]);
  if (secondsLeft <= 0) return null;
  return (
    <div className="fixed bottom-6 left-6 z-50 flex items-center gap-3 px-4 py-3 bg-gray-900 text-white rounded-xl shadow-2xl text-sm" style={{ maxWidth: 420 }}>
      <Zap className="w-4 h-4 flex-shrink-0 text-red-400" />
      <span className="flex-1 leading-snug truncate">
        Urgent release sent — <span className="font-medium">{docTitle}</span>
      </span>
      <button onClick={onUndo}
        className="flex-shrink-0 inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-md transition-colors">
        Undo
      </button>
      <span className="flex-shrink-0 text-xs text-gray-400 tabular-nums" style={{ minWidth: 28, textAlign: 'right' }}>{secondsLeft}s</span>
    </div>
  );
}
