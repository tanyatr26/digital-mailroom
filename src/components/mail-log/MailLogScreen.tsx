'use client';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, X, MoreVertical, Calendar, Plus } from 'lucide-react';
import MultiStatusFilter from '@/src/components/shared/MultiStatusFilter';
import TablePagination from '@/src/components/shared/TablePagination';
import type { MailRun, MailRunStatus, Toast } from '@/src/types';
import { MAIL_RUNS } from '@/src/mocks/mailRuns';
import ToastContainer from '@/src/components/shared/ToastContainer';
import SendHistoryModal from '@/src/components/mail-log/SendHistoryModal';
import NewMailRunModal from '@/src/components/modals/NewMailRunModal';

const PAGE_SIZE = 25;

// V2 §10 — Multi-select filter values. 'has-returns' is virtual; it ANDs
// with status selections so `Released + has-returns` shows only Released
// runs carrying an inline returned badge.
type StatusFilterValue = MailRunStatus | 'has-returns';
const FILTER_OPTIONS: Array<{ value: StatusFilterValue; label: string }> = [
  { value: 'Queued',       label: 'Queued' },
  { value: 'In_Progress',  label: 'In Progress' },
  { value: 'Released',     label: 'Released' },
  { value: 'has-returns',  label: 'Has returns' },
];

function getStatusBadgeClass(status: MailRunStatus): string {
  switch (status) {
    case 'Queued':      return 'bg-gray-100 text-gray-600 border border-gray-300';
    case 'In_Progress': return 'bg-blue-100 text-blue-700 border border-blue-200';
    case 'Released':    return 'bg-green-100 text-green-700 border border-green-200';
  }
}

function getStatusLabel(status: MailRunStatus): React.ReactNode {
  switch (status) {
    case 'Queued':      return 'Queued';
    case 'In_Progress': return 'In Progress';
    case 'Released':    return 'Released';
  }
}

interface MenuState { runId: string; x: number; y: number }
type MenuAction = 'workspace' | 'history' | 'labels' | 'review-returns';
interface MenuItem  { label: string; action: MenuAction }

function getMenuItems(run: MailRun, status: MailRunStatus): MenuItem[] {
  const returnsCount = run.returnedDocs?.length ?? 0;
  switch (status) {
    case 'Queued':
      return [{ label: 'Open mail run', action: 'workspace' }];
    case 'In_Progress':
      return [
        { label: 'Pick up mail run',   action: 'workspace' },
        { label: 'Re-download labels', action: 'labels' },
      ];
    case 'Released':
      return [
        ...(returnsCount > 0 ? [{ label: `Review ${returnsCount} return${returnsCount !== 1 ? 's' : ''}`, action: 'review-returns' as const }] : []),
        { label: 'View send history',  action: 'history' },
        { label: 'Re-download labels', action: 'labels' },
      ];
  }
}

interface MailLogScreenProps {
  // Row-click / "Open mail run" / "Pick up mail run" actions surface the
  // selected run to the parent page so it can mount the dispatch workspace
  // for that run. Released runs still open the in-screen history modal.
  onOpenRun?: (run: MailRun) => void;
  // V2 §11 — Save Progress: a saved run is treated as In_Progress regardless
  // of its mock status. Mapping from run id → effective status overlay.
  statusOverrides?: Record<string, MailRunStatus>;
}

