'use client';
import { useMemo, useState } from 'react';
import { X, Search, ChevronLeft, ChevronRight, Check, Printer, Trash2 } from 'lucide-react';
import type { Document, SplitGroup } from '@/src/types';
import DocumentPreviewModal from '@/src/components/modals/DocumentPreviewModal';
import FolderFilterDropdown from '@/src/components/shared/FolderFilterDropdown';
import { FOLDERS } from '@/src/mocks/data';
import { findUser } from '@/src/mocks/users';

// V2 §6 — Dispatched batch modal shared by the Mail Log (SA / Worker
// "View send history") and the Folder Admin Inbox (clicking a Dispatched
// row). The `variant` prop drives the column layout — Mail Log gets the
// richer Released-run detail (label, sent + last activity, admin tooltips,
// no Physical Split in the preview, plus a toolbar + floating action bar
// for bulk actions), Inbox keeps the original simple layout.
export interface BatchDocRecord {
  docId: string;
  title: string;
  destination: string;
  destinationFolderId?: string;
  timestamp: string;
  pages?: number;
  currentLocation?: string[];   // undefined → fall back to [destination]; empty → "Completed"
  // Send-history variant fields. Safe to omit on inbox use.
  labelStatus?: 'printed' | 'skipped' | 'not_applicable' | 'ai_suggested';
  lastActivity?: string;
  finalRecipient?: { name: string; email?: string; role?: string; downloadedAt?: string };
  returnedBy?: { name: string };
  returnReason?: string;
}

interface Props {
  title: string;
  subtitle: string;
  records: BatchDocRecord[];
  onClose: () => void;
  // 'send-history' is the SA/Worker Mail Log Released-run detail; 'inbox'
  // is the Folder Admin dispatched-batch surface (default — unchanged).
  variant?: 'send-history' | 'inbox';
}

const PAGE_SIZE = 25;

// Leaf-folder path for a record. Used to (a) group bucket badges in the
// toolbar and (b) drive the location-filter set.
function leafPath(r: BatchDocRecord): string[] {
  if (r.currentLocation === undefined) return [r.destination];
  if (r.currentLocation.length === 0) return ['Completed'];
  return r.currentLocation;
}

function renderCurrentLocation(record: BatchDocRecord): React.ReactNode {
  const loc = record.currentLocation;
  if (loc === undefined) return record.destination;
  // Match the green status-badge styling used on the Mail Log "Released"
  // row and the Inbox "New" row — same pill shape, color family, and
  // border so the Completed state reads as a true status indicator.
  if (loc.length === 0)  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 border border-green-200">
      Completed
    </span>
  );
  if (loc.length === 1)  return loc[0];
  return loc.join(' → ');
}

// Synthesize a minimal Document so the preview modal can render the page
// flip-through. Routing history is intentionally omitted — the preview
// modal no longer shows it.
function recordToDocument(record: BatchDocRecord): Document {
  return {
    id: record.docId,
    docId: record.docId,
    title: record.title,
    pages: record.pages ?? 1,
    confidence: 1,
  };
}

// Look up admin metadata (name / email / role) by folder id when supplied,
// falling back to a name-based match against FOLDERS. Returns null if the
// folder or user can't be resolved.
function lookupFolderAdmin(folderName: string, folderId?: string): { name: string; email?: string; title?: string } | null {
  const folder = folderId
    ? FOLDERS.find(f => f.id === folderId)
    : FOLDERS.find(f => f.name === folderName);
  if (!folder?.admin_user_id) return null;
  const u = findUser(folder.admin_user_id);
  if (!u) return null;
  return { name: u.name, email: u.email, title: u.title };
}

// Tooltip body for the DISPATCHED TO cell — admin of the root folder.
function dispatchedToTooltip(record: BatchDocRecord): string | undefined {
  const admin = lookupFolderAdmin(record.destination, record.destinationFolderId);
  if (!admin) return undefined;
  const parts = [admin.email, admin.title].filter(Boolean).join(' · ');
  return `Admin: ${admin.name}${parts ? '\n' + parts : ''}`;
}

