'use client';
import { useState, useMemo, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Inbox, ChevronLeft, ChevronDown, ChevronRight, Search, X, Check, Sparkles, AlertTriangle, Bell, Undo2, Plus, Copy } from 'lucide-react';
import type { Document, Envelope, Folder, Toast, DragState, SplitGroup, EnvelopeDoc, RoutingHistoryEntry, TrustedRoute, RecipientType } from '@/src/types';
import { FOLDERS, getChildFolders, findFolder } from '@/src/mocks/data';
import { applyTrustedRoutes, formatLabelDate, deriveDocType } from '@/src/lib/utils';
import { getInboxEnvelopesFor, FOLDER_ADMIN_FOLDERS } from '@/src/mocks/deptHeadData';
import { useUser } from '@/src/context/UserContext';
import BucketTile from '@/src/components/shared/BucketTile';
import ToastContainer from '@/src/components/shared/ToastContainer';
import DocumentRow from '@/src/components/DocumentRow';
import DocThumbnail from '@/src/components/shared/DocThumbnail';
import FlatSearchList from '@/src/components/FlatSearchList';
import DocumentPreviewModal from '@/src/components/modals/DocumentPreviewModal';
import FinalizeModal from '@/src/components/modals/FinalizeModal';
import ConfirmModal from '@/src/components/modals/ConfirmModal';
import ReturnModal from '@/src/components/modals/ReturnModal';
import ReturnedDocCard from '@/src/components/ReturnedDocCard';
import DownloadArchiveModal from '@/src/components/modals/DownloadArchiveModal';
import AddFolderModal from '@/src/components/modals/AddFolderModal';
import UploadDocumentModal from '@/src/components/modals/UploadDocumentModal';
import ForwardModal from '@/src/components/modals/ForwardModal';
import TrustedRouteModal from '@/src/components/modals/TrustedRouteModal';
import FolderContextMenu from '@/src/components/modals/FolderContextMenu';
import AssignDelegateModal from '@/src/components/modals/AssignDelegateModal';
import MacOutbox from '@/src/components/icons/MacOutbox';
import { findUser, type SsoUser } from '@/src/mocks/users';

const RETURN_ID = 'return';
const PROCESS_QUEUE_ID = 'process-queue';
const SECTION_COLLAPSED_KEY = 'folder-workspace-section-collapsed';
type SectionKey = 'group' | 'individual';

interface Props {
  folderId?: string;                 // Folder being administered. Defaults to user.folders[0].
  initialEnvelopes?: Envelope[];     // Inbox payload. Falls back to the folder's mock envelopes.
  // Replaces the "My Inbox" workspace title — used when opening a specific
  // inbox batch (e.g. a Processed-with-returns row) so the header reads as
  // that batch rather than the generic admin inbox.
  batchName?: string;
  onBack?: () => void;
  // V2 §7 — Save Progress. When `onSaveProgress` is set the toolbar shows a
  // "Save progress" button (Folder Admin only). `savedAtIso` flags that this
  // workspace is resuming a saved session and drives the "Resuming saved
  // session" notice at the top of the inbox list.
  savedAtIso?: string;
  onSaveProgress?: (envelopes: Envelope[]) => void;
  // Fires once all returned items in a Processed-batch context are routed or
  // returned upstream. The parent uses this to clear the inbox row's
  // ↩ N returned badge.
  onAllReturnsResolved?: () => void;
}