export default function MailLogScreen({ onOpenRun, statusOverrides }: MailLogScreenProps = {}) {
  const router = useRouter();
  const [selectedStatuses, setSelectedStatuses] = useState<Set<StatusFilterValue>>(() => new Set());
  const [search, setSearch]                 = useState('');
  const [dateFrom, setDateFrom]             = useState('');
  const [dateTo, setDateTo]                 = useState('');
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [menu, setMenu]                     = useState<MenuState | null>(null);
  const [historyRun, setHistoryRun]         = useState<MailRun | null>(null);
  const [toasts, setToasts]                 = useState<Toast[]>([]);
  const [showNewRun, setShowNewRun]         = useState(false);
  const [page, setPage]                     = useState(0);
  // Locally-created runs from the upload flow. Prepended to MAIL_RUNS for display.
  const [localRuns, setLocalRuns]           = useState<MailRun[]>([]);

  // Effective status applies the parent's saved-session overrides on top of
  // the mock run's status (saved runs flip to In_Progress).
  const effectiveStatus = (r: MailRun): MailRunStatus => statusOverrides?.[r.id] ?? r.status;

  const filtered = useMemo(() => {
    let runs = [...localRuns, ...MAIL_RUNS];
    // Status sub-filters AND with the virtual `has-returns` filter.
    const statusOnly = [...selectedStatuses].filter((s): s is MailRunStatus => s !== 'has-returns');
    const hasReturnsFilter = selectedStatuses.has('has-returns');
    if (statusOnly.length > 0)  runs = runs.filter(r => statusOnly.includes(effectiveStatus(r)));
    if (hasReturnsFilter)       runs = runs.filter(r => (r.returnedDocs?.length ?? 0) > 0);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      runs = runs.filter(r => r.name.toLowerCase().includes(q));
    }
    if (dateFrom) runs = runs.filter(r => r.createdAtIso >= dateFrom);
    if (dateTo)   runs = runs.filter(r => r.createdAtIso <= dateTo + 'T23:59:59');
    runs.sort((a, b) => b.createdAtIso.localeCompare(a.createdAtIso));
    return runs;
  // effectiveStatus closes over statusOverrides which is in deps.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStatuses, search, dateFrom, dateTo, localRuns, statusOverrides]);

  useEffect(() => { setPage(0); }, [selectedStatuses, search, dateFrom, dateTo]);
  const pageRuns = filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  const addToast = (message: string) => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4500);
  };
  const dismissToast = (id: number) => setToasts(prev => prev.filter(t => t.id !== id));

  const handleRowClick = (run: MailRun) => {
    // Effective status applies save-progress overrides; Released-with-returns
    // still opens the workspace; Released-without-returns goes to history.
    const status = effectiveStatus(run);
    if (status === 'Released') {
      if ((run.returnedDocs?.length ?? 0) > 0 && onOpenRun) { onOpenRun(run); return; }
      setHistoryRun(run);
      return;
    }
    if (onOpenRun) { onOpenRun(run); return; }
    router.push('/');
  };

  const openMenu = (e: React.MouseEvent<HTMLButtonElement>, run: MailRun) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    setMenu(prev => prev?.runId === run.id ? null : { runId: run.id, x: rect.right, y: rect.bottom });
  };

  const handleAction = (run: MailRun, action: MenuAction) => {
    setMenu(null);
    if (action === 'workspace' || action === 'review-returns') {
      if (onOpenRun) onOpenRun(run); else router.push('/');
      return;
    }
    if (action === 'history')   { setHistoryRun(run); return; }
    if (action === 'labels')    { addToast(`Labels downloaded — ${run.name}`); return; }
  };

  const activeMenuRun = menu
    ? [...localRuns, ...MAIL_RUNS].find(r => r.id === menu.runId) ?? null
    : null;
  const hasDateFilter = !!(dateFrom || dateTo);

  const handleCreateRun = ({ name, docCount }: { name: string; docCount: number }) => {
    const now = new Date();
    const iso = now.toISOString().slice(0, 16);
    const human = now.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }).replace(',', ' ·');
    const newRun: MailRun = {
      id: 'run-local-' + now.getTime(),
      name,
      status: 'Queued',
      docCount,
      createdAt: human,
      createdAtIso: iso,
      actionedBy: 'You',
    };
    setLocalRuns(prev => [newRun, ...prev]);
    setShowNewRun(false);
    addToast(`"${name}" created · ${docCount} document${docCount !== 1 ? 's' : ''}.`);
  };

  return (
    <div className="h-full flex flex-col bg-slate-50">
      <style>{`
        .mlr-queued:hover         { background-color: rgba(107,114,128,0.04); box-shadow: inset 3px 0 0 #9ca3af; }
        .mlr-inprogress:hover     { background-color: rgba(59,130,246,0.04);  box-shadow: inset 3px 0 0 #3b82f6; }
        .mlr-released td          { opacity: 0.7; }
        .mlr-released:hover       { background-color: rgba(0,0,0,0.015); }
        .mlr-active-returns:hover { background-color: rgba(245,158,11,0.05); box-shadow: inset 3px 0 0 #f59e0b; }
        .menu-btn             { opacity: 0; transition: opacity 0.1s; }
        tr:hover .menu-btn    { opacity: 1; }
      `}</style>

      <div className="bg-white flex-shrink-0 border-b border-gray-200">
        <div className="px-6 pt-5 pb-4 border-b border-gray-100">
          <h1 className="text-2xl font-semibold text-gray-900">Mail Log</h1>
          <p className="mt-0.5 text-[13px] text-gray-400">All inbound mail runs</p>
        </div>

        <div className="px-6 py-3 flex items-center gap-2">
          <button onClick={() => setShowNewRun(true)}
            className="order-last ml-auto h-9 inline-flex items-center gap-1.5 px-3 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm">
            <Plus className="w-4 h-4" /> New Mail Run
          </button>
          <MultiStatusFilter options={FILTER_OPTIONS} selected={selectedStatuses} onChange={setSelectedStatuses} />

          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search mail runs…"
              className="h-9 pl-8 pr-7 text-sm text-gray-900 placeholder:text-gray-400 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-400 transition-colors"
              style={{ width: 240 }}
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          <div className="relative">
            <button
              onClick={() => setDatePickerOpen(v => !v)}
              className={`h-9 flex items-center gap-1.5 px-3 border rounded-lg text-sm bg-white transition-colors ${
                hasDateFilter ? 'border-blue-400 text-gray-900' : 'border-gray-300 text-gray-500 hover:border-gray-400'
              }`}
            >
              <Calendar className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
              <span className="whitespace-nowrap">
                {hasDateFilter ? `${dateFrom || '…'} – ${dateTo || '…'}` : 'All dates'}
              </span>
              {hasDateFilter && (
                <span role="button" onClick={e => { e.stopPropagation(); setDateFrom(''); setDateTo(''); }}
                  className="ml-0.5 text-gray-400 hover:text-gray-600 cursor-pointer">
                  <X className="w-3 h-3" />
                </span>
              )}
            </button>
            {datePickerOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setDatePickerOpen(false)} />
                <div className="absolute left-0 top-full mt-1 z-20 bg-white border border-gray-200 rounded-xl shadow-xl p-4" style={{ width: 260 }}>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">From</label>
                      <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                        className="w-full h-9 px-3 text-sm text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-400 transition-colors" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">To</label>
                      <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                        className="w-full h-9 px-3 text-sm text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-400 transition-colors" />
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                    <button onClick={() => { setDateFrom(''); setDateTo(''); setDatePickerOpen(false); }}
                      className="text-xs text-gray-500 hover:text-gray-700 transition-colors">Clear</button>
                    <button onClick={() => setDatePickerOpen(false)}
                      className="text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors">Done</button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 px-6 py-12 text-center">
            <p className="text-sm font-medium text-gray-700">No mail runs found</p>
            <p className="text-xs text-gray-400 mt-1">
              {search ? `No results for "${search}"` : 'No mail runs match the selected filter.'}
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <table className="w-full table-fixed">
              <colgroup>
                <col style={{ width: '35%' }} />
                <col style={{ width: '8%' }} />
                <col style={{ width: '18%' }} />
                <col style={{ width: '17%' }} />
                <col style={{ width: '17%' }} />
                <col style={{ width: '5%' }} />
              </colgroup>
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-4 py-3 text-left text-[11px] font-normal text-gray-400 uppercase tracking-[0.06em]">Mail Run</th>
                  <th className="px-4 py-3 text-right text-[11px] font-normal text-gray-400 uppercase tracking-[0.06em]">Docs</th>
                  <th className="px-4 py-3 text-left text-[11px] font-normal text-gray-400 uppercase tracking-[0.06em]">Status</th>
                  <th className="px-4 py-3 text-left text-[11px] font-normal text-gray-400 uppercase tracking-[0.06em]">Actioned By</th>
                  <th className="px-4 py-3 text-left text-[11px] font-normal text-gray-400 uppercase tracking-[0.06em]">Created</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {pageRuns.map(run => {
                  const status = effectiveStatus(run);
                  const returnsCount = run.returnedDocs?.length ?? 0;
                  const baseRowClass: string = ({
                    Queued:      'mlr-queued',
                    In_Progress: 'mlr-inprogress',
                    Released:    'mlr-released',
                  } as Record<MailRunStatus, string>)[status];
                  // Released-with-returns: drop the muted treatment so the row
                  // reads as active (work to do on the returned items).
                  const rowClass = status === 'Released' && returnsCount > 0 ? 'mlr-active-returns' : baseRowClass;
                  return (
                    <tr key={run.id} onClick={() => handleRowClick(run)}
                      className={`cursor-pointer transition-all ${rowClass}`} style={{ height: 64 }}>
                      <td className="px-4">
                        <p className="text-[15px] font-semibold leading-snug text-gray-900 truncate">{run.name}</p>
                        <p className="text-xs mt-0.5 leading-snug text-gray-400 truncate">
                          {run.releasedAt ? `Released ${run.releasedAt}` : `Received ${run.createdAt}`}
                        </p>
                      </td>
                      <td className="px-4 text-right text-[13px] text-gray-500">{run.docCount}</td>
                      <td className="px-4">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeClass(status)}`}>
                            {getStatusLabel(status)}
                          </span>
                          {returnsCount > 0 && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 border border-amber-200">
                              ↩ {returnsCount} returned
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 text-[13px] text-gray-500 truncate">{run.actionedBy}</td>
                      <td className="px-4 text-[13px] text-gray-500 truncate">{run.createdAt}</td>
                      <td className="px-4 text-right">
                        <button onClick={e => openMenu(e, run)}
                          className="menu-btn w-7 h-7 inline-flex items-center justify-center rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
                          <MoreVertical className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <TablePagination page={page} pageSize={PAGE_SIZE} totalItems={filtered.length}
              onPageChange={setPage} label="runs" />
          </div>
        )}
      </div>

      {historyRun && <SendHistoryModal run={historyRun} onClose={() => setHistoryRun(null)} />}
      {showNewRun && <NewMailRunModal onCreate={handleCreateRun} onClose={() => setShowNewRun(false)} />}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      {menu && activeMenuRun && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setMenu(null)} />
          <div className="fixed z-30 bg-white border border-gray-200 rounded-xl shadow-xl py-1 overflow-hidden"
            style={{
              top: menu.y + 4,
              right: typeof window !== 'undefined' ? window.innerWidth - menu.x : 0,
              minWidth: 220,
            }}>
            {getMenuItems(activeMenuRun, effectiveStatus(activeMenuRun)).map(item => (
              <button key={item.action} onClick={() => handleAction(activeMenuRun, item.action)}
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