// Tooltip body for the CURRENT LOCATION cell — handler context varies by
// the location's terminal state (folder vs Completed vs Returned).
function currentLocationTooltip(record: BatchDocRecord): string | undefined {
  const loc = record.currentLocation;
  // Returned-to-Mail-Log scenario: record carries returnedBy + reason.
  if (record.returnedBy) {
    const reason = record.returnReason ? ` "${record.returnReason}"` : '';
    return `Returned by: ${record.returnedBy.name}${reason ? '\nReason:' + reason : ''}`;
  }
  if (loc && loc.length === 0) {
    // Completed: final-recipient details if available; otherwise nothing useful.
    const fr = record.finalRecipient;
    if (!fr) return undefined;
    const meta = [fr.email, fr.role].filter(Boolean).join(' · ');
    const downloaded = fr.downloadedAt ? `\nDownloaded: ${fr.downloadedAt}` : '';
    return `Final recipient: ${fr.name}${downloaded}${meta ? '\n' + meta : ''}`;
  }
  // Folder location — admin of the deepest folder in the path.
  const tail = loc && loc.length > 0 ? loc[loc.length - 1] : record.destination;
  const admin = lookupFolderAdmin(tail);
  if (!admin) return undefined;
  const parts = [admin.email, admin.title].filter(Boolean).join(' · ');
  return `Current admin: ${admin.name}${parts ? '\n' + parts : ''}`;
}

function LabelCell({ status }: { status?: BatchDocRecord['labelStatus'] }) {
  // Same badge family as the Mail Log / Inbox status pills — green for the
  // completed (printed) state, blue for the in-queue state, grey for
  // inactive states (skipped or never needed).
  if (status === 'printed') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 border border-green-200">
        <Check className="w-3 h-3" /> Printed
      </span>
    );
  }
  if (status === 'ai_suggested') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 border border-blue-200">
        <Printer className="w-3 h-3" /> In print queue
      </span>
    );
  }
  const label = status === 'skipped' ? 'No label needed' : 'Not applicable';
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 border border-gray-300">
      {label}
    </span>
  );
}

