'use client';
import { useEffect, useMemo, useState } from 'react';
import { Search, X, MoreVertical, Calendar, Plus } from 'lucide-react';
import MultiStatusFilter from '@/src/components/shared/MultiStatusFilter';
import TablePagination from '@/src/components/shared/TablePagination';
import type { Document, Envelope, InboxGroup, InboxGroupStatus, Toast } from '@/src/types';
import DispatchedBatchModal, { type BatchDocRecord } from '@/src/components/modals/DispatchedBatchModal';
import { INBOX_GROUPS } from '@/src/mocks/inboxData';
import { FOLDERS } from '@/src/mocks/data';
import { useUser } from '@/src/context/UserContext';
import ToastContainer from '@/src/components/shared/ToastContainer';
import UploadDocumentModal from '@/src/components/modals/UploadDocumentModal';

const PAGE_SIZE = 25;

// ── Types ──────────────────────────────────────────────────────────
// V2 §10 — Multi-select filter. `has-returns` is virtual: it ANDs with any
// status selections so e.g. `Processed + has-returns` shows Processed rows
// that also carry an inline returned badge.
type StatusFilterValue = InboxGroupStatus | 'has-returns';
interface MenuState { groupId: string; x: number; y: number }
interface MenuItem  { label: string; action: 'workspace' | 'history' | 'review-returns' }

interface Props {
  // Pass the full group object up so locally-uploaded batches (held in this
  // screen's localGroups state) can be opened by the parent page without it
  // needing to look them up against the static mock.
  onOpenGroup: (group: InboxGroup) => void;
  // V2 §7 — Save-progress: a saved batch is treated as In_Progress regardless
  // of its mock status. Mapping from group id → effective status overlay.
  statusOverrides?: Record<string, InboxGroupStatus>;
  // Group IDs whose returned items have all been resolved in-session. The
  // ↩ N returned badge hides for these groups (and they fall out of the
  // `has-returns` filter / row-click "review returns" branch).
  resolvedReturnGroupIds?: Set<string>;
}

// ── Constants ──────────────────────────────────────────────────────
const FILTER_OPTIONS: Array<{ value: StatusFilterValue; label: string }> = [
  { value: 'New',          label: 'New' },
  { value: 'In_Progress',  label: 'In Progress' },
  { value: 'Processed',    label: 'Processed' },
  { value: 'has-returns',  label: 'Has returns' },
];
const STATUS_BADGE: Record<InboxGroupStatus, string> = {
  New:         'bg-green-100 text-green-700 border border-green-200',
  In_Progress: 'bg-blue-100 text-blue-700 border border-blue-200',
  Processed:   'bg-gray-100 text-gray-600 border border-gray-300',
};
const STATUS_DISPLAY: Record<InboxGroupStatus, string> = {
  New: 'New', In_Progress: 'In Progress', Processed: 'Processed',
};

function getMenuItems(status: InboxGroupStatus, returnsCount: number): MenuItem[] {
  if (status === 'New')         return [{ label: 'Open',                  action: 'workspace' }];
  if (status === 'In_Progress') return [{ label: 'Pick up',               action: 'workspace' }];
  // Processed: history modal by default; plus a "Review returns" action when
  // there are returned docs to action.
  return [
    ...(returnsCount > 0 ? [{ label: `Review ${returnsCount} return${returnsCount !== 1 ? 's' : ''}`, action: 'review-returns' as const }] : []),
    { label: 'View dispatch history', action: 'history' as const },
  ];
}

// ── Dispatch history modal ─────────────────────────────────────────
// Thin wrapper around the shared DispatchedBatchModal. Maps the inbox
// group's dispatch records (uses `recipient`) into the normalized
// BatchDocRecord shape the shared modal consumes.
function DispatchHistoryModal({ group, onClose }: { group: InboxGroup; onClose: () => void }) {
  const records: BatchDocRecord[] = (group.dispatchHistory ?? []).map(r => ({
    docId: r.docId,
    title: r.title,
    destination: r.recipient,
    timestamp: r.timestamp,
    pages: r.pages,
    currentLocation: r.currentLocation,
  }));
  const subtitle = `Arrived ${group.arrivedAt} · ${group.docCount} documents · dispatched ${group.dispatchedAt}`;
  return <DispatchedBatchModal title={group.name} subtitle={subtitle} records={records} onClose={onClose} />;
}