export default function FolderWorkspace({ folderId: folderIdProp, initialEnvelopes, batchName, onBack, savedAtIso, onSaveProgress, onAllReturnsResolved }: Props = {}) {
  const router = useRouter();
  const { user } = useUser();

  // ── Folder selection / switcher / drill-in stack ────────────────
  const userFolders = user.folders ?? FOLDER_ADMIN_FOLDERS;
  const defaultFolderId = folderIdProp ?? userFolders[0] ?? 'sales';
  const [activeFolderId, setActiveFolderId] = useState(defaultFolderId);
  // Tracks the folder whose envelopes are currently loaded. Seeded with the
  // mounted folder so the post-mount run of the reload effect is a no-op
  // (preserves initialEnvelopes). StrictMode-safe: the second invocation sees
  // the same id and bails. Switching folders later still triggers the reload.
  const lastLoadedFolderRef = useRef<string>(defaultFolderId);

  const activeFolder = findFolder(activeFolderId);
  const activeFolderName = activeFolder?.name ?? activeFolderId;

  // ── Child folders (live; new ones added via "+ Add Folder" appear here) ──
  const [extraChildren, setExtraChildren]   = useState<Folder[]>([]);
  const [archivedChildIds, setArchivedChildIds] = useState<Set<string>>(() => new Set());

  // extraChildren doubles as both "newly created folders" and "overrides for
  // built-in folders" (rename, reassign, mark-inactive). When an extra shares
  // an id with a built-in row, the extra wins — otherwise reassigning a
  // built-in folder would leave the old inactive bucket sitting next to it.
  const childFolders = useMemo<Folder[]>(() => {
    const extras = extraChildren.filter(f => f.parent_folder_id === activeFolderId);
    const overriddenIds = new Set(extras.map(f => f.id));
    const builtIn = getChildFolders(activeFolderId).filter(f => !overriddenIds.has(f.id));
    return [...builtIn, ...extras].filter(f => !archivedChildIds.has(f.id));
  }, [activeFolderId, extraChildren, archivedChildIds]);
  const isLeaf = childFolders.length === 0;

  // V2 §10 — Returned documents only belong in a Processed-batch context.
  // For New / In Progress workspaces, drop any docs marked isReturned or
  // carrying an inactiveReturnLabel before they ever enter state. The
  // synthesized "all-returned" payload from the Processed-with-returns flow
  // is detected by every doc being isReturned and is left intact.
  const stripStrayReturns = (envs: Envelope[]): Envelope[] => {
    if (envs.length === 0) return envs;
    const allReturned = envs.every(env => env.documents.length > 0 && env.documents.every(d => d.isReturned));
    if (allReturned) return envs;
    return envs
      .map(env => ({ ...env, documents: env.documents.filter(d => !d.isReturned && !d.inactiveReturnLabel) }))
      .filter(env => env.documents.length > 0);
  };

  // ── Workspace state ──────────────────────────────────────────────
  const [envelopes, setEnvelopes]         = useState<Envelope[]>(() =>
    stripStrayReturns(initialEnvelopes ? [...initialEnvelopes] : [...getInboxEnvelopesFor(activeFolderId)]),
  );
  const [counts, setCounts]               = useState<Record<string, number>>({ [RETURN_ID]: 0 });
  const [draggedDoc, setDraggedDoc]       = useState<DragState | null>(null);
  // Right-click-drag (copy) state — mirrors the MailDispatch pattern.
  // HTML5 drag fires only on the left button, so this gesture is tracked
  // with manual mouse events. The drop target is hit-tested via the
  // [data-drop-bucket] attribute that BucketTile already exposes.
  const [rightDrag, setRightDrag]         = useState<{ envelopeId: string; doc: Document } | null>(null);
  const [rightDragPos, setRightDragPos]   = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [hoveredBucket, setHoveredBucket] = useState<string | null>(null);
  const [pulsing, setPulsing]             = useState<string | null>(null);
  const [previewDoc, setPreviewDoc]       = useState<{ envelopeId: string; docId: string } | null>(null);
  const [showFinalize, setShowFinalize]   = useState(false);
  const [returnTarget, setReturnTarget]   = useState<{ envelopeId: string; doc: Document } | null>(null);
  const [forwardTarget, setForwardTarget] = useState<{ envelopeId: string; doc: Document } | null>(null);
  const [showAddFolder, setShowAddFolder] = useState(false);
  const [contextMenu, setContextMenu]     = useState<{ folderId: string; name: string; x: number; y: number } | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<{ id: string; name: string } | null>(null);
  // V2 §3 — Unified "Edit recipient" flow. Collapses Rename + Edit type +
  // Reassign admin into one modal opened from the right-click menu and the
  // inactive-admin engagement alert.
  const [editingFolder, setEditingFolder] = useState<Folder | null>(null);
  const [editAutoFocusAdmin, setEditAutoFocusAdmin] = useState(false);
  // V2 §5 — Delegates assigned to inactive_admin children. Folder stays in
  // ADMIN INACTIVE state visually; a "Delegate active" secondary badge
  // surfaces below the inactive badge while a delegate is set.
  const [delegates, setDelegates] = useState<Map<string, { delegateName: string; delegateUserId: string; endsAtIso?: string }>>(() => new Map());
  const [delegateTarget, setDelegateTarget] = useState<Folder | null>(null);
  // V2 §7 — Inline "Progress saved · {time}" confirmation that auto-clears.
  const [saveConfirmedAt, setSaveConfirmedAt] = useState<string | null>(null);
  // V2 §9 — Notification bell dropdown holding engagement + inactive-admin alerts.
  const [notifPanelOpen, setNotifPanelOpen] = useState(false);
  // In-workspace Upload Document. Reuses the same modal used from the Inbox
  // table; uploaded docs land directly in this workspace's envelopes.
  const [showUploadInWorkspace, setShowUploadInWorkspace] = useState(false);
  // Drill-into-folder filter view: hides the right panel and lists only docs
  // the current user routed into the given folder (see / preview / undo).
  const [drilledFolderId, setDrilledFolderId] = useState<string | null>(null);
  // Drill-in view has its own multi-select state so it doesn't share with the
  // main staging-list selection.
  const [drilledSelectedDocIds, setDrilledSelectedDocIds] = useState<Set<string>>(() => new Set());
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(() => new Set());
  const [searchTerm, setSearchTerm]       = useState('');
  const [selectedDocIds, setSelectedDocIds] = useState<Set<string>>(() => new Set());
  const [toasts, setToasts]               = useState<Toast[]>([]);
  // Right-panel accordion state — two sections (Group / Individual) keyed by
  // recipient_type. Both open by default; collapsed-set persisted per session.
  const [collapsedSections, setCollapsedSections] = useState<Set<SectionKey>>(() => new Set());
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const stored = window.sessionStorage.getItem(SECTION_COLLAPSED_KEY);
      if (stored) setCollapsedSections(new Set(JSON.parse(stored) as SectionKey[]));
    } catch { /* ignore — sessionStorage may be blocked */ }
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

  // V2 §3.0 — Source chip filter. 'all' shows everything; 'personal'/'uploaded'
  // are kind-only; 'via:<folderName>' matches inboxSource.folderName.
  const [sourceFilter, setSourceFilter]   = useState<string>('all');

  // Process as Download — docs staged for archive use dispatchedTo ===
  // PROCESS_QUEUE_ID so they grey out like any other dispatched doc. The
  // download confirmation is a single batch modal (V2 changelog).
  const [showDownloadArchive, setShowDownloadArchive] = useState(false);

  // V2 Brief §11 — trusted routes for this folder. Local state for the demo;
  // shape matches the Configurations Trusted Routes surface (§5.1).
  const [trustedRoutes, setTrustedRoutes] = useState<TrustedRoute[]>([]);
  const trustedRoutesRef = useRef(trustedRoutes);
  useEffect(() => { trustedRoutesRef.current = trustedRoutes; }, [trustedRoutes]);
  const [trustModal, setTrustModal] = useState<{ envelopeId: string; docId: string } | null>(null);

  // V2 Brief §10 — AI batching only forms when the folder is Phase 2+ AND
  // grouped docs clear the suggestion threshold for the same destination. In
  // the demo neither condition is consistently true across Folder Admin
  // views, so we always render flat individual cards here (matching the Sales
  // view). The Worker root-level dispatch keeps its bucket grouping.

  // ── Effect: when active folder changes (post-mount), reload envelopes from mock ──
  // Guard via a "last-loaded folder" ref instead of a one-shot flag — under
  // React StrictMode the effect double-fires on mount; a one-shot guard would
  // let the second pass overwrite initialEnvelopes (e.g. synthesized returns
  // for a Processed batch) with the folder's mock data.
  useEffect(() => {
    if (lastLoadedFolderRef.current === activeFolderId) return;
    lastLoadedFolderRef.current = activeFolderId;
    // Apply any in-session trusted routes to the incoming envelopes so the
    // demo can observe auto-routing after marking a pattern. Strip stray
    // returned-tagged docs since folder-switch implies a New / In Progress
    // context — returned items only belong in the dedicated Processed flow.
    setEnvelopes(stripStrayReturns(applyTrustedRoutes([...getInboxEnvelopesFor(activeFolderId)], trustedRoutesRef.current)));
    setCounts({ [RETURN_ID]: 0, [PROCESS_QUEUE_ID]: 0 });
    setSelectedDocIds(new Set());
    setSearchTerm('');
  }, [activeFolderId]);

  // ── Name map: folder ID → display name ──────────────────────────
  const folderNameMap = useMemo<Record<string, string>>(() => {
    const m: Record<string, string> = {
      [RETURN_ID]: 'Returned upstream',
      [PROCESS_QUEUE_ID]: 'Process as Download',
      junk: 'Junk',
    };
    childFolders.forEach(f => { m[f.id] = f.name; });
    FOLDERS.forEach(f => { if (!m[f.id]) m[f.id] = f.name; });
    extraChildren.forEach(f => { if (!m[f.id]) m[f.id] = f.name; });
    return m;
  }, [childFolders, extraChildren]);

  // ── Derived stats ─────────────────────────────────────────────
  const dispatchPages: Record<string, number> = {};
  envelopes.forEach(env => env.documents.forEach(d => {
    if (d.dispatchedTo) dispatchPages[d.dispatchedTo] = (dispatchPages[d.dispatchedTo] || 0) + d.pages;
  }));
  const dispatchSummary = childFolders
    .filter(r => (dispatchPages[r.id] || 0) > 0)
    .map(r => ({ id: r.id, name: r.name, pages: dispatchPages[r.id] }));

  // Build a flat doc list for queries / queue / stats.
  const allDocs: EnvelopeDoc[] = [];
  envelopes.forEach(env => env.documents.forEach(doc => allDocs.push({ doc, envelope: env })));

  // V2 §8 — A doc counts as a return when it's manually returned upstream
  // (isReturned) OR auto-returned from an inactive child admin
  // (inactiveReturnLabel). Both surface in the same pinned Returns section.
  const isReturnedDoc = (doc: Document) => (doc.isReturned || !!doc.inactiveReturnLabel) && !doc.dispatchedTo;
  const returnsList: EnvelopeDoc[] = allDocs.filter(({ doc }) => isReturnedDoc(doc));
  // Returns-only batch: every undispatched doc is a return. Drives the
  // "All returned documents have been resolved" empty state.
  const isReturnsBatch = allDocs.length > 0 && allDocs.every(({ doc }) => doc.isReturned);

  // Once every returned item in a Processed-batch context has been routed or
  // returned upstream, tell the parent so it can clear the inbox row badge.
  const returnsResolvedNotifiedRef = useRef(false);
  useEffect(() => {
    if (isReturnsBatch && returnsList.length === 0 && !returnsResolvedNotifiedRef.current) {
      returnsResolvedNotifiedRef.current = true;
      onAllReturnsResolved?.();
    }
  }, [isReturnsBatch, returnsList.length, onAllReturnsResolved]);

  // V2 §3.0 — source chip options derived from the current inbox. Unique
  // upstream folders, plus a single Personal / Uploaded chip if any docs
  // came in via those paths.
  const sourceChipOptions = (() => {
    const viaFolders = new Set<string>();
    let hasPersonal = false;
    let hasUploaded = false;
    for (const { doc } of allDocs) {
      const src = doc.inboxSource;
      if (!src) continue;
      if (src.kind === 'via')           viaFolders.add(src.folderName);
      else if (src.kind === 'personal') hasPersonal = true;
      else                              hasUploaded = true;
    }
    return { via: Array.from(viaFolders).sort(), hasPersonal, hasUploaded };
  })();
  const showSourceChips = sourceChipOptions.via.length > 0 || sourceChipOptions.hasPersonal || sourceChipOptions.hasUploaded;
  const matchesSourceFilter = (doc: Document) => {
    if (sourceFilter === 'all') return true;
    const src = doc.inboxSource;
    if (!src) return false;
    if (sourceFilter === 'personal') return src.kind === 'personal';
    if (sourceFilter === 'uploaded') return src.kind === 'uploaded';
    if (sourceFilter.startsWith('via:')) return src.kind === 'via' && src.folderName === sourceFilter.slice(4);
    return false;
  };
  // Returned docs are surfaced exclusively in the pinned Returns section above
  // the doc list — filter them out of the inline flat list. Already-routed
  // returns (dispatchedTo set) drop out of both surfaces.
  const visibleDocs = allDocs.filter(({ doc }) => !isReturnedDoc(doc) && matchesSourceFilter(doc));

  // Live chip counts. "All" = every non-return doc in the inbox. Per-chip
  // counts are subsets, computed against the same base so the totals line up.
  const chipBase = allDocs.filter(({ doc }) => !isReturnedDoc(doc));
  const chipCounts = {
    all:      chipBase.length,
    personal: chipBase.filter(({ doc }) => doc.inboxSource?.kind === 'personal').length,
    uploaded: chipBase.filter(({ doc }) => doc.inboxSource?.kind === 'uploaded').length,
    via:      (name: string) => chipBase.filter(({ doc }) => doc.inboxSource?.kind === 'via' && doc.inboxSource.folderName === name).length,
  };

  // Select-all operates on the inline (post-filter) doc list only — returned
  // docs in the pinned section have their own action set, and dispatched
  // docs don't have a checkbox surface.
  const selectableInView = visibleDocs.filter(({ doc }) => !doc.dispatchedTo);
  const isSelectAllMode = selectedDocIds.size === 0;
  const handleSelectAllToggle = () => {
    if (isSelectAllMode) {
      setSelectedDocIds(new Set(selectableInView.map(({ doc }) => doc.id)));
    } else {
      setSelectedDocIds(new Set());
    }
  };

  const undispatched        = allDocs.filter(({ doc }) => !doc.dispatchedTo);
  const totalRemaining      = undispatched.length;
  const totalPagesRemaining = undispatched.reduce((s, { doc }) => s + doc.pages, 0);
  // Queue items derive from envelopes — docs dispatched to PROCESS_QUEUE_ID.
  const queuedItems: EnvelopeDoc[] = allDocs.filter(({ doc }) => doc.dispatchedTo === PROCESS_QUEUE_ID);
  // "Processed" rolls up every doc that has left the inbox in any way —
  // routed to a child folder, queued for download, or returned upstream.
  const processedCount      = allDocs.filter(({ doc }) => !!doc.dispatchedTo).length;
  const dispatchedTotal     = Object.values(dispatchPages).reduce((a, b) => a + b, 0);
  const progress            = (dispatchedTotal + totalPagesRemaining) > 0 ? (dispatchedTotal / (dispatchedTotal + totalPagesRemaining)) * 100 : 0;

  const currentPreviewDoc = previewDoc
    ? envelopes.find(e => e.id === previewDoc.envelopeId)?.documents.find(d => d.id === previewDoc.docId) ?? null
    : null;

  const searchQuery  = searchTerm.trim().toLowerCase();
  const isSearching  = searchQuery.length > 0;
  const flatMatches: EnvelopeDoc[] = [];
  if (isSearching) envelopes.forEach(env => env.documents.forEach(doc => {
    if (!doc.dispatchedTo && (env.sender.toLowerCase().includes(searchQuery) || doc.title.toLowerCase().includes(searchQuery)))
      flatMatches.push({ doc, envelope: env });
  }));

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
  const handleDragEnd  = () => { setDraggedDoc(null); setHoveredBucket(null); };
  const handleDragOver = (e: React.DragEvent, bId: string) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setHoveredBucket(bId); };
  const handleDragLeave = () => setHoveredBucket(null);

  const handleDrop = (e: React.DragEvent, bucketId: string) => {
    e.preventDefault();
    if (!draggedDoc) return;

    // Brief V2 §5 — inactive_admin folders are disabled drop targets.
    const target = childFolders.find(f => f.id === bucketId);
    if (target?.admin_status === 'inactive_admin') {
      addToast(`${target.name} admin is inactive. Reassign admin to enable routing.`);
      setDraggedDoc(null); setHoveredBucket(null); return;
    }

    // Return bucket → open the Return modal (special-case flow with a reason note).
    if (bucketId === RETURN_ID) {
      if (draggedDoc.bulk) {
        addToast('Drop one document at a time to return it upstream.');
        setDraggedDoc(null); setHoveredBucket(null); return;
      }
      const { envelopeId, doc } = draggedDoc;
      setReturnTarget({ envelopeId, doc });
      setDraggedDoc(null); setHoveredBucket(null); return;
    }

    // All other buckets (child folders + Process as Download) take the standard
    // dispatch path: set dispatchedTo, bump counts, the doc greys out. Drag
    // is always a move — forwarding a copy lives on the ⋮ menu now.
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
    setDraggedDoc(null); setHoveredBucket(null);
  };

  // ── Right-click-and-drag (copy) ──────────────────────────────
  // Start the gesture from a doc card's onMouseDown when button === 2.
  // Suppresses the browser context menu and tracks the ghost via mouse
  // events; drop target resolves via [data-drop-bucket].
  const handleRightDragStart = (envelopeId: string, doc: Document, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (doc.dispatchedTo) return; // already-dispatched docs aren't copy-source candidates
    setRightDrag({ envelopeId, doc });
    setRightDragPos({ x: e.clientX, y: e.clientY });
  };
  // Drop a right-drag onto a bucket → insert a copy with isCopy: true and
  // dispatchedTo set. The Return and process-queue buckets are not valid
  // copy targets; treat them as a no-op (the regular drag flow handles
  // those special cases).
  const handleRightDragDrop = (envelopeId: string, doc: Document, bucketId: string) => {
    if (bucketId === RETURN_ID || bucketId === PROCESS_QUEUE_ID) return;
    const target = childFolders.find(f => f.id === bucketId);
    if (target?.admin_status === 'inactive_admin') {
      addToast(`${target.name} admin is inactive. Reassign admin to enable routing.`);
      return;
    }
    const stamp = Date.now();
    setEnvelopes(prev => prev.map(env => {
      if (env.id !== envelopeId) return env;
      const idx = env.documents.findIndex(d => d.id === doc.id);
      if (idx === -1) return env;
      const copy: Document = {
        ...doc,
        id:           doc.id + '-c-' + stamp,
        dispatchedTo: bucketId,
        isCopy:       true,
      };
      const next = [...env.documents];
      next.splice(idx + 1, 0, copy);
      return { ...env, documents: next };
    }));
    setCounts(prev => ({ ...prev, [bucketId]: (prev[bucketId] || 0) + doc.pages }));
    addToast(`Copy queued to ${folderNameMap[bucketId] || bucketId}.`);
  };
  // Global mouse listeners while the right-drag is active.
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

  // ── Document actions ──────────────────────────────────────────
  const handlePreview      = (envId: string, docId: string) => setPreviewDoc({ envelopeId: envId, docId });
  const handleClosePreview = () => setPreviewDoc(null);

  const handleApplySplit = (envelopeId: string, docId: string, groups: SplitGroup[]) => {
    setEnvelopes(prev => prev.map(env => {
      if (env.id !== envelopeId) return env;
      const idx = env.documents.findIndex(d => d.id === docId);
      if (idx === -1) return env;
      const orig = env.documents[idx];
      const stamp = Date.now();
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

  const handleReleaseNow = (envelopeId: string, doc: Document) => {
    if (!doc?.suggestion || doc.dispatchedTo) return;
    setEnvelopes(prev => prev.map(env => env.id !== envelopeId ? env : { ...env, documents: env.documents.map(d => d.id === doc.id ? { ...d, dispatchedTo: doc.suggestion, released: true } : d) }));
    setCounts(prev => ({ ...prev, [doc.suggestion!]: (prev[doc.suggestion!] || 0) + doc.pages }));
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

  const handleRenameDoc = (envelopeId: string, docId: string, newTitle: string) =>
    setEnvelopes(prev => prev.map(env => env.id !== envelopeId ? env : { ...env, documents: env.documents.map(d => d.id !== docId ? d : { ...d, title: newTitle }) }));

  // ⋮ → Duplicate. Inserts an unrouted copy of the doc directly below the
  // original. Each duplicate gets a sub-ID like #441903-COPY1 so it routes
  // independently of the source.
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
          { action: `Duplicated from #${baseId}`, user: user.name ?? 'You', timestamp: formatLabelDate(), note: null },
        ],
      };
      const next = [...env2.documents];
      next.splice(idx + 1, 0, copy);
      return { ...env2, documents: next };
    }));
    addToast(`Duplicate created — #${newDocId}`);
  };

  // ── Upload Document (in-workspace) ───────────────────────────
  // Same Upload Document modal as the Inbox table. Here the uploaded docs
  // land directly in the current workspace as a new envelope prepended to
  // the doc list, so the admin can see what was just added and route it.
  const handleUploadInWorkspaceAdd = ({ name, docCount, fileNames }: { name: string; docCount: number; fileNames: string[] }) => {
    void docCount;
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
    // Prepend so newly uploaded docs sit at the top of the workspace list.
    setEnvelopes(prev => [newEnvelope, ...prev]);
    setShowUploadInWorkspace(false);
    addToast(`"${name}" added · ${docCount} document${docCount !== 1 ? 's' : ''} in workspace.`);
  };

  // ── Return ────────────────────────────────────────────────────
  const handleConfirmReturn = (reason: string) => {
    if (!returnTarget) return;
    const { envelopeId, doc } = returnTarget;
    setEnvelopes(prev => prev.map(env => env.id !== envelopeId ? env : {
      ...env,
      documents: env.documents.map(d => d.id === doc.id
        ? { ...d, dispatchedTo: RETURN_ID, returnReason: reason,
            routingHistory: [...(d.routingHistory ?? []), buildHistoryEntry('Returned upstream from ' + activeFolderName, reason)] }
        : d),
    }));
    setCounts(prev => ({ ...prev, [RETURN_ID]: (prev[RETURN_ID] || 0) + 1 }));
    setReturnTarget(null);
  };

  // ── Process as Download ───────────────────────────────────────
  // Clicking ⊠ on a doc card is equivalent to dropping it on the Process as
  // Download box: dispatchedTo is set, counts bump, the card greys out.
  const handleAddToQueue = (envelopeId: string, doc: Document) => {
    if (doc.dispatchedTo === PROCESS_QUEUE_ID) return; // already queued
    setEnvelopes(prev => prev.map(env => env.id !== envelopeId ? env : {
      ...env,
      documents: env.documents.map(d => d.id === doc.id ? { ...d, dispatchedTo: PROCESS_QUEUE_ID } : d),
    }));
    setCounts(prev => ({ ...prev, [PROCESS_QUEUE_ID]: (prev[PROCESS_QUEUE_ID] || 0) + doc.pages }));
    addToast('Doc #' + (doc.docId || doc.id) + ' added to Process as Download.');
  };
  // V2 spec — Process All button. Queue has docs → open Download & Archive
  // first (the modal handler commits + archives). Empty queue → commit
  // routes/returns immediately, no modal.
  const handleProcessAll = () => {
    if (queuedItems.length > 0) {
      setShowDownloadArchive(true);
      return;
    }
    addToast('Inbox processed — routes committed and returns sent upstream.');
  };

  // V2 Brief §11 — trusted-route marking. Opens the same TrustedRouteModal
  // used by SA/Worker so the admin can pick a child-folder destination, then
  // confirms. Future docs matching (sender + doc type) auto-route there.
  const handleTrustStar = (envelopeId: string, doc: Document) => {
    setTrustModal({ envelopeId, docId: doc.id });
  };
  const activeTrustTarget = trustModal
    ? (() => {
        const env = envelopes.find(e => e.id === trustModal.envelopeId);
        const doc = env?.documents.find(d => d.id === trustModal.docId);
        return env && doc ? { env, doc } : null;
      })()
    : null;
  const handleConfirmTrust = ({ selectedFolder, docType }: { selectedFolder: string; docType: string }) => {
    if (!activeTrustTarget) { setTrustModal(null); return; }
    const { env } = activeTrustTarget;
    const newRoute: TrustedRoute = {
      id: 'tr-' + Date.now(),
      pattern: { sender: env.sender, document_type: docType },
      destination: selectedFolder,
      markedBy: user.name,
      markedAt: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      isActive: true,
      usageCount: 0,
    };
    setTrustedRoutes(prev => [...prev, newRoute]);
    // Retroactively auto-route any matching undispatched docs already in the
    // workspace. applyTrustedRoutes is a no-op on dispatched docs so it can't
    // disturb routed/queued/returned items. Counts also bump for the
    // destination so the right-panel bucket totals match.
    let routedPages = 0;
    setEnvelopes(prev => {
      const next = applyTrustedRoutes(prev, [newRoute]);
      next.forEach((env, ei) => env.documents.forEach((doc, di) => {
        const before = prev[ei]?.documents[di];
        if (doc.autoRouted && !before?.dispatchedTo) routedPages += doc.pages;
      }));
      return next;
    });
    if (routedPages > 0) {
      setCounts(prev => ({ ...prev, [selectedFolder]: (prev[selectedFolder] || 0) + routedPages }));
    }
    addToast('Trusted route created');
    setTrustModal(null);
  };
  // Revoke flow — the card's filled star opens a small confirmation modal.
  // Flips isActive false on the matching route; the source doc keeps its
  // routing, only future matches are affected.
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
  // × on an auto-routed card: undo the auto-route, un-dispatch the doc so
  // it surfaces as a normal manual card again. The trusted route itself
  // stays active (manage it from the Configurations panel).
  const handleUndoAutoRoute = (envelopeId: string, doc: Document) => {
    const wasDest = doc.dispatchedTo;
    if (!wasDest) return;
    setEnvelopes(prev => prev.map(env =>
      env.id !== envelopeId
        ? env
        : { ...env, documents: env.documents.map(d => d.id === doc.id ? { ...d, dispatchedTo: undefined, autoRouted: undefined, trustedRouteId: undefined } : d) },
    ));
    setCounts(prev => ({ ...prev, [wasDest]: Math.max(0, (prev[wasDest] || 0) - doc.pages) }));
  };
  const handleDownloadArchiveConfirm = () => {
    if (!queuedItems.length) { setShowDownloadArchive(false); return; }
    const snapshot = queuedItems.map(({ envelope, doc }) => ({ envelopeId: envelope.id, docId: doc.id, pages: doc.pages, label: doc.docId || doc.id }));
    // Each doc gets a Completed entry, then is removed from view (ZIP'd + archived).
    snapshot.forEach(({ envelopeId, docId }) => {
      appendHistory(envelopeId, docId, buildHistoryEntry('Completed in ' + activeFolderName));
    });
    setEnvelopes(prev => prev.map(env => {
      const targets = new Set(snapshot.filter(s => s.envelopeId === env.id).map(s => s.docId));
      if (!targets.size) return env;
      return { ...env, documents: env.documents.filter(d => !targets.has(d.id)) };
    }));
    const totalPages = snapshot.reduce((s, x) => s + x.pages, 0);
    setCounts(prev => ({ ...prev, [PROCESS_QUEUE_ID]: Math.max(0, (prev[PROCESS_QUEUE_ID] || 0) - totalPages) }));
    setShowDownloadArchive(false);
    addToast(snapshot.length + ' document' + (snapshot.length !== 1 ? 's' : '') + ' downloaded as a ZIP and archived.');
  };

  // ── Forward ───────────────────────────────────────────────────
  const handleForward = (envelopeId: string, doc: Document) => {
    if (childFolders.length === 0) return;
    setForwardTarget({ envelopeId, doc });
  };
  const handleConfirmForward = ({ destinationFolderId, note }: { destinationFolderId: string; note: string }) => {
    if (!forwardTarget) return;
    const destName = folderNameMap[destinationFolderId] || destinationFolderId;
    // V2 Brief §13 — Forward creates a copy. We log the event on the original
    // doc's routing history with the note. The copy in the destination is not
    // materialized in this mock — that lands when the destination workspace
    // queries its inbox.
    appendHistory(forwardTarget.envelopeId, forwardTarget.doc.id,
      buildHistoryEntry('Forwarded to ' + destName, note));
    addToast('Doc #' + (forwardTarget.doc.docId || forwardTarget.doc.id) + ' forwarded to ' + destName + ' — "' + note + '"');
    setForwardTarget(null);
  };

  // ── Add Folder ────────────────────────────────────────────────
  // Folder Admin child-folder flow: the modal does NOT show the Initial admin
  // picker (parentName is set), so initialAdminUserId is undefined. The
  // creator auto-becomes admin per Brief §5.
  const handleAddFolder = ({ name, folder_type, recipient_type, initialAdminUserId }: { name: string; folder_type: string; recipient_type: RecipientType; initialAdminUserId?: string }) => {
    const id = 'folder-' + Date.now();
    setExtraChildren(prev => [...prev, {
      id, name, folder_type,
      parent_folder_id: activeFolderId,
      admin_user_id: initialAdminUserId ?? user.id,
      admin_status: 'active',
      recipient_type,
    }]);
    setShowAddFolder(false);
    addToast('Folder "' + name + '" created. You are its admin.');
  };

  // ── Folder management ────────────────────────────────────────
  const handleFolderContextMenu = (e: React.MouseEvent, childFolderId: string) => {
    e.preventDefault();
    const folder = childFolders.find(f => f.id === childFolderId);
    if (!folder) return;
    setContextMenu({ folderId: childFolderId, name: folder.name, x: e.clientX, y: e.clientY });
  };
  // Open the unified Edit recipient modal from the right-click menu.
  // Inactive-admin folders push focus to the admin picker.
  const handleOpenEdit = () => {
    if (!contextMenu) return;
    const folder = childFolders.find(f => f.id === contextMenu.folderId);
    if (!folder) return;
    setEditingFolder(folder);
    setEditAutoFocusAdmin(folder.admin_status === 'inactive_admin');
    setContextMenu(null);
  };
  // Same entry point from elsewhere in the workspace (engagement alert,
  // inactive-children banner). Mounts the modal directly with focus on admin.
  const openEditForFolder = (folderId: string) => {
    const folder = childFolders.find(f => f.id === folderId);
    if (!folder) return;
    setEditingFolder(folder);
    setEditAutoFocusAdmin(folder.admin_status === 'inactive_admin');
  };
  const handleConfirmEdit = ({ name, folder_type, recipient_type, initialAdminUserId }: { name: string; folder_type: string; recipient_type: RecipientType; initialAdminUserId?: string }) => {
    if (!editingFolder) return;
    const oldFolder = editingFolder;
    const id = oldFolder.id;
    const adminChanged = initialAdminUserId !== oldFolder.admin_user_id;
    const renamed     = name !== oldFolder.name;
    const recipientTypeChanged = recipient_type !== (oldFolder.recipient_type ?? 'group');

    // Replace/insert in extraChildren so the override wins over the built-in
    // entry. Same pattern as the prior reassign flow.
    const baseFolder = childFolders.find(f => f.id === id) ?? {
      id, name: oldFolder.name, folder_type: oldFolder.folder_type, parent_folder_id: activeFolderId,
    };
    setExtraChildren(prev => [
      ...prev.filter(f => f.id !== id),
      {
        ...baseFolder,
        id,
        name,
        folder_type,
        recipient_type,
        admin_user_id: initialAdminUserId,
        admin_status: adminChanged ? ('active' as const) : baseFolder.admin_status,
      },
    ]);

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
  // Assign delegate — only surfaced on inactive_admin folders. Folder stays
  // visually ADMIN INACTIVE; a "Delegate active" sub-badge is added below.
  const handleOpenDelegate = () => {
    if (!contextMenu) return;
    const folder = childFolders.find(f => f.id === contextMenu.folderId);
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
  const handleArchiveClick = () => {
    const target = contextMenu!;
    setContextMenu(null);
    const inFlightForTarget = (counts[target.folderId] || 0) +
      envelopes.reduce((s, e) => s + e.documents.filter(d => d.suggestion === target.folderId && !d.dispatchedTo).length, 0);
    if (inFlightForTarget > 0) {
      addToast('Cannot archive "' + target.name + '" — ' + inFlightForTarget + ' in-flight item' + (inFlightForTarget !== 1 ? 's' : '') + '.');
      return;
    }
    setArchiveTarget({ id: target.folderId, name: target.name });
  };
  const handleConfirmArchive = () => {
    if (!archiveTarget) return;
    setArchivedChildIds(prev => { const n = new Set(prev); n.add(archiveTarget.id); return n; });
    setExtraChildren(prev => prev.filter(f => f.id !== archiveTarget.id));
    addToast('Folder "' + archiveTarget.name + '" archived.');
    setArchiveTarget(null);
  };

  // ── Drill-in (filter view) ──────────────────────────────────
  // Click a folder bucket → enter a filtered view of docs the user routed
  // there. Right panel hides. Undo on each card clears dispatchedTo and the
  // doc returns to the staging list.
  const handleEnterDrill = (id: string) => { setDrilledFolderId(id); setDrilledSelectedDocIds(new Set()); };
  const handleExitDrill  = () => { setDrilledFolderId(null); setDrilledSelectedDocIds(new Set()); };
  const handleHeaderBack = () => {
    if (onBack) onBack();
    else router.push('/inbox');
  };
  const handleUndoDispatch = (envelopeId: string, doc: Document) => {
    handleRemoveInstance(envelopeId, doc);
    addToast('Doc #' + (doc.docId || doc.id) + ' returned to the staging list.');
  };

  // ── Search / selection ────────────────────────────────────────
  const handleSearchChange = (val: string) => { setSearchTerm(val); if (!val.trim()) setSelectedDocIds(new Set()); };
  const handleToggleSelect = (docId: string) => setSelectedDocIds(prev => { const n = new Set(prev); n.has(docId) ? n.delete(docId) : n.add(docId); return n; });
  const handleSelectAllMatches = () => setSelectedDocIds(new Set(flatMatches.map(m => m.doc.id)));
  const handleClearSelection   = () => setSelectedDocIds(new Set());

  // ── Toasts ────────────────────────────────────────────────────
  const addToast = (message: string) => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4500);
  };
  const dismissToast = (id: number) => setToasts(prev => prev.filter(t => t.id !== id));

  const dragBulkCount = draggedDoc?.bulk ? draggedDoc.items.length : 0;
  const draggedDocId  = draggedDoc && !draggedDoc.bulk ? draggedDoc.doc.id : null;

  // ── Routing history helper ─────────────────────────────────────
  // V2 Brief §15 — each hop adds an entry: "[Action] — [User] — [Date · Time]".
  const buildHistoryEntry = (action: string, note?: string): RoutingHistoryEntry => {
    const d = new Date();
    const date = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const hours = d.getHours() % 12 || 12;
    const minutes = d.getMinutes().toString().padStart(2, '0');
    const ampm = d.getHours() < 12 ? 'am' : 'pm';
    return { action, user: user.name, timestamp: `${date} · ${hours}:${minutes}${ampm}`, note: note ?? null };
  };
  const appendHistory = (envelopeId: string, docId: string, entry: RoutingHistoryEntry) => {
    setEnvelopes(prev => prev.map(env => env.id !== envelopeId ? env : {
      ...env,
      documents: env.documents.map(d => d.id !== docId ? d : {
        ...d,
        routingHistory: [...(d.routingHistory ?? []), entry],
      }),
    }));
  };

  // ── Inactive-admin succession helpers (Brief V2 §5) ─────────────
  const inactiveChildren = useMemo(
    () => childFolders.filter(c => c.admin_status === 'inactive_admin'),
    [childFolders],
  );
  // Engagement alerts: child folder admins inactive on engagement (>= 7 days
  // since last inbox activity) but not yet flipped to inactive_admin. For the
  // demo we hardcode the 7-day threshold — the Tunable Defaults page is read-only.
  const ALERT_THRESHOLD_DAYS = 7;
  const engagementAlerts = useMemo(() => {
    const now = Date.now();
    const out: Array<{ folderId: string; folderName: string; admin: SsoUser; daysIdle: number }> = [];
    childFolders.forEach(c => {
      if (c.admin_status === 'inactive_admin') return;
      const admin = c.admin_user_id ? findUser(c.admin_user_id) : undefined;
      if (!admin?.lastInboxActivityIso) return;
      const days = (now - Date.parse(admin.lastInboxActivityIso)) / 86_400_000;
      if (days >= ALERT_THRESHOLD_DAYS && !dismissedAlerts.has(c.id)) {
        out.push({ folderId: c.id, folderName: c.name, admin, daysIdle: Math.floor(days) });
      }
    });
    return out;
  }, [childFolders, dismissedAlerts]);

  const handleMarkInactiveFromAlert = (folderId: string, folderName: string) => {
    const folder = childFolders.find(f => f.id === folderId);
    if (!folder) return;
    setExtraChildren(prev => [
      ...prev.filter(f => f.id !== folderId),
      { ...folder, admin_status: 'inactive_admin' as const },
    ]);
    setDismissedAlerts(prev => { const n = new Set(prev); n.add(folderId); return n; });
    addToast(`${folderName} admin marked inactive. Mail will auto-return upstream.`);
  };
  const handleDismissAlert = (folderId: string) => {
    setDismissedAlerts(prev => { const n = new Set(prev); n.add(folderId); return n; });
  };

  // ── Render helpers ──────────────────────────────────────────
  const renderBucket = (child: Folder) => {
    const isInactive = child.admin_status === 'inactive_admin';
    const adminName = child.admin_user_id ? findUser(child.admin_user_id)?.name : undefined;
    const delegate = delegates.get(child.id);
    const subBadge = isInactive ? (
      <div className="flex flex-col items-center gap-0.5">
        <span className="inline-flex items-center gap-0.5 px-1.5 py-0 rounded-full text-[9px] font-bold uppercase tracking-wide bg-amber-100 text-amber-800 border border-amber-300">
          <AlertTriangle className="w-2.5 h-2.5" /> admin inactive
        </span>
        {delegate && (
          <span className="inline-flex items-center px-1.5 py-0 rounded-full text-[9px] font-semibold uppercase tracking-wide bg-blue-50 text-blue-700 border border-blue-200"
            title={`Delegate: ${delegate.delegateName}${delegate.endsAtIso ? ` (ends ${delegate.endsAtIso})` : ''}`}>
            Delegate active
          </span>
        )}
      </div>
    ) : undefined;
    return (
      <BucketTile key={child.id} id={child.id} name={child.name}
        subBadge={subBadge}
        disabled={isInactive}
        disabledTooltip={isInactive ? `${adminName ?? child.name} is inactive. Reassign admin to enable routing.` : undefined}
        count={counts[child.id] || 0} isFolder={true}
        hovered={hoveredBucket === child.id && !!draggedDoc} pulsing={pulsing === child.id}
        bulkCount={dragBulkCount}
        onClick={draggedDoc || isInactive ? undefined : () => handleEnterDrill(child.id)}
        onDragOver={e => handleDragOver(e, child.id)} onDragLeave={handleDragLeave} onDrop={e => handleDrop(e, child.id)}
        onContextMenu={handleFolderContextMenu} />
    );
  };

  // ── Drill-into-folder filter view ────────────────────────────────────
  if (drilledFolderId) {
    const drilledName = folderNameMap[drilledFolderId] || drilledFolderId;
    const drilledFolder = childFolders.find(f => f.id === drilledFolderId);
    const drilledAdmin = drilledFolder?.admin_user_id ? findUser(drilledFolder.admin_user_id) : undefined;
    const drilledDocs: EnvelopeDoc[] = [];
    envelopes.forEach(env => env.documents.forEach(doc => {
      if (doc.dispatchedTo === drilledFolderId) drilledDocs.push({ doc, envelope: env });
    }));
    const totalPages = drilledDocs.reduce((s, { doc }) => s + doc.pages, 0);
    const allSelected = drilledDocs.length > 0 && drilledDocs.every(({ doc }) => drilledSelectedDocIds.has(doc.id));
    const anySelected = drilledSelectedDocIds.size > 0;
    const toggleDrilledRow = (docId: string) => setDrilledSelectedDocIds(prev => {
      const n = new Set(prev);
      if (n.has(docId)) n.delete(docId); else n.add(docId);
      return n;
    });
    const drilledSelectAllToggle = () => setDrilledSelectedDocIds(
      allSelected ? new Set() : new Set(drilledDocs.map(({ doc }) => doc.id)),
    );
    const drilledClear = () => setDrilledSelectedDocIds(new Set());
    const drilledBulkUndo = () => {
      const targets = drilledDocs.filter(({ doc }) => drilledSelectedDocIds.has(doc.id));
      if (targets.length === 0) return;
      targets.forEach(({ envelope, doc }) => handleRemoveInstance(envelope.id, doc));
      addToast(targets.length + ' doc' + (targets.length !== 1 ? 's' : '') + ' returned to the staging list.');
      setDrilledSelectedDocIds(new Set());
    };
    return (
      <div className="flex flex-col h-screen bg-slate-100" style={{ fontFamily: '-apple-system,BlinkMacSystemFont,"SF Pro Text","Segoe UI",Roboto,sans-serif' }}>
        <div className="bg-white border-b border-gray-200 flex-shrink-0">
          <div className="px-6 py-2 border-b border-gray-100">
            <button onClick={handleExitDrill}
              className="flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-800 transition-colors">
              <ChevronLeft className="w-3.5 h-3.5" /> Back
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

        <div className="flex-1 overflow-y-auto p-6 max-w-4xl w-full mx-auto pb-24">
          {drilledDocs.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-200 px-6 py-12 text-center">
              <Check className="w-10 h-10 text-emerald-400 mx-auto mb-3 opacity-50" />
              <p className="text-sm font-medium text-gray-700">Nothing routed here yet</p>
              <p className="text-xs text-gray-400 mt-1">Drop documents on this folder from the main view to see them here.</p>
            </div>
          ) : (
            <>
              <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-2 mb-2 flex items-center gap-2">
                <button onClick={drilledSelectAllToggle}
                  className="inline-flex items-center gap-2 text-[12px] font-medium text-gray-700 hover:text-gray-900 transition-colors">
                  <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all ${allSelected ? 'bg-blue-500 border-blue-500' : 'bg-white border-gray-400'}`}>
                    {allSelected && <Check className="w-2.5 h-2.5 text-white" />}
                  </div>
                  {allSelected ? 'Deselect all' : 'Select all'}
                </button>
              </div>
              <div className="space-y-2 group/drilled-list">
                {drilledDocs.map(({ doc, envelope }) => {
                  const isSelected = drilledSelectedDocIds.has(doc.id);
                  return (
                    <div key={doc.id}
                      className={`bg-white border rounded-2xl px-4 py-3 flex items-center gap-3 transition-all ${isSelected ? 'border-blue-300 shadow-sm' : 'border-gray-200 hover:shadow-sm'}`}>
                      <div onClick={() => toggleDrilledRow(doc.id)}
                        className={`flex-shrink-0 w-4 h-4 rounded border-2 flex items-center justify-center cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-blue-500 border-blue-500 opacity-100'
                            : `bg-white border-gray-300 hover:border-blue-400 ${anySelected ? 'opacity-100' : 'opacity-0 group-hover/drilled-list:opacity-100'}`
                        }`}>
                        {isSelected && <Check className="w-2.5 h-2.5 text-white" />}
                      </div>
                      <DocThumbnail pages={doc.pages} onPreview={() => handlePreview(envelope.id, doc.id)} />
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
                      <button onClick={() => handleUndoDispatch(envelope.id, doc)}
                        className="px-3 py-1.5 text-xs font-medium text-gray-700 border border-gray-200 hover:bg-gray-100 rounded-md transition-colors inline-flex items-center gap-1.5">
                        <Undo2 className="w-3.5 h-3.5" /> Undo
                      </button>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {anySelected && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 bg-white border border-gray-200 rounded-full shadow-xl px-3 py-2">
            <span className="text-xs font-semibold text-gray-700 pl-1">{drilledSelectedDocIds.size} selected</span>
            <div className="w-px h-4 bg-gray-200" />
            <button onClick={drilledBulkUndo}
              className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold text-gray-800 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors">
              <Undo2 className="w-3.5 h-3.5" /> Undo selected
            </button>
            <button onClick={drilledClear}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors">
              <X className="w-3.5 h-3.5" /> Clear
            </button>
          </div>
        )}

        {currentPreviewDoc && <DocumentPreviewModal doc={currentPreviewDoc} envelopeId={previewDoc!.envelopeId} folderNameMap={folderNameMap} onClose={handleClosePreview} onApplySplit={handleApplySplit} />}
        <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-100" style={{ fontFamily: '-apple-system,BlinkMacSystemFont,"SF Pro Text","Segoe UI",Roboto,sans-serif' }}>

      {/* ── Left panel ── */}
      <div className="flex flex-col" style={{ width: '75%' }}>
        {/* Header */}
        <div className="bg-white border-b border-gray-200 flex-shrink-0">
          <div className="px-6 py-2 flex items-center justify-between border-b border-gray-100">
            <button onClick={handleHeaderBack} className="flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-800 transition-colors flex-shrink-0">
              <ChevronLeft className="w-3.5 h-3.5" /> Back to Inbox
            </button>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
                <input value={searchTerm} onChange={e => handleSearchChange(e.target.value)} placeholder="Search documents…"
                  className="pl-7 pr-7 py-1.5 text-xs text-gray-900 placeholder:text-gray-400 border border-gray-200 rounded-lg bg-gray-50 focus:bg-white focus:border-blue-400 focus:outline-none transition-all"
                  style={{ width: isSearching ? 240 : 200 }} />
                {searchTerm && <button onClick={() => handleSearchChange('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"><X className="w-3 h-3" /></button>}
              </div>
            </div>
          </div>
          <div className="px-6 py-3 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-sm">
              <Inbox className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg font-semibold text-gray-900">{batchName ?? 'My Inbox'}</h1>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                  isReturnsBatch
                    ? 'bg-blue-100 text-blue-700'
                    : totalRemaining === 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                }`}>
                  {isReturnsBatch ? 'In Progress' : totalRemaining === 0 ? 'Ready to dispatch' : 'In Progress'}
                </span>
              </div>
              {!isSearching && (
                <p className="text-xs text-gray-500 mt-0.5">
                  <span className="font-medium">Tip:</span>{' '}
                  {isReturnsBatch
                    ? <>Drag documents to child folders to route them · Click a folder bucket to drill in · Drop on <span className="font-medium">Return</span> to send back upstream.</>
                    : isLeaf
                      ? <>This is a leaf folder. Use <span className="font-medium">✓</span> for Process as Download, → to forward (once you have a child folder), or drop on <span className="font-medium">Return</span> to send back upstream.</>
                      : <>Drag documents to child folders to route them · Click a folder bucket to drill in · Drop on <span className="font-medium">Return</span> to send back upstream · Use <span className="font-medium">✓</span> for Process as Download</>
                  }
                </p>
              )}
            </div>

            {/* Upload Document — opens the same modal used from the Inbox
                table. Uploaded docs land directly into this workspace's
                envelope list. Hidden in the Processed-returns context. */}
            {!isReturnsBatch && (
              <button onClick={() => setShowUploadInWorkspace(true)}
                title="Upload documents into this workspace"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 border border-blue-600 rounded-lg shadow-sm transition-colors flex-shrink-0">
                <Plus className="w-3.5 h-3.5" /> Upload Document
              </button>
            )}

            {/* Notification bell — anchors the alerts dropdown. */}
            {!isReturnsBatch && (() => {
              const alertCount = engagementAlerts.length + inactiveChildren.length;
              const hasCritical = inactiveChildren.length > 0;
              return (
                <div className="relative flex-shrink-0">
                  <button onClick={() => setNotifPanelOpen(p => !p)}
                    title={alertCount > 0 ? `${alertCount} alert${alertCount !== 1 ? 's' : ''}` : 'No alerts'}
                    className="relative w-9 h-9 inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition-colors">
                    <Bell className="w-4 h-4" />
                    {alertCount > 0 && (
                      <span className={`absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold text-white flex items-center justify-center ring-2 ring-white ${hasCritical ? 'bg-red-600' : 'bg-amber-500'}`}>
                        {alertCount}
                      </span>
                    )}
                  </button>
                  {notifPanelOpen && (
                    <>
                      <div className="fixed inset-0 z-30" onClick={() => setNotifPanelOpen(false)} />
                      <div className="absolute right-0 top-full mt-2 z-40 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden" style={{ width: 380 }}>
                        <div className="px-4 py-2.5 border-b border-gray-100 bg-gray-50">
                          <p className="text-[11px] uppercase tracking-wide font-semibold text-gray-500">
                            {alertCount > 0 ? `Alerts · ${alertCount}` : 'No alerts'}
                          </p>
                        </div>
                        {alertCount === 0 ? (
                          <div className="px-4 py-6 text-center text-xs text-gray-400">You're all caught up.</div>
                        ) : (
                          <div className="max-h-80 overflow-y-auto divide-y divide-gray-100">
                            {engagementAlerts.map(alert => (
                              <div key={'eng-' + alert.folderId} className="px-4 py-3 bg-amber-50">
                                <div className="flex items-start gap-2 mb-1.5">
                                  <AlertTriangle className="w-3.5 h-3.5 text-amber-700 flex-shrink-0 mt-0.5" />
                                  <div className="flex-1 min-w-0 text-xs">
                                    <p className="font-semibold text-amber-900">
                                      {alert.admin.name} hasn&apos;t actioned mail in {alert.daysIdle} day{alert.daysIdle !== 1 ? 's' : ''}.
                                    </p>
                                    <p className="text-amber-800 mt-0.5 leading-relaxed">
                                      Admin of <span className="font-medium">{alert.folderName}</span>. Mark inactive or dismiss.
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 justify-end">
                                  <button onClick={() => { handleMarkInactiveFromAlert(alert.folderId, alert.folderName); }}
                                    className="px-3 py-1 bg-amber-600 text-white rounded-md text-[11px] font-semibold hover:bg-amber-700 transition-colors">
                                    Mark inactive
                                  </button>
                                  <button onClick={() => { handleDismissAlert(alert.folderId); }}
                                    className="px-3 py-1 text-[11px] font-medium text-amber-800 hover:bg-amber-100 rounded-md transition-colors">
                                    Dismiss
                                  </button>
                                </div>
                              </div>
                            ))}
                            {inactiveChildren.map(child => {
                              const adminName = findUser(child.admin_user_id ?? '')?.name ?? '';
                              return (
                                <div key={'inact-' + child.id} className="px-4 py-3 bg-red-50">
                                  <div className="flex items-start gap-2 mb-1.5">
                                    <span className="w-2 h-2 mt-1 rounded-full bg-red-600 flex-shrink-0" />
                                    <div className="flex-1 min-w-0 text-xs">
                                      <p className="font-semibold text-red-900">
                                        {child.name} admin{adminName ? ` ${adminName}` : ''} is inactive.
                                      </p>
                                      <p className="text-red-700 mt-0.5">Reassign to re-enable routing.</p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2 justify-end">
                                    <button onClick={() => { setNotifPanelOpen(false); openEditForFolder(child.id); }}
                                      className="px-3 py-1 bg-red-600 text-white rounded-md text-[11px] font-semibold hover:bg-red-700 transition-colors">
                                      Reassign →
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              );
            })()}

          </div>
          {/* V2 §10 — Unified toolbar: select-all on the far left, divider,
              then the source filter chips. Sits flush below the title/tip
              row, separated only by a single subtle line. */}
          {!isReturnsBatch && !isSearching && (selectableInView.length > 0 || showSourceChips) && (() => {
            const selfUser = findUser(user.id);
            const selfInfo: ChipPerson = { name: user.name, title: selfUser?.title, email: user.email };
            const lookupViaPerson = (folderName: string): ChipPerson | null => {
              const folder = [...FOLDERS, ...extraChildren].find(f => f.name === folderName);
              if (!folder?.admin_user_id) return null;
              const u = findUser(folder.admin_user_id);
              if (!u) return null;
              return { name: u.name, title: u.title, email: u.email };
            };
            const selectAllVisible = selectableInView.length > 0;
            const anySelected = selectedDocIds.size > 0;
            return (
              <div className="px-6 py-2 border-t border-gray-100 flex items-center gap-3 flex-wrap">
                {selectAllVisible && (
                  <button onClick={handleSelectAllToggle}
                    className="inline-flex items-center gap-2 text-[11px] font-medium text-gray-700 hover:text-gray-900 transition-colors flex-shrink-0">
                    <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all ${anySelected ? 'bg-blue-500 border-blue-500' : 'bg-white border-gray-400'}`}>
                      {anySelected && <Check className="w-2.5 h-2.5 text-white" />}
                    </div>
                    {isSelectAllMode ? 'Select all' : 'Deselect all'}
                  </button>
                )}
                {selectAllVisible && showSourceChips && (
                  <div className="w-px h-4 bg-gray-300 flex-shrink-0" />
                )}
                {showSourceChips && (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <SourceChip label="All" count={chipCounts.all} active={sourceFilter === 'all'} onClick={() => setSourceFilter('all')} />
                    {sourceChipOptions.via.map(folderName => {
                      const key = 'via:' + folderName;
                      // Stand-in "Main Office" sender for the upstream folder
                      // — represents the directory entry the documents came
                      // from before reaching this admin's inbox.
                      const slug = folderName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
                      const fromUpstream: ChipPerson = {
                        name: `${folderName} Main Office`,
                        title: `${folderName} Main Office`,
                        email: `${slug || 'office'}.office@acme.com`,
                      };
                      return <SourceChip key={key} label={`to ${folderName}`} count={chipCounts.via(folderName)} active={sourceFilter === key} onClick={() => setSourceFilter(key)}
                        hoverPerson={fromUpstream} hoverContext="From"
                        hoverDescription={`Documents sent to ${folderName} by upstream admins`} />;
                    })}
                    {sourceChipOptions.hasPersonal && (
                      <SourceChip label="Direct" count={chipCounts.personal} active={sourceFilter === 'personal'} onClick={() => setSourceFilter('personal')}
                        hoverPerson={{ name: 'Patricia Reyes', title: 'HR Administrator II', email: 'p.reyes@acme.com' }} hoverContext="From"
                        hoverDescription="Documents sent directly to you" />
                    )}
                    {sourceChipOptions.hasUploaded && (
                      <SourceChip label="Uploaded" count={chipCounts.uploaded} active={sourceFilter === 'uploaded'} onClick={() => setSourceFilter('uploaded')}
                        hoverPerson={selfInfo} hoverContext="Uploaded by"
                        hoverDescription="Documents you uploaded to this inbox" />
                    )}
                  </div>
                )}
              </div>
            );
          })()}
        </div>

        {/* Main content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* V2 §9 — engagement + inactive-admin alerts now live in the
              notification-bell dropdown in the header. Tip text moved to the
              H1 subtitle. The doc-list area starts directly with the toolbar +
              Returns section + cards. */}
          {isSearching && (
            <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-xs shadow-sm">
              {flatMatches.length > 0 ? (
                <>
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0" />
                  <span className="text-gray-600"><span className="font-semibold text-gray-900">{flatMatches.length}</span> doc{flatMatches.length !== 1 ? 's' : ''} match <span className="text-blue-600 font-medium">&quot;{searchTerm.trim()}&quot;</span></span>
                  <button onClick={handleSelectAllMatches} className="ml-1 px-2 py-0.5 bg-blue-50 text-blue-600 font-medium rounded-md hover:bg-blue-100 transition-colors flex-shrink-0">Select all {flatMatches.length}</button>
                  {selectedDocIds.size > 0 && (
                    <><span className="text-gray-300 flex-shrink-0">·</span>
                    <span className="font-semibold text-blue-700 flex-shrink-0">{selectedDocIds.size} selected</span>
                    <button onClick={handleClearSelection} className="ml-auto flex items-center gap-1 text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0"><X className="w-3 h-3" /> Clear</button></>
                  )}
                </>
              ) : (
                <><Search className="w-3 h-3 text-gray-300 flex-shrink-0" />
                <span className="text-gray-400">No matches for <span className="font-medium text-gray-600">&quot;{searchTerm.trim()}&quot;</span></span></>
              )}
            </div>
          )}

          {savedAtIso && !isSearching && (
            <div className="text-xs text-gray-500 italic">
              Resuming saved session · last saved {new Date(savedAtIso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
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
                    onSecondaryAction={(envId, d) => setReturnTarget({ envelopeId: envId, doc: d })}
                    secondaryKind="return-upstream" />
                ))}
              </div>
            </div>
          )}
          {isSearching ? (
            <FlatSearchList items={flatMatches} searchTerm={searchTerm.trim()} selectedDocIds={selectedDocIds} folderNameMap={folderNameMap}
              onToggleSelect={handleToggleSelect} onSelectAll={handleSelectAllMatches} onClear={handleClearSelection}
              onDragStart={handleDragStart} onDragEnd={handleDragEnd} draggedDocId={draggedDocId}
              onPreview={handlePreview} onReleaseNow={handleReleaseNow}
              onReturnUpstream={(envId, doc) => setReturnTarget({ envelopeId: envId, doc })}
              onForward={handleForward} canForward={childFolders.length > 0}
              onMarkAsProcessed={handleAddToQueue}
              onDuplicate={handleDuplicateDoc}
              trustedRoutes={trustedRoutes} onTrustStar={handleTrustStar} onRevokeTrustStar={handleRevokeTrustStar} onRename={handleRenameDoc}
              hideLabelActions={true} hideTier1Actions={true} />
          ) : isReturnsBatch ? (
            // Processed-batch context (Folder Admin): the original docs have
            // already been handled — only the returned items need attention.
            // Render the completion state below the Returns section so the
            // admin knows the batch itself is done.
            returnsList.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-200 px-6 py-12 text-center">
                <Check className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
                <p className="text-sm font-medium text-gray-700">All returned documents have been resolved</p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-gray-200 px-6 py-12 text-center">
                <Check className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
                <p className="text-sm font-medium text-gray-700">All mail has been processed</p>
              </div>
            )
          ) : allDocs.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-200 px-6 py-12 text-center">
              <Check className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
              <p className="text-sm font-medium text-gray-700">All documents have been routed</p>
            </div>
          ) : visibleDocs.length === 0 ? (
            // The inline list is empty because either every doc is in the
            // Returns section above, or the source filter excludes everything.
            returnsList.length > 0 ? null : (
              <div className="bg-white rounded-2xl border border-gray-200 px-6 py-10 text-center">
                <p className="text-sm font-medium text-gray-700">No documents from this source.</p>
                <button onClick={() => setSourceFilter('all')} className="mt-1 text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors">Show all</button>
              </div>
            )
          ) : (
            // V2 Brief §10 — flat individual cards in every Folder Admin view.
            // AI batching is reserved for cases that don't fire in this demo's
            // mock data; rendering flat keeps Sales / Jobsite A / Operations
            // consistent and stops the misleading "[Recipient] · AI BATCH" headers.
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="divide-y divide-gray-100">
                {visibleDocs.map(({ doc, envelope }) => (
                  <DocumentRow key={doc.id} doc={doc} envelopeId={envelope.id} senderName={envelope.sender}
                    folderNameMap={folderNameMap}
                    onDragStart={handleDragStart} onRightDragStart={handleRightDragStart} onDragEnd={handleDragEnd}
                    isDragging={draggedDocId === doc.id}
                    onPreview={handlePreview}
                    onReleaseNow={handleReleaseNow}
                    onRemoveInstance={handleRemoveInstance}
                    onReturnUpstream={(envId, d) => setReturnTarget({ envelopeId: envId, doc: d })}
                    onMarkAsProcessed={handleAddToQueue}
                    onForward={handleForward} canForward={childFolders.length > 0}
                    onDuplicate={handleDuplicateDoc}
                    trustedRoutes={trustedRoutes}
                    onTrustStar={handleTrustStar}
                    onRevokeTrustStar={handleRevokeTrustStar}
                    onUndoAutoRoute={handleUndoAutoRoute}
                    onRename={handleRenameDoc}
                    isSearching={false}
                    isSelected={selectedDocIds.has(doc.id)}
                    onToggleSelect={handleToggleSelect}
                    selectionMode={selectedDocIds.size > 0}
                    selectionCount={selectedDocIds.size}
                    inboxSource={doc.inboxSource}
                    hideLabelActions={true} hideTier1Actions={true} />
                ))}
              </div>
            </div>
          )}
          <div className="text-center pt-2 pb-6"><p className="text-xs text-gray-400">— End of {isReturnsBatch ? 'batch' : 'incoming mail'} —</p></div>
        </div>

        {/* Process All bar — Folder admins process their inbox (not dispatching a fresh run).
            Hidden in the Processed-batch returns context: the batch is already done. */}
        {!isReturnsBatch && totalRemaining === 0 && dispatchedTotal > 0 && (
          <div className="px-6 py-4 border-t border-emerald-100 bg-gradient-to-r from-emerald-50 to-green-50 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0"><Check className="w-5 h-5 text-emerald-600" /></div>
              <div>
                <p className="text-sm font-semibold text-gray-900">Ready to process</p>
                <p className="text-xs text-gray-500">
                  {dispatchedTotal} pg routed · {queuedItems.length > 0 ? `${queuedItems.length} queued for download` : 'nothing in download pile'}
                </p>
              </div>
            </div>
            <button onClick={handleProcessAll} className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 transition-colors shadow-md">Process All</button>
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
        <div className="px-4 py-3 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-gray-900">Dispatch to</h2>
            {onSaveProgress && !isReturnsBatch && (
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
                  title="Snapshot current routing and mark this batch as In Progress in the Inbox"
                  className="px-2.5 py-1 text-[11px] font-medium text-gray-700 bg-white hover:bg-gray-50 border border-gray-300 rounded-md transition-colors"
                >
                  Save progress
                </button>
              </div>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-0.5">Drag · click to drill in · right-click to manage</p>
        </div>

        {/* Child folders + Return — fills the upper portion of the panel */}
        <div className="flex-1 min-h-0 overflow-y-auto p-3 bg-gradient-to-b from-slate-50 to-slate-100">
          {isLeaf ? (
            <div className="text-center px-4 py-6">
              <p className="text-xs text-gray-500 leading-relaxed">No child folders yet. Add one to route into, or use <span className="font-medium">Process as Download</span> / <span className="font-medium">Return</span>.</p>
            </div>
          ) : (() => {
            // Sort A→Z within each section; default recipient_type is 'group'.
            const sorted = [...childFolders].sort((a, b) => a.name.localeCompare(b.name));
            const groupItems      = sorted.filter(f => (f.recipient_type ?? 'group') === 'group');
            const individualItems = sorted.filter(f => f.recipient_type === 'personal');
            return (
              <div className="space-y-3">
                {groupItems.length > 0      && <FolderSection sectionKey="group"      label="Group"      items={groupItems}      collapsed={collapsedSections.has('group')}      onToggle={toggleSection} renderBucket={renderBucket} />}
                {individualItems.length > 0 && <FolderSection sectionKey="individual" label="Individual" items={individualItems} collapsed={collapsedSections.has('individual')} onToggle={toggleSection} renderBucket={renderBucket} />}
              </div>
            );
          })()}
          {/* Return + Junk buckets — both special destinations, separated from the folder grid. */}
          <div className="grid grid-cols-2 gap-1 mt-2">
            <BucketTile name="Return" count={counts[RETURN_ID] || 0} isFolder={false}
              customIcon={<MacOutbox />}
              hovered={hoveredBucket === RETURN_ID && !!draggedDoc} pulsing={pulsing === RETURN_ID}
              bulkCount={dragBulkCount}
              onClick={draggedDoc ? undefined : () => handleEnterDrill(RETURN_ID)}
              onDragOver={e => handleDragOver(e, RETURN_ID)} onDragLeave={handleDragLeave} onDrop={e => handleDrop(e, RETURN_ID)} />
            <BucketTile name="Junk" count={counts.junk || 0} isFolder={false}
              hovered={hoveredBucket === 'junk' && !!draggedDoc} pulsing={pulsing === 'junk'}
              bulkCount={dragBulkCount}
              onClick={draggedDoc ? undefined : () => handleEnterDrill('junk')}
              onDragOver={e => handleDragOver(e, 'junk')} onDragLeave={handleDragLeave} onDrop={e => handleDrop(e, 'junk')} />
          </div>
        </div>

        {/* Add Folder — sits between folder grid and Process as Download */}
        <div className="px-4 pt-3 pb-2 bg-white border-t border-gray-200 flex-shrink-0">
          <button onClick={() => setShowAddFolder(true)} className={
            isLeaf
              ? 'w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-sm'
              : 'w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-blue-600 hover:bg-blue-50 border border-dashed border-blue-300 rounded-lg transition-colors'
          }>
            + Add Recipient
          </button>
        </div>

        {/* Process as Download — compact zone at the bottom. Hidden in the
            Processed-batch returns context: the batch has already been
            processed, so this action isn't applicable to returned items. */}
        {!isReturnsBatch && (
          <div className="px-3 pt-2 pb-2 bg-white border-t border-gray-200 flex-shrink-0">
            <div className="flex items-center justify-between px-1 mb-1.5">
              <div className="flex items-center gap-1.5">
                <h3 className="text-xs font-semibold text-gray-900">📥 Process as Download</h3>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${queuedItems.length > 0 ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-400'}`}>{queuedItems.length}</span>
              </div>
            </div>
            <div
              onDragOver={e => handleDragOver(e, PROCESS_QUEUE_ID)}
              onDragLeave={handleDragLeave}
              onDrop={e => handleDrop(e, PROCESS_QUEUE_ID)}
              className={`rounded-lg border-2 border-dashed transition-colors px-2.5 py-1.5 overflow-y-auto ${
                hoveredBucket === PROCESS_QUEUE_ID && !!draggedDoc
                  ? 'border-blue-400 bg-blue-50'
                  : queuedItems.length > 0 ? 'border-gray-300 bg-white' : 'border-gray-200 bg-gray-50'
              } ${pulsing === PROCESS_QUEUE_ID ? 'ring-2 ring-blue-300' : ''}`}
              style={{ minHeight: 56, maxHeight: 130 }}
            >
              {queuedItems.length === 0 ? (
                <p className="text-[11px] text-gray-400 italic text-center py-2.5 leading-relaxed">
                  Drag a scan here to process &amp; download
                </p>
              ) : (
                <ul className="space-y-0.5">
                  {queuedItems.map(({ doc, envelope }) => (
                    <li key={doc.id} className="flex items-center gap-1.5">
                      <span className="font-mono text-[10px] text-gray-500 flex-shrink-0">#{doc.docId || doc.id.slice(0, 6)}</span>
                      <span className="text-[11px] text-gray-800 truncate flex-1">{doc.title}</span>
                      <button onClick={() => handleRemoveInstance(envelope.id, doc)}
                        title="Remove from queue"
                        className="w-4 h-4 flex items-center justify-center text-gray-300 hover:text-red-500 hover:bg-red-50 rounded transition-colors flex-shrink-0">
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        {/* Stats — pinned to the very bottom */}
        <div className="px-4 py-2.5 bg-white border-t border-gray-200 flex-shrink-0">
          <div className="flex justify-between text-xs">
            <span className="text-gray-500">Processed</span>
            <span className="font-semibold text-gray-900">{processedCount}</span>
          </div>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mt-1.5">
            <div className="h-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-500" style={{ width: progress + '%' }} />
          </div>
        </div>
      </div>

      {/* Right-click-drag ghost: fixed-position floating chip that follows
          the cursor while the gesture is active. Mirrors MailDispatch. */}
      {rightDrag && (
        <div className="fixed pointer-events-none z-50 flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-md shadow-2xl"
          style={{ left: rightDragPos.x + 12, top: rightDragPos.y + 12 }}>
          <Copy className="w-3.5 h-3.5" /> Copy: {rightDrag.doc.title}
        </div>
      )}

      {/* ── Modals ── */}
      {showFinalize && <FinalizeModal summary={dispatchSummary} total={dispatchedTotal} labelsPrinted={0} onClose={() => setShowFinalize(false)} />}
      {returnTarget && <ReturnModal doc={returnTarget.doc} onConfirm={handleConfirmReturn} onClose={() => setReturnTarget(null)} />}
      {showDownloadArchive && (
        <DownloadArchiveModal
          items={queuedItems}
          onConfirm={handleDownloadArchiveConfirm}
          onClose={() => setShowDownloadArchive(false)}
        />
      )}
      {forwardTarget && (
        <ForwardModal
          doc={forwardTarget.doc}
          parentFolderName={activeFolderName}
          destinationOptions={childFolders}
          onConfirm={handleConfirmForward}
          onClose={() => setForwardTarget(null)}
        />
      )}
      {activeTrustTarget && (
        <TrustedRouteModal
          doc={activeTrustTarget.doc}
          envelope={activeTrustTarget.env}
          folders={childFolders}
          counts={counts}
          folderNameMap={folderNameMap}
          onConfirm={handleConfirmTrust}
          onClose={() => setTrustModal(null)}
        />
      )}
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
      {showAddFolder && <AddFolderModal parentName={activeFolderName} onSubmit={handleAddFolder} onClose={() => setShowAddFolder(false)} />}
      {showUploadInWorkspace && (
        <UploadDocumentModal
          onAdd={handleUploadInWorkspaceAdd}
          onClose={() => setShowUploadInWorkspace(false)}
        />
      )}
      {contextMenu && (() => {
        const target = childFolders.find(f => f.id === contextMenu.folderId);
        const isInactive = target?.admin_status === 'inactive_admin';
        return (
          <FolderContextMenu
            x={contextMenu.x} y={contextMenu.y} name={contextMenu.name}
            editEmphasized={isInactive}
            // Brief §3 — Edit / Assign delegate / Archive are structural
            // actions. Owner roles for this workroom are Folder Admin and
            // System Admin (SA uses the same inbox surface). Delegate View
            // (Folder scope) can route, return, forward, and process —
            // never restructure, so all three callbacks stay undefined.
            onEdit={user.role === 'Folder_Admin' || user.role === 'System_Admin' ? handleOpenEdit : undefined}
            onAssignDelegate={(user.role === 'Folder_Admin' || user.role === 'System_Admin') && isInactive ? handleOpenDelegate : undefined}
            onArchive={user.role === 'Folder_Admin' || user.role === 'System_Admin' ? handleArchiveClick : undefined}
            onClose={() => setContextMenu(null)}
          />
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
      {archiveTarget && <ConfirmModal title={`Archive "${archiveTarget.name}"?`} body={'No in-flight mail. Folder will be removed from your workspace.'} confirmLabel="Archive folder" onConfirm={handleConfirmArchive} onClose={() => setArchiveTarget(null)} />}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
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

// V2 §3.0 — left-panel source filter chip. Inactive state is muted gray,
// active flips to blue with a filled background. Optional hover tooltip
// surfaces the admin/sender attached to that source.
interface ChipPerson { name: string; title?: string; email?: string }
interface SourceChipProps {
  label: string;
  count?: number;
  active: boolean;
  onClick: () => void;
  hoverPerson?: ChipPerson | null;
  hoverContext?: string;
  // Short description shown on hover — frames what this chip's documents are.
  hoverDescription?: string;
}
function SourceChip({ label, count, active, onClick, hoverPerson, hoverContext, hoverDescription }: SourceChipProps) {
  const showPopover = !!hoverPerson || !!hoverDescription;
  return (
    <div className="relative group">
      <button onClick={onClick}
        title={hoverDescription}
        className={`px-2.5 py-1 text-[11px] font-medium rounded-full border transition-colors ${active ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-gray-300 text-gray-700 hover:border-gray-400 hover:text-gray-900'}`}>
        {label}
        {typeof count === 'number' && (
          <span className={`ml-1 ${active ? 'opacity-80' : 'text-gray-500'}`}>({count})</span>
        )}
      </button>
      {showPopover && (
        <div className="pointer-events-none absolute left-0 top-full mt-1.5 z-30 opacity-0 group-hover:opacity-100 transition-opacity bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-2 whitespace-nowrap">
          {hoverContext && <p className="text-[10px] uppercase tracking-wide font-semibold text-gray-400 mb-0.5">{hoverContext}</p>}
          {hoverPerson && <p className="text-xs font-semibold text-gray-900">{hoverPerson.name}</p>}
          {hoverPerson?.title && <p className="text-[11px] text-gray-500">{hoverPerson.title}</p>}
          {hoverPerson?.email && <p className="text-[11px] text-gray-400">{hoverPerson.email}</p>}
          {hoverDescription && (
            <p className={`text-[11px] text-gray-500 ${hoverPerson ? 'mt-1 pt-1 border-t border-gray-100' : ''}`}>
              {hoverDescription}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