export default function DispatchedBatchModal({ title, subtitle, records, onClose, variant = 'inbox' }: Props) {
  const [search, setSearch] = useState('');
  const [page, setPage]     = useState(0);
  const [previewRecord, setPreviewRecord] = useState<BatchDocRecord | null>(null);
  // Send-history-only bulk-action state. Always initialised so the hook
  // order stays stable across variants.
  const [selectedIds, setSelectedIds]   = useState<Set<string>>(() => new Set());
  const [locationFilters, setLocationFilters] = useState<Set<string>>(() => new Set());
  const [deletedIds, setDeletedIds]     = useState<Set<string>>(() => new Set());
  // In-modal label overrides — when the worker hits "Print labels (N)" the
  // selected docs flip to 'ai_suggested' in the table view so the next
  // visit to the SA/Worker dispatch workspace picks them up in the queue.
  const [labelOverrides, setLabelOverrides] = useState<Map<string, 'ai_suggested'>>(() => new Map());
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [toastText, setToastText] = useState<string | null>(null);

  const isSendHistory = variant === 'send-history';

  // Active records: drop anything the worker has soft-deleted in-session.
  const activeRecords = useMemo(
    () => records.filter(r => !deletedIds.has(r.docId)),
    [records, deletedIds],
  );

  // Apply label overrides for the rendered rows.
  const recordsWithOverrides = useMemo(
    () => activeRecords.map(r => {
      const override = labelOverrides.get(r.docId);
      return override ? { ...r, labelStatus: override } : r;
    }),
    [activeRecords, labelOverrides],
  );

  // Bucket badges: group records by leaf-folder path, then de-collide
  // names that appear under different parents by suffixing the parent.
  const buckets = useMemo(() => {
    type B = { key: string; display: string; count: number; parent?: string };
    const byKey = new Map<string, B>();
    activeRecords.forEach(r => {
      const path = leafPath(r);
      const key = path.join(' › ');
      const name = path[path.length - 1];
      const parent = path.length > 1 ? path[path.length - 2] : undefined;
      const existing = byKey.get(key);
      if (existing) existing.count++;
      else byKey.set(key, { key, display: name, count: 1, parent });
    });
    const nameCount = new Map<string, number>();
    byKey.forEach(v => nameCount.set(v.display, (nameCount.get(v.display) || 0) + 1));
    byKey.forEach(v => {
      if ((nameCount.get(v.display) || 0) > 1 && v.parent) {
        v.display = `${v.display} (${v.parent})`;
      }
    });
    return Array.from(byKey.values()).sort((a, b) => a.display.localeCompare(b.display));
  }, [activeRecords]);

  // Search-filter first, then location-filter.
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let out = recordsWithOverrides;
    if (q) out = out.filter(r => r.title.toLowerCase().includes(q) || r.docId.toLowerCase().includes(q));
    if (isSendHistory && locationFilters.size > 0) {
      out = out.filter(r => locationFilters.has(leafPath(r).join(' › ')));
    }
    return out;
  }, [recordsWithOverrides, search, locationFilters, isSendHistory]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage   = Math.min(page, totalPages - 1);
  const pageStart  = safePage * PAGE_SIZE;
  const pageEnd    = Math.min(pageStart + PAGE_SIZE, filtered.length);
  const pageRows   = filtered.slice(pageStart, pageEnd);
  const showPagination = filtered.length > PAGE_SIZE;

  const previewDoc = previewRecord ? recordToDocument(previewRecord) : null;
  // Selection scope is the currently-filtered set, not the full records.
  const filteredIds = useMemo(() => new Set(filtered.map(r => r.docId)), [filtered]);
  const effectiveSelectedIds = useMemo(
    () => new Set([...selectedIds].filter(id => filteredIds.has(id))),
    [selectedIds, filteredIds],
  );
  const selectedCount = effectiveSelectedIds.size;
  const allSelected = filtered.length > 0 && selectedCount === filtered.length;
  const totalColumns = (isSendHistory ? 7 : 5) + (isSendHistory ? 1 : 0); // + checkbox col

  const toggleRow = (docId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(docId)) next.delete(docId); else next.add(docId);
      return next;
    });
  };
  const toggleSelectAll = () => {
    setSelectedIds(allSelected ? new Set() : new Set(filtered.map(r => r.docId)));
  };
  const toggleFilter = (key: string) => {
    setLocationFilters(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
    setPage(0);
  };
  const handlePrintLabels = () => {
    if (selectedCount === 0) return;
    setLabelOverrides(prev => {
      const next = new Map(prev);
      effectiveSelectedIds.forEach(id => next.set(id, 'ai_suggested'));
      return next;
    });
    setSelectedIds(new Set());
    const n = selectedCount;
    setToastText(`${n} label${n !== 1 ? 's' : ''} added to print queue`);
    window.setTimeout(() => setToastText(null), 3000);
  };
  const handleConfirmDelete = () => {
    if (effectiveSelectedIds.size === 0) { setConfirmDelete(false); return; }
    setDeletedIds(prev => {
      const next = new Set(prev);
      effectiveSelectedIds.forEach(id => next.add(id));
      return next;
    });
    const n = effectiveSelectedIds.size;
    setSelectedIds(new Set());
    setConfirmDelete(false);
    setToastText(`${n} document${n !== 1 ? 's' : ''} deleted`);
    window.setTimeout(() => setToastText(null), 3000);
  };
  const clearSelection = () => setSelectedIds(new Set());

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ backgroundColor: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden relative"
        style={{ width: isSendHistory ? 1080 : 880, maxHeight: '85vh' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-gray-200 flex items-start justify-between flex-shrink-0">
          <div>
            <h2 className="text-base font-semibold text-gray-900">{title}</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {subtitle}{deletedIds.size > 0 ? ` · ${deletedIds.size} deleted` : ''}
            </p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center text-gray-500 hover:bg-gray-100 rounded-md flex-shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search */}
        <div className="px-6 py-3 border-b border-gray-100 flex items-center gap-2 flex-shrink-0">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
            <input value={search} onChange={e => { setSearch(e.target.value); setPage(0); }}
              placeholder="Search by document name or doc ID…"
              className="w-full h-9 pl-8 pr-7 text-sm text-gray-900 placeholder:text-gray-400 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-400 transition-colors" />
            {search && (
              <button onClick={() => { setSearch(''); setPage(0); }} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* Toolbar — Select all + folder filter dropdown. The chip row was
            consolidated into a single multi-select dropdown; Select all
            stays on the left driving the existing bulk-select state. */}
        {isSendHistory && buckets.length > 0 && (
          <div className="px-6 py-2 bg-gray-50 border-b border-gray-200 flex items-center gap-3 flex-wrap flex-shrink-0">
            <button onClick={toggleSelectAll} disabled={filtered.length === 0}
              className="inline-flex items-center gap-2 text-[11px] font-medium text-gray-700 hover:text-gray-900 transition-colors flex-shrink-0 disabled:opacity-40 disabled:cursor-not-allowed">
              <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all ${allSelected ? 'bg-blue-500 border-blue-500' : 'bg-white border-gray-400'}`}>
                {allSelected && <Check className="w-2.5 h-2.5 text-white" />}
              </div>
              {allSelected ? 'Deselect all' : 'Select all'}
            </button>
            <div className="w-px h-4 bg-gray-300 flex-shrink-0" />
            <FolderFilterDropdown
              options={buckets.map(b => ({ id: b.key, name: b.display, count: b.count }))}
              selected={locationFilters}
              onChange={next => {
                // Apply by replicating toggleFilter's side effects: any
                // change to filters resets pagination and selection.
                setLocationFilters(next);
                setPage(0);
                setSelectedIds(new Set());
              }}
            />
          </div>
        )}

        {/* Table */}
        <div className="flex-1 overflow-y-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
              <tr>
                {isSendHistory && <th className="px-3 py-3 w-10" />}
                <th className="px-4 py-3 text-left text-[11px] font-normal text-gray-400 uppercase tracking-[0.06em]">Document</th>
                <th className="px-4 py-3 text-left text-[11px] font-normal text-gray-400 uppercase tracking-[0.06em] w-24">Doc ID</th>
                {isSendHistory && <th className="px-4 py-3 text-left text-[11px] font-normal text-gray-400 uppercase tracking-[0.06em] w-40">Label</th>}
                <th className="px-4 py-3 text-left text-[11px] font-normal text-gray-400 uppercase tracking-[0.06em] w-36">Dispatched to</th>
                <th className="px-4 py-3 text-left text-[11px] font-normal text-gray-400 uppercase tracking-[0.06em]">Current location</th>
                {isSendHistory ? <>
                  <th className="px-4 py-3 text-left text-[11px] font-normal text-gray-400 uppercase tracking-[0.06em] w-40">Sent</th>
                  <th className="px-4 py-3 text-left text-[11px] font-normal text-gray-400 uppercase tracking-[0.06em] w-40">Last activity</th>
                </> : (
                  <th className="px-4 py-3 text-left text-[11px] font-normal text-gray-400 uppercase tracking-[0.06em] w-44">Timestamp</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {pageRows.length === 0 ? (
                <tr>
                  <td colSpan={totalColumns} className="px-4 py-12 text-center text-sm text-gray-400">
                    {search || locationFilters.size > 0 ? 'No documents match the current filters.' : 'No documents to show.'}
                  </td>
                </tr>
              ) : pageRows.map(r => {
                const dispatchedTip = isSendHistory ? dispatchedToTooltip(r) : undefined;
                const locationTip   = isSendHistory ? currentLocationTooltip(r) : undefined;
                const sent = isSendHistory ? (r.timestamp || '—') : r.timestamp;
                const lastActivity = isSendHistory
                  ? (r.lastActivity && r.lastActivity !== r.timestamp ? r.lastActivity : '—')
                  : null;
                const isSelected = effectiveSelectedIds.has(r.docId);
                return (
                  <tr key={r.docId} onClick={() => setPreviewRecord(r)}
                    className={`cursor-pointer transition-colors ${isSelected ? 'bg-blue-50/40 hover:bg-blue-50' : 'hover:bg-gray-50'}`}>
                    {isSendHistory && (
                      <td className="px-3 py-3 w-10">
                        <div onClick={e => { e.stopPropagation(); toggleRow(r.docId); }}
                          className={`w-4 h-4 rounded border-2 flex items-center justify-center cursor-pointer transition-all ${isSelected ? 'bg-blue-500 border-blue-500' : 'bg-white border-gray-300 hover:border-blue-400'}`}>
                          {isSelected && <Check className="w-2.5 h-2.5 text-white" />}
                        </div>
                      </td>
                    )}
                    <td className="px-4 py-3 text-sm text-gray-900">{r.title}</td>
                    <td className="px-4 py-3 text-sm text-gray-500 font-mono">#{r.docId}</td>
                    {isSendHistory && (
                      <td className="px-4 py-3 text-sm">
                        <LabelCell status={r.labelStatus} />
                      </td>
                    )}
                    <td className="px-4 py-3 text-sm text-gray-600">
                      <span title={dispatchedTip} className={dispatchedTip ? 'cursor-help' : undefined}>{r.destination}</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      <span title={locationTip} className={locationTip ? 'cursor-help' : undefined}>{renderCurrentLocation(r)}</span>
                    </td>
                    {isSendHistory ? <>
                      <td className="px-4 py-3 text-sm text-gray-500">{sent}</td>
                      <td className="px-4 py-3 text-sm text-gray-500">{lastActivity}</td>
                    </> : (
                      <td className="px-4 py-3 text-sm text-gray-500">{r.timestamp}</td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer with pagination */}
        <div className="px-6 py-3 border-t border-gray-200 bg-gray-50 flex items-center justify-between flex-shrink-0">
          {showPagination ? (
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span>{filtered.length === 0 ? '0' : `${pageStart + 1}–${pageEnd}`} of {filtered.length}</span>
              <div className="flex items-center gap-1 ml-1">
                <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={safePage === 0}
                  className="w-7 h-7 inline-flex items-center justify-center rounded-md border border-gray-300 text-gray-600 hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={safePage >= totalPages - 1}
                  className="w-7 h-7 inline-flex items-center justify-center rounded-md border border-gray-300 text-gray-600 hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ) : (
            <span className="text-xs text-gray-400">{filtered.length} document{filtered.length !== 1 ? 's' : ''}</span>
          )}
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">Close</button>
        </div>

        {/* Floating action bar — only renders when there's an active
            selection. Text-button styling: each action is a flat colored
            text button with a thin vertical divider in between, all inside
            one pill. Sits above the pagination footer. */}
        {isSendHistory && selectedCount > 0 && (
          <div className="absolute left-1/2 -translate-x-1/2 z-40 flex items-center gap-1 bg-white border border-gray-200 rounded-full shadow-xl px-4 py-1.5"
            style={{ bottom: 64 }}>
            <span className="text-xs font-semibold text-gray-700 pr-2">{selectedCount} selected</span>
            <div className="w-px h-4 bg-gray-200" />
            <button onClick={handlePrintLabels}
              className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors">
              <Printer className="w-3.5 h-3.5" /> Print labels ({selectedCount})
            </button>
            <div className="w-px h-4 bg-gray-200" />
            <button onClick={() => setConfirmDelete(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors">
              <Trash2 className="w-3.5 h-3.5" /> Delete ({selectedCount})
            </button>
            <div className="w-px h-4 bg-gray-200" />
            <button onClick={clearSelection}
              className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors">
              <X className="w-3.5 h-3.5" /> Clear
            </button>
          </div>
        )}

        {/* Inline toast — confirmation feedback for bulk actions. */}
        {toastText && (
          <div className="absolute left-1/2 -translate-x-1/2 z-40 px-3 py-1.5 bg-gray-900 text-white text-xs font-medium rounded-full shadow-lg"
            style={{ bottom: 20 }}>
            {toastText}
          </div>
        )}
      </div>

      {/* Delete confirmation modal */}
      {confirmDelete && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-6"
          style={{ backgroundColor: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(4px)' }}
          onClick={() => setConfirmDelete(false)}>
          <div className="bg-white rounded-2xl shadow-2xl overflow-hidden" style={{ width: 460 }} onClick={e => e.stopPropagation()}>
            <div className="px-6 py-5 border-b border-gray-200">
              <h3 className="text-base font-semibold text-gray-900">Delete {selectedCount} document{selectedCount !== 1 ? 's' : ''}?</h3>
              <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">
                These documents will be soft-deleted and removed from active circulation.
                Originals are preserved in the archive. This cannot be undone from this view.
              </p>
            </div>
            <div className="px-6 py-4 bg-gray-50 flex items-center justify-end gap-2">
              <button onClick={() => setConfirmDelete(false)}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                Cancel
              </button>
              <button onClick={handleConfirmDelete}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-red-600 text-white text-sm font-semibold rounded-lg hover:bg-red-700 transition-colors shadow-sm">
                <Trash2 className="w-3.5 h-3.5" /> Delete {selectedCount}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Row-click preview. Preview modal handles its own click-outside and is
          stacked above the batch modal via its fixed z-50; we rely on React's
          render order putting it above this one (rendered after). In the
          send-history context the Physical Split action is hidden — the
          document has already been dispatched. */}
      {previewDoc && (
        <DocumentPreviewModal
          doc={previewDoc}
          envelopeId={previewDoc.id}
          folderNameMap={{}}
          onClose={() => setPreviewRecord(null)}
          onApplySplit={(_e: string, _d: string, _g: SplitGroup[]) => { /* read-only preview — splits are no-ops here */ }}
          hideSplit={isSendHistory}
        />
      )}
    </div>
  );
}