// ── Main screen ────────────────────────────────────────────────────
export default function InboxQueueScreen({ onOpenGroup, statusOverrides, resolvedReturnGroupIds }: Props) {
  // Returns count net of in-session resolution; drives the badge, the
  // has-returns filter, the row-click branch, and the row menu.
  const effectiveReturnsCount = (g: InboxGroup) =>
    resolvedReturnGroupIds?.has(g.id) ? 0 : (g.returnedDocs?.length ?? 0);
  const { user } = useUser();
  const folderId   = user.folders?.[0] ?? 'sales';
  const folderName = FOLDERS.find(f => f.id === folderId)?.name ?? 'Sales';

  const [selectedStatuses, setSelectedStatuses] = useState<Set<StatusFilterValue>>(() => new Set());
  const [search, setSearch]                 = useState('');
  const [dateFrom, setDateFrom]             = useState('');
  const [dateTo, setDateTo]                 = useState('');
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [menu, setMenu]                     = useState<MenuState | null>(null);
  const [historyGroup, setHistoryGroup]     = useState<InboxGroup | null>(null);
  const [toasts, setToasts]                 = useState<Toast[]>([]);
  const [showUpload, setShowUpload]         = useState(false);
  const [page, setPage]                     = useState(0);
  // Locally-created batches from the Upload Document flow.
  const [localGroups, setLocalGroups]       = useState<InboxGroup[]>([]);

  const allGroups = useMemo(() => [...localGroups, ...INBOX_GROUPS], [localGroups]);

  // Effective status applies the parent's saved-session overrides on top of
  // the mock group's status (saved batches flip to In_Progress).
  const effectiveStatus = (g: InboxGroup): InboxGroupStatus => statusOverrides?.[g.id] ?? g.status;

  const filtered = useMemo(() => {
    let groups = [...allGroups];
    // Status sub-filters AND with the virtual `has-returns` filter.
    const statusOnly = [...selectedStatuses].filter((s): s is InboxGroupStatus => s !== 'has-returns');
    const hasReturnsFilter = selectedStatuses.has('has-returns');
    if (statusOnly.length > 0) groups = groups.filter(g => statusOnly.includes(effectiveStatus(g)));
    if (hasReturnsFilter)      groups = groups.filter(g => effectiveReturnsCount(g) > 0);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      groups = groups.filter(g => g.name.toLowerCase().includes(q) || g.actionedBy.toLowerCase().includes(q));
    }
    if (dateFrom) groups = groups.filter(g => g.arrivedAtIso >= dateFrom);
    if (dateTo)   groups = groups.filter(g => g.arrivedAtIso <= dateTo + 'T23:59:59');
    groups.sort((a, b) => b.arrivedAtIso.localeCompare(a.arrivedAtIso));
    return groups;
  // effectiveStatus closes over statusOverrides which is in deps.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStatuses, search, dateFrom, dateTo, allGroups, statusOverrides]);

  useEffect(() => { setPage(0); }, [selectedStatuses, search, dateFrom, dateTo]);
  const pageGroups = filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  const hasDateFilter = !!(dateFrom || dateTo);

  const addToast = (msg: string) => {
    const id = Date.now();
    setToasts(p => [...p, { id, message: msg }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 4500);
  };
  const dismissToast = (id: number) => setToasts(p => p.filter(t => t.id !== id));

  const handleRowClick = (group: InboxGroup) => {
    // Processed-with-returns opens the workspace so the user can re-route or
    // return-upstream the returned docs. Processed-without-returns opens the
    // existing history modal.
    if (effectiveStatus(group) === 'Processed') {
      if (effectiveReturnsCount(group) > 0) { onOpenGroup(group); return; }
      setHistoryGroup(group);
      return;
    }
    onOpenGroup(group);
  };

  const openMenu = (e: React.MouseEvent<HTMLButtonElement>, group: InboxGroup) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    setMenu(prev => prev?.groupId === group.id ? null : { groupId: group.id, x: rect.right, y: rect.bottom });
  };

  const handleAction = (group: InboxGroup, action: MenuItem['action']) => {
    setMenu(null);
    if (action === 'workspace' || action === 'review-returns') { onOpenGroup(group); return; }
    if (action === 'history')   { setHistoryGroup(group); return; }
  };

  const activeMenuGroup = menu ? allGroups.find(g => g.id === menu.groupId) ?? null : null;

  const handleUploadAdd = ({ name, docCount, fileNames }: { name: string; docCount: number; fileNames: string[] }) => {
    const now = new Date();
    const iso = now.toISOString().slice(0, 16);
    const human = now.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }).replace(',', ' ·');
    const stamp = now.getTime();
    // Synthesize a real envelope + Document list so the downstream workspace
    // has cards to render. inboxSource: 'uploaded' so the source tag shows.
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
    const envelopes: Envelope[] = [{
      id: `env-local-${stamp}`,
      sender: user.name ?? 'Upload',
      received: human,
      documents,
    }];
    const newGroup: InboxGroup = {
      id: 'ig-local-' + stamp,
      name,
      arrivedAt: human,
      arrivedAtIso: iso,
      docCount,
      status: 'New',
      actionedBy: user.name ?? 'You',
      envelopes,
    };
    setLocalGroups(prev => [newGroup, ...prev]);
    setShowUpload(false);
    addToast(`"${name}" added · ${docCount} document${docCount !== 1 ? 's' : ''}.`);
  };

  return (
    <div className="h-full flex flex-col bg-slate-50">
      <style>{`
        .ibq-new:hover            { background-color: rgba(16,185,129,0.04);  box-shadow: inset 3px 0 0 #10b981; }
        .ibq-inprogress:hover     { background-color: rgba(59,130,246,0.04);  box-shadow: inset 3px 0 0 #3b82f6; }
        .ibq-processed td         { opacity: 0.7; }
        .ibq-processed:hover      { background-color: rgba(0,0,0,0.015); }
        .ibq-active-returns:hover { background-color: rgba(245,158,11,0.05); box-shadow: inset 3px 0 0 #f59e0b; }
        .ibq-menu-btn          { opacity: 0; transition: opacity 0.1s; }
        tr:hover .ibq-menu-btn { opacity: 1; }
      `}</style>

      {/* ── Header ───────────────────────────────────────────────── */}
      <div className="bg-white flex-shrink-0 border-b border-gray-200">

        {/* Title */}
        <div className="px-6 pt-5 pb-3 border-b border-gray-100">
          <h1 className="text-2xl font-semibold text-gray-900">Inbox</h1>
        </div>

        {/* Filter bar */}
        <div className="px-6 py-3 flex items-center gap-2">
          <button onClick={() => setShowUpload(true)}
            className="order-last ml-auto h-9 inline-flex items-center gap-1.5 px-3 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm">
            <Plus className="w-4 h-4" /> Upload Document
          </button>
          {/* Status — multi-select. Empty = All. */}
          <MultiStatusFilter options={FILTER_OPTIONS} selected={selectedStatuses} onChange={setSelectedStatuses} />
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…"
              className="h-9 pl-8 pr-7 text-sm text-gray-900 placeholder:text-gray-400 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-400 transition-colors"
              style={{ width: 220 }} />
            {search && <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"><X className="w-3 h-3" /></button>}
          </div>
          {/* Date picker */}
          <div className="relative">
            <button onClick={() => setDatePickerOpen(v => !v)}
              className={`h-9 flex items-center gap-1.5 px-3 border rounded-lg text-sm bg-white transition-colors ${hasDateFilter ? 'border-blue-400 text-gray-900' : 'border-gray-300 text-gray-500 hover:border-gray-400'}`}>
              <Calendar className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
              <span className="whitespace-nowrap">{hasDateFilter ? `${dateFrom || '…'} – ${dateTo || '…'}` : 'All dates'}</span>
              {hasDateFilter && <span role="button" onClick={e => { e.stopPropagation(); setDateFrom(''); setDateTo(''); }} className="ml-0.5 text-gray-400 hover:text-gray-600 cursor-pointer"><X className="w-3 h-3" /></span>}
            </button>
            {datePickerOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setDatePickerOpen(false)} />
                <div className="absolute left-0 top-full mt-1 z-20 bg-white border border-gray-200 rounded-xl shadow-xl p-4" style={{ width: 260 }}>
                  <div className="space-y-3">
                    <div><label className="block text-xs font-medium text-gray-500 mb-1">From</label><input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-full h-9 px-3 text-sm text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-400 transition-colors" /></div>
                    <div><label className="block text-xs font-medium text-gray-500 mb-1">To</label><input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-full h-9 px-3 text-sm text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-400 transition-colors" /></div>
                  </div>
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                    <button onClick={() => { setDateFrom(''); setDateTo(''); setDatePickerOpen(false); }} className="text-xs text-gray-500 hover:text-gray-700 transition-colors">Clear</button>
                    <button onClick={() => setDatePickerOpen(false)} className="text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors">Done</button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Table ─────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-6">
        {filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 px-6 py-12 text-center">
            <p className="text-sm font-medium text-gray-700">No batches found</p>
            <p className="text-xs text-gray-400 mt-1">{search ? `No results for "${search}"` : 'No batches match the selected filter.'}</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <table className="w-full table-fixed">
              <colgroup>
                <col style={{ width: '38%' }} />
                <col style={{ width: '8%' }} />
                <col style={{ width: '15%' }} />
                <col style={{ width: '29%' }} />
                <col style={{ width: '10%' }} />
              </colgroup>
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-4 py-3 text-left   text-[11px] font-normal text-gray-400 uppercase tracking-[0.06em]">Arrived</th>
                  <th className="px-4 py-3 text-right  text-[11px] font-normal text-gray-400 uppercase tracking-[0.06em]">Docs</th>
                  <th className="px-4 py-3 text-left   text-[11px] font-normal text-gray-400 uppercase tracking-[0.06em]">Status</th>
                  <th className="px-4 py-3 text-left   text-[11px] font-normal text-gray-400 uppercase tracking-[0.06em]">Actioned By</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {pageGroups.map(group => {
                  const status = effectiveStatus(group);
                  const returnsCount = effectiveReturnsCount(group);
                  // Processed rows are normally muted (opacity 0.7). When the
                  // row carries a ↩ N returned badge the admin still has work
                  // to do, so we drop the `ibq-processed` class to restore
                  // full-opacity / active row coloring.
                  const baseRowClass = { New: 'ibq-new', In_Progress: 'ibq-inprogress', Processed: 'ibq-processed' }[status];
                  const rowClass = status === 'Processed' && returnsCount > 0 ? 'ibq-active-returns' : baseRowClass;
                  return (
                    <tr key={group.id} onClick={() => handleRowClick(group)}
                        className={`cursor-pointer transition-all ${rowClass}`} style={{ height: 64 }}>
                      <td className="px-4">
                        <p className="text-[15px] font-semibold leading-snug text-gray-900 truncate">{group.name}</p>
                        <p className="text-xs mt-0.5 leading-snug text-gray-400 truncate">
                          {group.dispatchedAt ? `Processed ${group.dispatchedAt}` : `Arrived ${group.arrivedAt}`}
                        </p>
                      </td>
                      <td className="px-4 text-right text-[13px] text-gray-500">{group.docCount}</td>
                      <td className="px-4">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[status]}`}>
                            {STATUS_DISPLAY[status]}
                          </span>
                          {returnsCount > 0 && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 border border-amber-200">
                              ↩ {returnsCount} returned
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 text-[13px] text-gray-500 truncate">{group.actionedBy}</td>
                      <td className="px-4 text-right">
                        <button onClick={e => openMenu(e, group)}
                          className="ibq-menu-btn w-7 h-7 inline-flex items-center justify-center rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
                          <MoreVertical className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <TablePagination page={page} pageSize={PAGE_SIZE} totalItems={filtered.length}
              onPageChange={setPage} label="batches" />
          </div>
        )}
      </div>

      {historyGroup && <DispatchHistoryModal group={historyGroup} onClose={() => setHistoryGroup(null)} />}
      {showUpload && <UploadDocumentModal onAdd={handleUploadAdd} onClose={() => setShowUpload(false)} />}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      {/* Actions dropdown */}
      {menu && activeMenuGroup && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setMenu(null)} />
          <div className="fixed z-30 bg-white border border-gray-200 rounded-xl shadow-xl py-1 overflow-hidden"
               style={{ top: menu.y + 4, right: typeof window !== 'undefined' ? window.innerWidth - menu.x : 0, minWidth: 200 }}>
            {getMenuItems(effectiveStatus(activeMenuGroup), effectiveReturnsCount(activeMenuGroup)).map(item => (
              <button key={item.action} onClick={() => handleAction(activeMenuGroup, item.action)}
                className="w-full flex items-center px-3 py-2 text-sm text-gray-900 hover:bg-gray-50 transition-colors text-left">
                {item.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
